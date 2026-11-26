// Offline evaluation only. Never accepts customer photos or invokes a renderer.
export const CASES=Object.freeze([
 'top-front','top-pattern','top-dark','top-broad','top-seated','top-occluded',
 'bottom-front','bottom-pattern','bottom-side','bottom-occluded',
 'onepiece-front','onepiece-pattern','onepiece-side','onepiece-occluded'
]);
export const DIMENSIONS=Object.freeze(['identity','garmentDetail','silhouette','occlusion']);
const validScore=x=>Number.isInteger(x)&&x>=1&&x<=5;
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/i.test(x);
const finitePositive=x=>Number.isFinite(x)&&x>0;
const finiteNonnegative=x=>Number.isFinite(x)&&x>=0;
const RIGHTS=['model','weights','parser','dependencies','inputOutput'];
// Provisional evaluation defaults, not a production SLA or an accuracy claim.
export function evaluateRenderer(report,limits={maxLatencyMs:30000,maxCostUsd:0.10}){
 const issues=[];
 if(!report||typeof report!=='object')return {eligible:false,issues:['missing report']};
 if(!finitePositive(limits.maxLatencyMs)||!finiteNonnegative(limits.maxCostUsd))return {eligible:false,issues:['invalid limits']};
 if(!nonempty(report.renderer)||!nonempty(report.version)||!nonempty(report.hardware)||!hash(report.configSha256))issues.push('missing reproducibility metadata');
 for(const key of RIGHTS){
  const item=report.rights?.[key];
  if(item?.status!=='commercially-cleared'||!nonempty(item.evidence)||!nonempty(item.reviewer))issues.push('unresolved rights: '+key);
 }
 if(report.isolated!==true||report.customerDataUsed!==false||report.networkRetentionVerified!==true||report.deletionVerified!==true)issues.push('privacy controls not verified');
 const rows=Array.isArray(report.cases)?report.cases:[];
 const seen=new Set(), artifacts=new Set();
 let passed=0,failures=0,maxLatency=0,maxCost=0,peakMemory=0;
 for(const row of rows){
  if(!row||!CASES.includes(row.id)||seen.has(row.id)){issues.push('unknown or duplicate case');continue;}
  seen.add(row.id);
  if(!['original-synthetic','licensed-test'].includes(row.provenance)||!nonempty(row.rightsEvidence)||!hash(row.personSha256)||!hash(row.garmentSha256)){issues.push(row.id+': invalid fixture provenance');continue;}
  if(!finitePositive(row.latencyMs)||!finiteNonnegative(row.costUsd)||!finitePositive(row.peakMemoryMiB)){issues.push(row.id+': missing performance data');continue;}
  maxLatency=Math.max(maxLatency,row.latencyMs);maxCost=Math.max(maxCost,row.costUsd);peakMemory=Math.max(peakMemory,row.peakMemoryMiB);
  if(row.status!=='rendered'){failures++;issues.push(row.id+': rendering failed');continue;}
  if(!hash(row.outputSha256)||artifacts.has(row.outputSha256)||row.outputSha256===row.personSha256||row.outputSha256===row.garmentSha256||!nonempty(row.reviewer)||!DIMENSIONS.every(k=>validScore(row.scores?.[k]))){issues.push(row.id+': missing or duplicate output/review evidence');continue;}
  artifacts.add(row.outputSha256);
  if(row.criticalArtifact!==false||DIMENSIONS.some(k=>row.scores[k]<4)){issues.push(row.id+': quality threshold not met');continue;}
  passed++;
 }
 for(const id of CASES)if(!seen.has(id))issues.push('missing case: '+id);
 if(maxLatency>limits.maxLatencyMs)issues.push('latency exceeds limit');
 if(maxCost>limits.maxCostUsd)issues.push('cost exceeds limit');
 return {eligible:issues.length===0&&passed===CASES.length,issues,passed,failures,total:CASES.length,maxLatencyMs:maxLatency,maxCostUsd:maxCost,peakMemoryMiB:peakMemory};
}
