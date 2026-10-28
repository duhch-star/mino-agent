import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cookieSessionId, createAccount, loadAccount, deleteAccount, accountRequest, GATEWAY_COOKIE } from './minos-gateway.ts';
test('parallel account business requests do not wait for slow speech; refresh rotates once', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'minos-concurrent-'));
  const old = process.env.MINOS_GATEWAY_SESSION_DIR, originalFetch = globalThis.fetch;
  process.env.MINOS_GATEWAY_SESSION_DIR = dir;
  try {
    const id = await createAccount({ accessToken:'old', refreshToken:'refresh', user:{id:'u1',role:'user'}, expiresAt:Date.now()+60000 });
    let releaseSpeech, enteredSpeech;
    const entered = new Promise(resolve => { enteredSpeech = resolve; });
    const held = new Promise(resolve => { releaseSpeech = resolve; });
    let rotations = 0;
    globalThis.fetch = async (url, init) => {
      if (url.endsWith('/speech')) { enteredSpeech(); await held; return new Response('audio'); }
      if (url.endsWith('/refresh')) { rotations++; await new Promise(r => setTimeout(r,10)); return Response.json({accessToken:'new',refreshToken:'rotated'}); }
      return init.headers.Authorization === 'Bearer old' ? new Response('',{status:401}) : Response.json({ok:true});
    };
    const speech = accountRequest(id,'/speech'); await entered;
    const fast = await Promise.race([Promise.all([accountRequest(id,'/learning'),accountRequest(id,'/profile')]),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Slow speech blocked UI')),1000))]);
    assert.equal(fast[0].status,200); assert.equal(fast[1].status,200); assert.equal(rotations,1);
    releaseSpeech(); assert.equal((await speech).status,200);
  } finally {
    globalThis.fetch=originalFetch;
    if(old===undefined) delete process.env.MINOS_GATEWAY_SESSION_DIR; else process.env.MINOS_GATEWAY_SESSION_DIR=old;
    await rm(dir,{recursive:true,force:true});
  }
});
test('cookie parser refuses path traversal and arbitrary identifiers', () => {
  for (const input of [null, '', 'minos_account=../../secret', 'minos_account=abc']) assert.equal(cookieSessionId(input), null);
  assert.equal(cookieSessionId(`other=1; ${GATEWAY_COOKIE}=${'a'.repeat(64)}`), 'a'.repeat(64));
});
test('account capabilities expire and logout removes server credentials', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'minos-account-'));
  const old = process.env.MINOS_GATEWAY_SESSION_DIR;
  process.env.MINOS_GATEWAY_SESSION_DIR = dir;
  try {
    const session = { accessToken:'server-access', refreshToken:'server-refresh', user:{ id:'u1', role:'user' }, expiresAt:Date.now()+60000 };
    const id = await createAccount(session);
    assert.match(id, /^[a-f0-9]{64}$/);
    assert.equal((await loadAccount(id)).user.id, 'u1');
    await deleteAccount(id);
    assert.equal(await loadAccount(id), null);
    const expired = await createAccount({ ...session, expiresAt:Date.now()-1 });
    assert.equal(await loadAccount(expired), null);
    await assert.rejects(readFile(join(dir, expired+'.json')));
  } finally {
    if (old === undefined) delete process.env.MINOS_GATEWAY_SESSION_DIR; else process.env.MINOS_GATEWAY_SESSION_DIR=old;
    await rm(dir, { recursive:true, force:true });
  }
});
