// Offline adapter contract. Not a deployed endpoint or customer-photo handler.
import {CASES,evaluateRenderer} from './evaluateRenderer.mjs';
const id=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9_-]{0,63}$/.test(x);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/i.test(x);
const failure=reason=>({status:'unavailable',reason});
// The application must supply server-owned evidence and a private fixture registry,
// never values or URLs from a shopper. No provider is registered by default.
export function createOfflineRenderer({provider=null,report=null,fixtures=new Map(),timeoutMs=30000}={}){
 const qualified=()=>provider&&id(provider.id)&&typeof provider.render==='function'&&
  report?.renderer===provider.id&&report?.version===provider.version&&
  report?.configSha256===provider.configSha256&&evaluateRenderer(report).eligible===true;
 let busy=false;
 return Object.freeze({
  get available(){return !!qualified();},
  async render(request,{signal}={}){
   if(!qualified())return failure('renderer_not_qualified');
   if(!request||typeof request!=='object'||!Object.hasOwn(request,'caseId')||Reflect.ownKeys(request).some(k=>k!=='caseId')||!CASES.includes(request.caseId))return failure('invalid_case');
   const caseId=request.caseId;
   const row=fixtures instanceof Map?fixtures.get(caseId):null;
   const fixture=row?{...row}:null;
   const evidence=report.cases.find(x=>x.id===caseId);
   if(!fixture||!id(fixture.personRef)||!id(fixture.garmentRef)||!hash(fixture.personSha256)||!hash(fixture.garmentSha256)||
     fixture.personSha256!==evidence?.personSha256||fixture.garmentSha256!==evidence?.garmentSha256||
     fixture.provenance!==evidence?.provenance)return failure('fixture_not_verified');
   if(!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>120000)return failure('invalid_timeout');
   if(signal?.aborted)return failure('cancelled');
   if(busy)return failure('renderer_busy');
   busy=true;
   const controller=new AbortController();
   let timer,listener;
   const stop=new Promise(resolve=>{
    listener=()=>{controller.abort();resolve(failure('cancelled'));};
    signal?.addEventListener('abort',listener,{once:true});
    timer=setTimeout(()=>{controller.abort();resolve(failure('timed_out'));},timeoutMs);
   });
   // Keep concurrency locked until the provider actually settles, even if
   // cancellation or timeout returns first. Providers must honor AbortSignal.
   const task=Promise.resolve().then(()=>{
    if(controller.signal.aborted)return failure('cancelled');
    if(!qualified())return failure('renderer_not_qualified');
    return provider.render({caseId,personRef:fixture.personRef,garmentRef:fixture.garmentRef,signal:controller.signal});
   }).then(out=>{
    if(controller.signal.aborted)return failure('cancelled');
    if(!qualified())return failure('renderer_not_qualified');
    if(!out||out.status!=='rendered'||out.caseId!==caseId||!id(out.artifactRef)||
     !hash(out.outputSha256)||[fixture.personSha256.toLowerCase(),fixture.garmentSha256.toLowerCase()].includes(out.outputSha256.toLowerCase())||
     !['image/png','image/jpeg','image/webp'].includes(out.mimeType)||
     !Number.isSafeInteger(out.bytes)||out.bytes<1||out.bytes>10*1024*1024)return failure('invalid_provider_output');
    return {status:'rendered',caseId,artifactRef:out.artifactRef,outputSha256:out.outputSha256,mimeType:out.mimeType,bytes:out.bytes,scope:'offline_evaluation',fitVerified:false};
   }).catch(()=>failure('provider_failed')).finally(()=>{busy=false;});
   try{return await Promise.race([task,stop]);}
   finally{clearTimeout(timer);signal?.removeEventListener('abort',listener);}
  }
 });
}
