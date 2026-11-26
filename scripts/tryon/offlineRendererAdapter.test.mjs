import test from 'node:test';
import assert from 'node:assert/strict';
import {CASES,DIMENSIONS} from './evaluateRenderer.mjs';
import {createOfflineRenderer} from './offlineRendererAdapter.mjs';
const h=n=>n.toString(16).padStart(64,'0');
// Mock metadata and provider only. No real images or commercial clearance.
function setup(render,timeoutMs=1000){
 const report={renderer:'mock',version:'test',hardware:'mock',configSha256:h(1),rights:Object.fromEntries(['model','weights','parser','dependencies','inputOutput'].map(k=>[k,{status:'commercially-cleared',evidence:'mock',reviewer:'mock'}])),isolated:true,customerDataUsed:false,networkRetentionVerified:true,deletionVerified:true,cases:CASES.map((id,i)=>({id,provenance:'original-synthetic',rightsEvidence:'mock',personSha256:h(2+i),garmentSha256:h(20+i),outputSha256:h(40+i),status:'rendered',reviewer:'mock',scores:Object.fromEntries(DIMENSIONS.map(k=>[k,4])),criticalArtifact:false,latencyMs:1000,costUsd:0,peakMemoryMiB:1}))};
 const fixtures=new Map(report.cases.map(x=>[x.id,{personRef:'person-'+x.id,garmentRef:'garment-'+x.id,personSha256:x.personSha256,garmentSha256:x.garmentSha256,provenance:x.provenance}]));
 const provider={id:'mock',version:'test',configSha256:h(1),render};
 return {provider,report,fixtures,timeoutMs};
}
const request={caseId:CASES[0]};
const output={status:'rendered',caseId:CASES[0],artifactRef:'output-1',outputSha256:h(100),mimeType:'image/png',bytes:512};
test('no default provider and uncleared or mismatched evidence never invokes inference',async()=>{
 let calls=0;const config=setup(()=>{calls++;return output;});
 assert.equal(createOfflineRenderer().available,false);
 assert.equal((await createOfflineRenderer().render(request)).reason,'renderer_not_qualified');
 config.report.rights.parser.status='unknown';
 assert.equal((await createOfflineRenderer(config).render(request)).reason,'renderer_not_qualified');
 const other=setup(()=>{calls++;return output;});other.provider.version='different';
 assert.equal((await createOfflineRenderer(other).render(request)).reason,'renderer_not_qualified');assert.equal(calls,0);
});
test('qualified mock returns sanitized evaluation result without fit claim',async()=>{
 const a=createOfflineRenderer(setup(input=>{assert.equal(input.personRef,'person-'+request.caseId);assert.ok(input.signal);return {...output,secret:'not returned'};}));
 assert.equal(a.available,true);assert.deepEqual(await a.render(request),{...output,scope:'offline_evaluation',fitVerified:false});
});
test('no arbitrary URLs or user images; missing or mismatched fixture is blocked',async()=>{
 let calls=0;const c=setup(()=>{calls++;return output;});const a=createOfflineRenderer(c);
 assert.equal((await a.render({...request,photoUrl:'https://example.com/photo'})).reason,'invalid_case');
 assert.equal((await a.render({caseId:'unknown'})).reason,'invalid_case');
 c.fixtures.get(request.caseId).personSha256=h(999);
 assert.equal((await a.render(request)).reason,'fixture_not_verified');assert.equal(calls,0);
});
test('malformed or cross-case output and input reuse are rejected',async()=>{
 for(const bad of [{caseId:CASES[1]},{artifactRef:'https://example.com/out'},{outputSha256:h(2)},{mimeType:'text/html'},{bytes:0},{bytes:11*1024*1024}]){
  const a=createOfflineRenderer(setup(()=>({...output,...bad})));
  assert.equal((await a.render(request)).reason,'invalid_provider_output');
 }
});
test('provider errors are sanitized',async()=>{
 const a=createOfflineRenderer(setup(()=>{throw Error('private detail');}));
 assert.deepEqual(await a.render(request),{status:'unavailable',reason:'provider_failed'});
});
test('timeout returns safely and concurrency stays locked until provider settles',async()=>{
 let finish,seen;const a=createOfflineRenderer(setup(({signal})=>{seen=signal;return new Promise(resolve=>{finish=resolve;});},10));
 assert.equal((await a.render(request)).reason,'timed_out');assert.equal(seen.aborted,true);
 assert.equal((await a.render(request)).reason,'renderer_busy');finish(output);
 await new Promise(resolve=>setImmediate(resolve));
 const aborted=new AbortController();aborted.abort();
 assert.equal((await a.render(request,{signal:aborted.signal})).reason,'cancelled');
});
test('caller cancellation aborts provider and does not display late results',async()=>{
 const controller=new AbortController();let finish,seen;
 const a=createOfflineRenderer(setup(({signal})=>{seen=signal;return new Promise(resolve=>{finish=resolve;});}));
 const pending=a.render(request,{signal:controller.signal});await Promise.resolve();controller.abort();
 assert.equal((await pending).reason,'cancelled');assert.equal(seen.aborted,true);finish(output);
});

test('approval revocation after construction blocks subsequent inference',async()=>{
 let calls=0;const c=setup(()=>{calls++;return output;});const a=createOfflineRenderer(c);
 c.report.rights.parser.status='revoked';assert.equal(a.available,false);
 assert.equal((await a.render(request)).reason,'renderer_not_qualified');assert.equal(calls,0);
});
test('cancellation before provider dispatch avoids inference',async()=>{
 let calls=0;const controller=new AbortController();const a=createOfflineRenderer(setup(()=>{calls++;return output;}));
 const pending=a.render(request,{signal:controller.signal});controller.abort();
 assert.equal((await pending).reason,'cancelled');assert.equal(calls,0);
});
test('revocation while inference is running prevents result acceptance',async()=>{
 let finish;const c=setup(()=>new Promise(resolve=>{finish=resolve;}));const a=createOfflineRenderer(c);
 const pending=a.render(request);await Promise.resolve();c.report.rights.model.status='revoked';finish(output);
 assert.equal((await pending).reason,'renderer_not_qualified');
});
test('mixed case input digest reuse and inherited case identifiers are rejected',async()=>{
 const c=setup(()=>({...output,outputSha256:'A'.repeat(64)}));
 c.report.cases[0].personSha256='a'.repeat(64);c.fixtures.get(request.caseId).personSha256='a'.repeat(64);
 const a=createOfflineRenderer(c);
 assert.equal((await a.render(request)).reason,'invalid_provider_output');
 assert.equal((await a.render(Object.create(request))).reason,'invalid_case');
});
