import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkPhotoFile,checkPhotoDimensions,inspectPhotoHeader,PHOTO_LIMITS} from '../tryOnPhoto.js';
function png(w,h,animated=false){
 const a=new Uint8Array(animated?57:45),v=new DataView(a.buffer);
 a.set([137,80,78,71,13,10,26,10]);
 v.setUint32(8,13);v.setUint32(12,0x49484452);v.setUint32(16,w);v.setUint32(20,h);
 if(animated)v.setUint32(37,0x6163544c);
 v.setUint32(animated?49:37,0x49454e44);
 return a;
}
function jpeg(w,h){
 const a=new Uint8Array(24);a.set([255,216,255,192,0,17,8]);
 const v=new DataView(a.buffer);v.setUint16(7,h);v.setUint16(9,w);
 return a;
}
test('file limits reject empty, oversized, and unsupported types',()=>{
 assert.equal(checkPhotoFile(null).ok,false);
 assert.equal(checkPhotoFile({size:0,type:'image/png'}).reason,'empty');
 assert.equal(checkPhotoFile({size:PHOTO_LIMITS.maxBytes+1,type:'image/jpeg'}).reason,'file_size');
 for(const type of ['image/svg+xml','image/gif','image/heic','text/html'])assert.equal(checkPhotoFile({size:12,type}).reason,'file_type');
 assert.equal(checkPhotoFile({size:12,type:'image/jpeg'}).ok,true);
});
test('dimensions bound decoded memory and reject low resolution',()=>{
 assert.equal(checkPhotoDimensions(400,900).reason,'too_small');
 assert.equal(checkPhotoDimensions(9000,1000).reason,'too_large');
 assert.equal(checkPhotoDimensions(6000,6000).reason,'too_large');
 assert.equal(checkPhotoDimensions(3000,4000).ok,true);
 assert.equal(checkPhotoDimensions(NaN,1000).reason,'invalid_image');
});
test('PNG and JPEG headers identify dimensions and actual format before decode',()=>{
 assert.deepEqual(inspectPhotoHeader(png(1000,1500),'image/png'),{ok:true,width:1000,height:1500,type:'image/png'});
 assert.deepEqual(inspectPhotoHeader(jpeg(3000,4000),'image/jpeg'),{ok:true,width:3000,height:4000,type:'image/jpeg'});
 assert.equal(inspectPhotoHeader(jpeg(1000,1500),'image/png').reason,'file_type');
 assert.equal(inspectPhotoHeader(png(1000,1500),'').ok,true);
});
test('malformed, oversized and animated image headers fail closed',()=>{
 assert.equal(inspectPhotoHeader(new Uint8Array(30),'image/jpeg').ok,false);
 assert.equal(inspectPhotoHeader(png(6000,6000)).reason,'too_large');
 assert.equal(inspectPhotoHeader(png(1000,1500,true)).reason,'file_type');
 assert.equal(inspectPhotoHeader(png(1000,1500).slice(0,34)).ok,false);
 assert.equal(inspectPhotoHeader(jpeg(1000,1500).slice(0,12)).ok,false);
});
test('local photo flow has explicit consent, bounded preview and cleanup without network or storage',()=>{
 const source=readFileSync(new URL('../../components/tryon/LocalPhotoPreparation.jsx',import.meta.url),'utf8');
 assert.match(source,/disabled=\{!consent\|\|busy\}/);
 assert.match(source,/inspectPhotoHeader/);assert.match(source,/createImageBitmap/);
 assert.match(source,/URL\.revokeObjectURL/);assert.match(source,/pagehide/);
 assert.match(source,/generation/);assert.match(source,/bitmap\?\.close/);
 assert.match(source,/previewDimensions\(bitmap\.width,bitmap\.height\)/);
 assert.doesNotMatch(source,/fetch\(|axios|localStorage|sessionStorage|indexedDB|UploadPrivateFile|supabase|https?:/);
 assert.match(source,/Pose, lighting and fit have not been assessed/);
});
