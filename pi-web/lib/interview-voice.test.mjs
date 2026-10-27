import test from 'node:test';
import assert from 'node:assert/strict';
import { createInterviewAudio } from '../components/minos/lib/interview-audio.mjs';
import { createInterviewRecognition } from '../components/minos/lib/interview-recognition.mjs';
import {effectiveSpeechProvider} from '../components/minos/lib/speech-policy.mjs';
test('automatic voice skips unconfigured cloud and respects explicit choice',()=>{
 assert.equal(effectiveSpeechProvider('auto',null),'browser');
 assert.equal(effectiveSpeechProvider('auto',{configured:false}),'browser');
 assert.equal(effectiveSpeechProvider('auto',{configured:true}),'auto');
 assert.equal(effectiveSpeechProvider('mambo',{configured:false}),'mambo');
});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('voice stop aborts fetch and stale audio never plays', async () => {
  let resolve, signal, plays = 0;
  const player = createInterviewAudio({ fetchAudio: (_, s) => { signal = s; return new Promise(r => { resolve = r; }); }, createAudio: () => { plays++; } });
  const run = player.speak('问题'); player.stop(); resolve(new Blob(['audio'])); await run;
  assert.equal(signal.aborted, true); assert.equal(plays, 0);
});
test('browser voice uses actual onstart for first-audio latency and cancels', async () => {
  let utterance, cancelled = 0, metrics;
  class Utterance { constructor(text) { this.text = text; } }
  const synthesis = { getVoices: () => [{ lang:'zh-CN', voiceURI:'local' }], speak: u => { utterance = u; }, cancel: () => cancelled++ };
  let time = 10;
  const player = createInterviewAudio({ synthesis, Utterance, now: () => time, onMetrics: m => { metrics = m; } });
  await player.speak('你好', { provider:'browser', rate:1.15 });
  assert.equal(metrics.firstAudioMs, null); time = 85; utterance.onstart();
  assert.equal(metrics.firstAudioMs,75); assert.equal(utterance.rate,1.15);
  player.stop(); assert.ok(cancelled > 0); assert.equal(utterance.onend,null);
});
test('synchronous browser failures settle idle without rejecting or hanging',async()=>{
 let state,error;
 const player=createInterviewAudio({synthesis:{getVoices(){throw Error('voice list');},speak(){throw Error('blocked');},cancel(){}},Utterance:class {},onState:v=>state=v,onError:v=>error=v});
 await player.speak('你好',{provider:'browser'});assert.equal(state,'idle');assert.match(error,/无法启动/);player.stop();
});
test('late browser start after stop never changes playback state',async()=>{
 let utterance,state;const player=createInterviewAudio({synthesis:{getVoices:()=>[],speak:u=>utterance=u,cancel(){}},Utterance:class {},onState:v=>state=v});
 await player.speak('你好',{provider:'browser'});const late=utterance.onstart;player.stop();late();assert.equal(state,'idle');
});
test('cloud timeout has bounded browser fallback', async () => {
  let spoken = 0;
  const player = createInterviewAudio({ fetchAudio: () => new Promise(() => {}), timeoutMs:5,
    synthesis:{getVoices:()=>[], speak:()=>spoken++, cancel:()=>{}}, Utterance:class {} });
  await player.speak('超时'); assert.equal(spoken,1); player.stop();
});
class Recognition {
  static instances=[];
  constructor() { Recognition.instances.push(this); }
  start() { this.onstart?.(); }
  abort() { this.onend?.(); }
  result(final, interim='') { this.onresult({results:[{0:{transcript:final},isFinal:true}, {0:{transcript:interim},isFinal:false}]}); }
}
function recognize(options={}) {
  const answers=[], texts=[];
  const controller=createInterviewRecognition({ Recognition, onText:v=>texts.push(v), onInterim:()=>{}, onListening:()=>{}, onAnswer:v=>answers.push(v), onError:()=>{}, silenceMs:20, ...options });
  return { controller, answers, texts, engine:Recognition.instances.at(-1) };
}
test('recognition defaults to review-before-submit and does not duplicate final results', async () => {
  const turn=recognize(); turn.engine.result('我的项目'); turn.engine.result('我的项目经历'); await wait(35);
  assert.equal(turn.texts.at(-1),'我的项目经历'); assert.deepEqual(turn.answers,[]); turn.controller.stop();
});
test('optional automatic submission waits for stable final and ignores interim', async () => {
  const turn=recognize({autoSubmit:true}); turn.engine.result('完整','还在说'); await wait(30); assert.equal(turn.answers.length,0);
  turn.engine.result('完整回答'); await wait(30); assert.deepEqual(turn.answers,['完整回答']);
  turn.engine.result('重复'); await wait(30); assert.equal(turn.answers.length,1); turn.controller.stop();
});
test('recognition resume appends to preserved draft without duplicating cycles', () => {
 const turn=recognize({initialText:'之前的回答'});turn.engine.result('补充');turn.engine.result('补充结果');
 assert.equal(turn.texts.at(-1),'之前的回答 补充结果');turn.controller.stop();
});
test('late results from ended engine cannot corrupt restarted recognition',async()=>{
 const turn=recognize();turn.engine.result('第一段');turn.engine.onend();await wait(280);
 const next=Recognition.instances.at(-1);assert.notEqual(next,turn.engine);next.result('第二段');
 turn.engine.result('迟到污染');assert.equal(turn.texts.at(-1),'第一段第二段');turn.controller.stop();
});
test('recognition error blocks subsequent callbacks and auto-submit',async()=>{
 const turn=recognize({autoSubmit:true});turn.engine.result('保留回答');turn.engine.onerror({error:'network'});turn.engine.result('错误后结果');await wait(30);
 assert.equal(turn.texts.at(-1),'保留回答');assert.deepEqual(turn.answers,[]);turn.controller.stop();
});
test('recognition constructor error becomes recoverable text feedback',()=>{
 let error;const controller=createInterviewRecognition({Recognition:class {constructor(){throw Error('unsupported');}},onListening(){},onError:v=>error=v});
 assert.match(error,/无法创建/);controller.stop();
});
test('recognition stop cancels pending auto-submit', async () => {
  const turn=recognize({autoSubmit:true}); turn.engine.result('未提交'); turn.controller.stop(); await wait(30); assert.equal(turn.answers.length,0);
});
