import test from 'node:test';
import assert from 'node:assert/strict';
import {FITTING_PRESETS,syntheticPose,createTorsoFrame,alignGarment,torsoPoint,svgPoints} from '../virtualFittingGeometry.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,a+' != '+b);
test('every synthetic body and supported garment yields bounded finite geometry',()=>{
 for(const preset of FITTING_PRESETS)for(const garment of ['demo-shirt','demo-jacket']){
  const result=alignGarment(syntheticPose(preset.id),300,390,garment);
  assert.equal(result.ok,true,preset.id+' '+garment+' '+result.reason);
  for(const p of [...result.body,...result.leftSleeve,...result.rightSleeve,...result.neck,...result.hem]){
   assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=300&&p.y>=0&&p.y<=390);
  }
 }
});
test('shoulder and hip landmarks anchor the torso independently',()=>{
 const f=createTorsoFrame(syntheticPose('broader'),300,390);assert.equal(f.ok,true);
 assert.deepEqual(torsoPoint(f,0,0),f.left.shoulder);assert.deepEqual(torsoPoint(f,1,1),f.right.hip);
 near(f.shoulderWidth,101);near(f.torsoLength,115);
});
test('broader shoulders and longer torsos produce corresponding garment changes',()=>{
 const base=alignGarment(syntheticPose('balanced'),300,390,'demo-shirt');
 const broad=alignGarment(syntheticPose('broader'),300,390,'demo-shirt');
 const long=alignGarment(syntheticPose('longer'),300,390,'demo-shirt');
 assert.ok(broad.body[4].x-broad.body[0].x>base.body[4].x-base.body[0].x);
 assert.ok(long.body[5].y>base.body[5].y);
});
test('scaled viewport doubles every coordinate without altering proportions',()=>{
 const a=alignGarment(syntheticPose('angled'),300,390,'demo-jacket');
 const b=alignGarment(syntheticPose('angled'),600,780,'demo-jacket');
 assert.equal(a.ok,true);assert.equal(b.ok,true);
 a.body.forEach((p,i)=>{near(b.body[i].x,2*p.x);near(b.body[i].y,2*p.y);});
});
test('tilted shoulder alignment follows the actual slope',()=>{
 const a=alignGarment(syntheticPose('angled'),300,390,'demo-shirt');
 assert.equal(a.ok,true);assert.ok(a.body[4].y>a.body[0].y);
 const angle=Math.atan2(a.body[4].y-a.body[0].y,a.body[4].x-a.body[0].x);
 near(angle,.11);
});
test('jacket sleeves follow elbows and wrists while short sleeves end on upper arms',()=>{
 const pose=syntheticPose('balanced');
 const a=alignGarment(pose,300,390,'demo-shirt'),b=alignGarment(pose,300,390,'demo-jacket');
 assert.equal(a.leftSleeve.length,4);assert.equal(b.leftSleeve.length,6);
 near((b.leftSleeve[2].x+b.leftSleeve[3].x)/2,b.frame.left.wrist.x);
 near((b.leftSleeve[2].y+b.leftSleeve[3].y)/2,b.frame.left.wrist.y);
 assert.ok(Math.max(...a.leftSleeve.map(p=>p.y))<Math.max(...b.leftSleeve.map(p=>p.y)));
});
test('missing, nonfinite, low confidence and out-of-frame landmarks are rejected',()=>{
 for(const invalid of [null,{x:NaN,y:.2,visibility:1},{x:.2,y:.2,visibility:.2},{x:1.1,y:.2,visibility:1}]){
  const p=syntheticPose();p[11]=invalid;assert.equal(alignGarment(p,300,390,'demo-shirt').ok,false);
 }
 assert.equal(alignGarment(syntheticPose(),0,390,'demo-shirt').ok,false);
});
test('collapsed torso, crossed arms and unsupported garments are rejected',()=>{
 const p=syntheticPose();p[11]={...p[12]};assert.equal(createTorsoFrame(p,300,390).ok,false);
 const q=syntheticPose();q[15]={...q[15],x:.2};assert.equal(createTorsoFrame(q,300,390).ok,false);
 assert.equal(alignGarment(syntheticPose(),300,390,'pants').reason,'unsupported_garment');
 assert.equal(alignGarment(syntheticPose(),300,390,'__proto__').ok,false);
});
test('SVG serialization is deterministic and does not emit invalid numbers',()=>{
 assert.equal(svgPoints([{x:1,y:2},{x:3.125,y:4.25}]),'1.00,2.00 3.13,4.25');
});
