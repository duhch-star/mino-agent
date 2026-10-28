import { NextRequest, NextResponse } from "next/server";
import { minosEnabled, minosCookieName, verifyMinosCredential } from "@/lib/minos-auth";

export async function GET(request: NextRequest) {
  if (!minosEnabled()) return new NextResponse("MINOS integration disabled", { status: 404 });
  const ticket = request.nextUrl.searchParams.get("ticket");
  if (!ticket) return new NextResponse("请从 MINOS 登录后重新打开聊天。", { status: 401 });
  const identity = await verifyMinosCredential({ ticket }).catch(() => null);
  if (!identity) return new NextResponse("连接凭据已过期，请从 MINOS 重新打开聊天。", { status: 401, headers: { "Cache-Control": "no-store" } });
  const target = new URL("/", `http://${request.headers.get('host') || new URL(request.url).host}`);
  target.searchParams.set("cwd", identity.workspace);
  const businessPath = request.nextUrl.searchParams.get('businessPath');
  if (businessPath && businessPath.startsWith('/') && !businessPath.startsWith('//') && businessPath.length < 500) target.searchParams.set('businessPath', businessPath);
  const response = NextResponse.redirect(target);
  response.cookies.set(minosCookieName(), identity.token, { httpOnly: true, sameSite: "strict", path: "/", maxAge: 8 * 60 * 60 });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
