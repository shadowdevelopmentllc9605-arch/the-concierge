import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseTryOnProductId,resolveTryOnProduct,getTryOnProductState,getTryOnPriceLabel,DEMO_GARMENTS} from '../tryOnFoundation.js';
const id='a1234567-b123-c123-d123-e12345678901';
test('try-on links accept exact canonical product IDs and reject malformed links',()=>{
 assert.deepEqual(parseTryOnProductId('?id='+id),{id,invalid:false});
 assert.deepEqual(parseTryOnProductId('?product='+id.toUpperCase()),{id,invalid:false});
 assert.equal(parseTryOnProductId('?id=').invalid,true);
 assert.equal(parseTryOnProductId('?id=not-a-product').invalid,true);
 assert.deepEqual(parseTryOnProductId(''),{id:null,invalid:false});
});
test('a missing or inactive requested product never falls back to another garment',()=>{
 assert.equal(resolveTryOnProduct([{id:'other'}],id),null);
 assert.equal(resolveTryOnProduct([{id,active:false}],id),null);
 assert.equal(resolveTryOnProduct([{id,discontinued:true}],id),null);
 assert.equal(resolveTryOnProduct([{id}],id).id,id);
});
test('missing and unreviewed garment assets fail closed',()=>{
 assert.equal(getTryOnProductState(null),'missing');
 assert.equal(getTryOnProductState({id}),'asset_unavailable');
 assert.equal(getTryOnProductState({id,tryOn_image:'https://example.com/garment.png'}),'asset_review_required');
 assert.equal(getTryOnProductState({id,try_on_image_url:'https://example.com/garment.png'}),'asset_review_required');
});
test('unknown stock or price never appears as free or available',()=>{
 for(const p of [{price:null,in_stock:true},{price:0,in_stock:true},{price:50,in_stock:false},{price:NaN,in_stock:true}])assert.equal(getTryOnPriceLabel(p),'Price unavailable');
 assert.equal(getTryOnPriceLabel({price:50,in_stock:true}),'$50.00');
});
test('demonstration garments are isolated from the real catalog',()=>{
 assert.equal(DEMO_GARMENTS.length,2);
 assert.ok(DEMO_GARMENTS.every(x=>x.id.startsWith('demo-')&&!('price' in x)&&!('productId' in x)));
 const source=readFileSync(new URL('../../components/tryon/TryOnDemo.jsx',import.meta.url),'utf8');
 assert.match(source,/not a catalog item/);assert.match(source,/No personal photograph/);
});
test('try-on route fetches requested product directly and does not access private images',()=>{
 const source=readFileSync(new URL('../../pages/TryOn.jsx',import.meta.url),'utf8');
 assert.match(source,/Product\.filter\(\{id\}/);
 assert.doesNotMatch(source,/resolveFileUrl|downloadPrivateImagePreview|CreateFileSignedUrl|UploadPrivateFile|body_scan_front|<input[^>]*type="file"/);
 assert.match(source,/Generated try-on previews are temporarily paused/);
 assert.match(source,/LocalPhotoPreparation key=\{state\.userId/);
});
