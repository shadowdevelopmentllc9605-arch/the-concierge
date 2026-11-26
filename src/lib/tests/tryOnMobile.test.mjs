import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPhotoJobGate,previewDimensions} from '../tryOnMobile.js';
test('photo jobs cannot overlap even when callers change or cancel',()=>{
 const gate=createPhotoJobGate();
 const first=gate.acquire();assert.equal(gate.isBusy(),true);
 for(let i=0;i<100;i++)assert.equal(gate.acquire(),null);
 first();assert.equal(gate.isBusy(),false);
 const second=gate.acquire();first();assert.equal(gate.isBusy(),true);second();assert.equal(gate.isBusy(),false);
});
test('preview size retains orientation and aspect ratio without enlarging photos',()=>{
 assert.deepEqual(previewDimensions(3000,4000),{width:900,height:1200});
 assert.deepEqual(previewDimensions(4000,3000),{width:1200,height:900});
 assert.deepEqual(previewDimensions(480,800),{width:480,height:800});
 assert.deepEqual(previewDimensions(8192,480),{width:1200,height:70});
 for(const [w,h] of [[0,1],[NaN,500],[1000,Infinity],[-1,200]])assert.equal(previewDimensions(w,h),null);
 assert.equal(previewDimensions(1000,1000,1300),null);
});
test('all admitted image shapes have bounded preview pixel allocation',()=>{
 for(let w=480;w<=8192;w+=97)for(let h=480;h<=8192;h+=113){
  if(w*h>24000000)continue;
  const d=previewDimensions(w,h);
  assert.ok(d.width<=1200&&d.height<=1200&&d.width*d.height<=1440000);
  assert.ok(d.width<=w&&d.height<=h);
 }
});
test('photo workflow releases decoding memory before encoding and unlocks only after cleanup',()=>{
 const s=readFileSync(new URL('../../components/tryon/LocalPhotoPreparation.jsx',import.meta.url),'utf8');
 assert.match(s,/photoJobGate\.acquire\(\)/);
 assert.match(s,/file\.slice\(0,file\.size,header\.type\)/);
 assert.ok(s.indexOf('bitmap.close();bitmap=null;')<s.indexOf('canvas.toBlob'));
 assert.match(s,/finally\{unlock\(\);if\(active\(\)\)setBusy\(false\);\}/);
 assert.doesNotMatch(s,/new Blob\(\[bytes\]/);
});
test('illustration controls use memoized geometry and mobile touch targets',()=>{
 for(const name of ['OutfitPreview','TryOnDemo']){
  const s=readFileSync(new URL('../../components/tryon/'+name+'.jsx',import.meta.url),'utf8');
  assert.match(s,/useMemo\(/);assert.match(s,/min-h-11/);
 }
});
