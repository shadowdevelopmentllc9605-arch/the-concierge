// Local image preparation only. No upload, persistence or inference.
export const PHOTO_LIMITS=Object.freeze({maxBytes:10*1024*1024,minSide:480,maxSide:8192,maxPixels:24000000});
const fail=reason=>({ok:false,reason});
export function checkPhotoFile(file){
 if(!file||!Number.isSafeInteger(file.size)||file.size<=0)return fail('empty');
 if(file.size>PHOTO_LIMITS.maxBytes)return fail('file_size');
 if(!['image/jpeg','image/png',''].includes(file.type))return fail('file_type');
 return {ok:true};
}
export function checkPhotoDimensions(width,height){
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0)return fail('invalid_image');
 if(width<PHOTO_LIMITS.minSide||height<PHOTO_LIMITS.minSide)return fail('too_small');
 if(width>PHOTO_LIMITS.maxSide||height>PHOTO_LIMITS.maxSide||width*height>PHOTO_LIMITS.maxPixels)return fail('too_large');
 return {ok:true,width,height};
}
export function inspectPhotoHeader(bytes,mime=''){
 if(!(bytes instanceof Uint8Array)||bytes.length<24||bytes.length>PHOTO_LIMITS.maxBytes)return fail('invalid_image');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let type,width,height;
 if([137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)){
  type='image/png';
  if(v.getUint32(8)!==13||v.getUint32(12)!==0x49484452||bytes.length<33)return fail('invalid_image');
  width=v.getUint32(16);height=v.getUint32(20);
  // Reject animated PNG; inspect chunk boundaries before decoding.
  let p=8,ended=false,chunks=0;
  while(p+12<=bytes.length){
   if(++chunks>10000)return fail('invalid_image');
   const n=v.getUint32(p),tag=v.getUint32(p+4);
   if(n>bytes.length-p-12)return fail('invalid_image');
   if(tag===0x6163544c)return fail('file_type');
   p+=n+12;
   if(tag===0x49454e44){ended=n===0;break;}
  }
  if(!ended||p!==bytes.length)return fail('invalid_image');
 }else if(bytes[0]===255&&bytes[1]===216){
  type='image/jpeg';let p=2;
  const sof=[0xc0,0xc1,0xc2];
  while(p+4<=bytes.length){
   if(bytes[p++]!==255)return fail('invalid_image');
   while(p<bytes.length&&bytes[p]===255)p++;
   const marker=bytes[p++];
   if(marker===0xda||marker===0xd9||p+2>bytes.length)break;
   const len=v.getUint16(p);
   if(len<2||p+len>bytes.length)return fail('invalid_image');
   if(sof.includes(marker)){
    if(len<8)return fail('invalid_image');
    height=v.getUint16(p+3);width=v.getUint16(p+5);break;
   }
   p+=len;
  }
 }else return fail('file_type');
 if(mime&&mime!==type)return fail('file_type');
 const dims=checkPhotoDimensions(width,height);
 return dims.ok?{...dims,type}:dims;
}
export const PHOTO_MESSAGES=Object.freeze({empty:'Select a photo first.',file_size:'Choose a photo under 10 MB.',file_type:'Choose a still JPEG or PNG photo.',invalid_image:'This photo could not be read. Try another one.',too_small:'Use a photo at least 480 pixels on each side.',too_large:'This photo is too large to process safely. Choose a smaller image.'});
