import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OUTFIT_DEFAULT,OUTFIT_PALETTES,changeOutfit,buildOutfitPreview} from '../outfitPreview.js';
test('all 192 sample configurations produce valid paths without fit claims',()=>{
 let count=0;
 for(const base of ['separates','dress'])for(const outer of ['none','jacket'])for(const bottom of ['trousers','skirt'])for(const shoes of ['none','loafers'])for(const palette of Object.keys(OUTFIT_PALETTES))for(const preset of ['balanced','broader','longer','angled']){
  const plan=buildOutfitPreview({base,outer,bottom,shoes,palette,preset});
  assert.equal(plan.ok,true);assert.equal(plan.fitVerified,false);
  assert.equal(plan.scope,'synthetic_illustration');
  for(const path of plan.paths){assert.match(path.d,/^M .* Z$/);assert.doesNotMatch(path.d,/NaN|Infinity/);}
  count++;
 }
 assert.equal(count,192);
});
test('dress replaces separates and retains only optional jacket',()=>{
 const r=buildOutfitPreview({...OUTFIT_DEFAULT,base:'dress'});
 assert.deepEqual(r.paths.map(p=>p.role),['dress','shoe-left','shoe-right']);
 assert.deepEqual(r.layers.map(l=>l.type),['jacket']);assert.equal(r.layers[0].open,true);
});
test('separate skirt and trousers are mutually exclusive, footwear optional',()=>{
 const r=buildOutfitPreview({...OUTFIT_DEFAULT,bottom:'skirt',shoes:'none',outer:'none'});
 assert.deepEqual(r.paths.map(p=>p.role),['skirt']);assert.deepEqual(r.layers.map(l=>l.type),['shirt']);
 assert.deepEqual(buildOutfitPreview(OUTFIT_DEFAULT).paths.map(p=>p.role),['trouser-left','trouser-right','shoe-left','shoe-right']);
});
test('color and body preset affect the illustration',()=>{
 const a=buildOutfitPreview(OUTFIT_DEFAULT),b=buildOutfitPreview({...OUTFIT_DEFAULT,palette:'warm'}),c=buildOutfitPreview({...OUTFIT_DEFAULT,preset:'broader'});
 assert.notEqual(a.layers[0].baseColor,b.layers[0].baseColor);assert.notEqual(a.paths[0].fill,b.paths[0].fill);assert.notEqual(a.paths[0].d,c.paths[0].d);
});
test('unsupported controls fail closed and reset defaults stay immutable',()=>{
 assert.equal(changeOutfit(OUTFIT_DEFAULT,'palette','unknown'),OUTFIT_DEFAULT);
 assert.equal(changeOutfit(OUTFIT_DEFAULT,'__proto__','bad'),OUTFIT_DEFAULT);
 assert.equal(buildOutfitPreview({...OUTFIT_DEFAULT,base:'unknown'}).ok,false);
 assert.equal(buildOutfitPreview(null).ok,false);
 assert.equal(changeOutfit(OUTFIT_DEFAULT,'base','dress').base,'dress');assert.equal(OUTFIT_DEFAULT.base,'separates');
});
test('sample outfit UI does not access images, network or storage',()=>{
 const source=readFileSync(new URL('../../components/tryon/OutfitPreview.jsx',import.meta.url),'utf8');
 assert.match(source,/No personal photograph or retailer image/);
 assert.match(source,/Reset sample outfit/);
 assert.doesNotMatch(source,/fetch\(|https?:|localStorage|UploadPrivateFile|<image|<img/);
 const route=readFileSync(new URL('../../pages/TryOn.jsx',import.meta.url),'utf8');assert.match(route,/showDemo\?<><TryOnDemo\/><OutfitPreview\/><\/>/);
});
