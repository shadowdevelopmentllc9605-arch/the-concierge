import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syntheticPose,FITTING_PRESETS} from '../virtualFittingGeometry.js';
import {buildGarmentRenderPlan,roundedContour,RENDER_MODES,FABRICS} from '../garmentRenderPlan.js';
test('rounded contours are closed and use curves; malformed inputs are rejected',()=>{
 assert.match(roundedContour([{x:0,y:0},{x:10,y:0},{x:10,y:10}]),/^M .*Q .* Z$/);
 assert.equal(roundedContour([{x:0,y:0},{x:NaN,y:0},{x:10,y:10}]),'');
 assert.equal(roundedContour([{x:0,y:0}]),'');
});
test('every body preset and visualization mode produces finite curved render paths',()=>{
 for(const preset of FITTING_PRESETS)for(const mode of RENDER_MODES){
  const r=buildGarmentRenderPlan(syntheticPose(preset.id),300,390,mode);
  assert.equal(r.ok,true,preset.id+' '+mode);
  for(const l of r.layers){
   for(const p of [...l.panels,...l.sleeves,...l.seams,...l.folds])assert.ok(p.startsWith('M ')&&!/NaN|Infinity/.test(p));
   assert.equal(l.sleeves.length,2);
  }
 }
});
test('layered preview renders inner shirt before two open jacket panels',()=>{
 const r=buildGarmentRenderPlan(syntheticPose(),300,390,'layered');
 assert.deepEqual(r.layers.map(x=>x.type),['shirt','jacket']);
 assert.equal(r.layers[0].panels.length,1);assert.equal(r.layers[1].panels.length,2);
 assert.equal(r.layers[1].buttons.length,0);assert.equal(r.layers[1].open,true);
});
test('closed jacket and shirt have distinct material and construction details',()=>{
 const j=buildGarmentRenderPlan(syntheticPose(),300,390,'demo-jacket').layers[0];
 const s=buildGarmentRenderPlan(syntheticPose(),300,390,'demo-shirt').layers[0];
 assert.equal(j.buttons.length,3);assert.equal(s.buttons.length,0);
 assert.notEqual(FABRICS.jacket.texture,FABRICS.shirt.texture);
 assert.ok(j.seams.length>s.seams.length);
});
test('garment contours and seams respond to body proportion changes',()=>{
 const a=buildGarmentRenderPlan(syntheticPose('balanced'),300,390,'layered');
 const b=buildGarmentRenderPlan(syntheticPose('broader'),300,390,'layered');
 assert.notDeepEqual(a.layers,b.layers);
});
test('invalid pose and unknown render modes fail closed',()=>{
 assert.equal(buildGarmentRenderPlan([],300,390,'layered').ok,false);
 assert.equal(buildGarmentRenderPlan(syntheticPose(),300,390,'unknown').ok,false);
});
test('illustration uses local SVG materials with clipping and no external photo input',()=>{
 const source=readFileSync(new URL('../../components/tryon/GarmentLayers.jsx',import.meta.url),'utf8');
 assert.match(source,/linearGradient/);assert.match(source,/patternUnits/);assert.match(source,/clipPath/);
 assert.doesNotMatch(source,/fetch\(|https?:|UploadPrivateFile|<image/);
 const demo=readFileSync(new URL('../../components/tryon/TryOnDemo.jsx',import.meta.url),'utf8');
 assert.match(demo,/not a realistic fitting simulation/);assert.match(demo,/No personal photograph/);
});
