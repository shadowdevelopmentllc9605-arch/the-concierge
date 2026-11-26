import test from 'node:test';
import assert from 'node:assert/strict';
import {CASES,DIMENSIONS,evaluateRenderer} from './evaluateRenderer.mjs';
const h=n=>n.toString(16).padStart(64,'0');
// Artificial metadata only; these are unit tests, not actual model results.
const sample=()=>({renderer:'unit-test-only',version:'0',hardware:'mock',configSha256:h(1),rights:Object.fromEntries(['model','weights','parser','dependencies','inputOutput'].map(k=>[k,{status:'commercially-cleared',evidence:'mock',reviewer:'mock'}])),isolated:true,customerDataUsed:false,networkRetentionVerified:true,deletionVerified:true,cases:CASES.map((id,i)=>({id,provenance:'original-synthetic',rightsEvidence:'mock',personSha256:h(2+i),garmentSha256:h(20+i),outputSha256:h(40+i),status:'rendered',reviewer:'mock',scores:Object.fromEntries(DIMENSIONS.map(k=>[k,4])),criticalArtifact:false,latencyMs:1000,costUsd:.02,peakMemoryMiB:8000}))});
test('complete artificial evidence satisfies gate logic',()=>{const r=evaluateRenderer(sample());assert.equal(r.eligible,true);assert.equal(r.passed,14);});
test('missing report or cases cannot pass',()=>{assert.equal(evaluateRenderer(null).eligible,false);const s=sample();s.cases.pop();assert.equal(evaluateRenderer(s).eligible,false);});
test('unknown, duplicate and reused output cases fail',()=>{const s=sample();s.cases.push(s.cases[0]);assert.equal(evaluateRenderer(s).eligible,false);const t=sample();t.cases[1].outputSha256=t.cases[0].outputSha256;assert.equal(evaluateRenderer(t).eligible,false);});
test('uncleared parser and privacy risks block approval',()=>{const s=sample();s.rights.parser.status='unknown';assert.equal(evaluateRenderer(s).eligible,false);const t=sample();t.customerDataUsed=true;assert.equal(evaluateRenderer(t).eligible,false);});
test('poor quality and renderer failures cannot pass',()=>{const s=sample();s.cases[0].scores.identity=3;s.cases[1].status='failed';assert.equal(evaluateRenderer(s).eligible,false);assert.equal(evaluateRenderer(s).failures,1);});
test('unchanged person image and missing fixture provenance fail',()=>{const s=sample();s.cases[0].outputSha256=s.cases[0].personSha256;s.cases[1].provenance='customer';assert.equal(evaluateRenderer(s).eligible,false);});
test('performance limits, missing measurements and invalid limits fail',()=>{const s=sample();s.cases[0].latencyMs=31000;s.cases[1].costUsd=.11;s.cases[2].peakMemoryMiB=NaN;assert.equal(evaluateRenderer(s).eligible,false);assert.equal(evaluateRenderer(sample(),{maxLatencyMs:0,maxCostUsd:0}).eligible,false);});
