/** Conservative gates: failures and missing audio never disappear from denominator. */
export function summarizeInterviewSamples(samples,{firstAudioMs=3000,completeMs=15000}={}) {
 if(![firstAudioMs,completeMs].every(v=>Number.isFinite(v)&&v>0))throw new Error('Latency targets must be positive finite milliseconds');
 const good=s=>!s.error&&!s.speechError&&Number.isFinite(s.firstAudioMs)&&Number.isFinite(s.completeMs)&&s.dimensionCount===3;
 const successful=samples.filter(good),passing=successful.filter(s=>s.firstAudioMs<=firstAudioMs&&s.completeMs<=completeMs);
 const metrics={};
 for(const key of ['previewMs','firstAudioMs','voiceStartupMs','completeMs']){
  const values=successful.map(s=>s[key]).filter(Number.isFinite).sort((a,b)=>a-b);
  metrics[key]={n:values.length,min:values[0]??null,p50:values.length?values[Math.ceil(values.length*.5)-1]:null,p95:values.length?values[Math.ceil(values.length*.95)-1]:null,max:values.at(-1)??null};
 }
 return {total:samples.length,successful:successful.length,failed:samples.length-successful.length,withinTarget:passing.length,successRate:samples.length?successful.length/samples.length:0,targets:{firstAudioMs,completeMs},allPassed:samples.length>0&&passing.length===samples.length,metrics,note:'Small sample observational gate, not production SLA or acoustic measurement.'};
}
