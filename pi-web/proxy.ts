import { NextResponse, type NextRequest } from "next/server";
import { gatewayEnabled, cookieSessionId, loadAccount } from '@/lib/minos-gateway';
import { minosEnabled, minosCookieName, verifyMinosCredential, isInternalSidecarRequest } from "@/lib/minos-auth";
import {
  getAuthRetryAfterMs,
  recordAuthFailure,
  retryAfterSeconds,
} from "@/lib/auth-throttle";
import {
  isApiRequestAllowed,
  isApiRequestHostAllowed,
} from "@/lib/request-security";
import {
  isValidWebSessionToken,
  isValidBasicAuthorization,
  isWebPasswordEnabled,
  PI_WEB_SESSION_COOKIE,
} from "@/lib/web-auth";

function tooManyAttempts(retryAfterMs: number): NextResponse {
  return new NextResponse("Too many failed attempts", {
    status: 429,
    headers: {
      "Cache-Control": "no-store",
      "Retry-After": String(retryAfterSeconds(retryAfterMs)),
    },
  });
}

export async function proxy(request: NextRequest) {
  const isApiRequest = request.nextUrl.pathname === "/api"
    || request.nextUrl.pathname.startsWith("/api/");
  const isTrustedRequest = isApiRequest
    ? isApiRequestAllowed(request)
    : isApiRequestHostAllowed(request);

  if (!isTrustedRequest) {
    if (!isApiRequest) {
      return new NextResponse("Untrusted request", { status: 403 });
    }
    return NextResponse.json({ error: "Untrusted API request" }, { status: 403 });
  }

  if (gatewayEnabled()) {
    const path = request.nextUrl.pathname;
    if (path === '/api/minos/account') return NextResponse.next();
    const id = cookieSessionId(request.headers.get('cookie'));
    const session = await loadAccount(id);
    if (path === '/login') return NextResponse.next();
    if (!session) return isApiRequest
      ? NextResponse.json({ error: '登录已失效，请重新登录' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));
    if (!isApiRequest || path.startsWith('/api/minos/') || path.startsWith('/api/business/')) return NextResponse.next();
    if (!session.sidecar) return NextResponse.json({ error: '请先连接 Pi 工作区', reconnect: true }, { status: 409 });
    // Preserve streaming/uploads and route every SDK API to this account's own
    // process. Never accept a client-selected port, capability or forwarded auth.
    const destination = new URL(`http://127.0.0.1:${session.sidecar.port}${path}${request.nextUrl.search}`);
    const headers = new Headers(request.headers);
    headers.set('cookie', session.sidecar.cookie);
    headers.set('host', destination.host);
    headers.delete('authorization');
    headers.delete('x-minos-internal');
    if (headers.has('origin')) headers.set('origin', destination.origin);
    headers.delete('x-forwarded-host');
    return NextResponse.rewrite(destination, { request: { headers } });
  }

  if (minosEnabled()) {
    if (request.nextUrl.pathname === '/minos-connect') return NextResponse.next();
    if (request.nextUrl.pathname === '/minos-health') {
      return isInternalSidecarRequest(request.headers.get('x-minos-internal'))
        ? NextResponse.json({ status: 'ok', engine: 'pi' })
        : new NextResponse('Authentication required', { status: 401 });
    }
    const token = request.cookies.get(minosCookieName())?.value;
    const identity = token ? await verifyMinosCredential({ token }).catch(() => null) : null;
    if (!identity) {
      return isApiRequest
        ? NextResponse.json({ error: 'MINOS 登录已失效，请从 MINOS 重新打开聊天。' }, { status: 401 })
        : new NextResponse('请从 MINOS 登录后打开聊天： http://127.0.0.1:5173/#/chat', { status: 401 });
    }
    return NextResponse.next();
  }

  const password = process.env.PI_WEB_PASSWORD;
  if (!isWebPasswordEnabled(password)) {
    if (request.nextUrl.pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  let authenticated = isValidWebSessionToken(request.cookies.get(PI_WEB_SESSION_COOKIE)?.value, password);
  const authorization = isApiRequest ? request.headers.get("authorization") : null;
  if (!authenticated && authorization && /^Basic\s/i.test(authorization)) {
    // Every Basic header is a password guess, so it shares the login form's
    // throttle; otherwise any API path (or GET /api/web-auth) answers guesses
    // at full speed. While blocked even the right password is refused, or the
    // answer would leak. A success does not reset the counter: Basic clients
    // authenticate on every request, and each reset would hand an interleaved
    // guesser a fresh short block.
    const retryAfterMs = getAuthRetryAfterMs();
    if (retryAfterMs > 0) return tooManyAttempts(retryAfterMs);
    authenticated = isValidBasicAuthorization(authorization, password);
    if (!authenticated) recordAuthFailure();
  }
  if (request.nextUrl.pathname === "/login") {
    return authenticated
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }
  if (request.nextUrl.pathname === "/api/web-auth") return NextResponse.next();

  if (!authenticated) {
    if (!isApiRequest) {
      const loginUrl = new URL("/login", request.url);
      if (request.nextUrl.search) {
        loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      }
      return NextResponse.redirect(loginUrl);
    }
    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "WWW-Authenticate": 'Basic realm="Pi Web", charset="UTF-8"',
      },
    });
  }

  return NextResponse.next();
}

export const config = { matcher: ["/", "/login", "/minos-connect", "/minos-health", "/api/:path*"] };
