import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {garmentCategory,garmentCatalogStatus,garmentVariantOptions} from '../../src/lib/garmentCatalog.js';
import {reviewGarmentAsset} from './reviewGarmentAsset.mjs';
const id=n=>'a1234567-b123-c123-d123-'+String(n).padStart(12,'0');
function sample(){
 const bytes=new Uint8Array(45),v=new DataView(bytes.buffer);
 bytes.set([137,80,78,71,13,10,26,10]);
 v.setUint32(8,13);v.setUint32(12,0x49484452);v.setUint32(16,1000);v.setUint32(20,1500);v.setUint32(37,0x49454e44);
 const product={id:id(1),category:'dress_shirts',active:true,variants:[{id:id(2),product_master_id:id(1),color_name:'Blue',size_label:'M',active:true}],offers:[{id:id(3),business_id:id(4),product_master_id:id(1),product_variant_id:id(2),active:true}]};
 const asset={productMasterId:id(1),variantId:id(2),offerId:id(3),businessId:id(4),category:'tops',color:'Blue',mimeType:'image/png',width:1000,height:1500,sha256:createHash('sha256').update(bytes).digest('hex'),rights:{status:'commercially-cleared',scope:'virtual_try_on_derivatives',evidence:'mock',reviewer:'mock',validFrom:1,validUntil:100,revoked:false},review:{status:'approved',reviewer:'mock',frontView:true,singleGarment:true,colorMatched:true,cleanBackground:true,noPerson:true,reviewedAt:1}};
 return {product,asset,bytes,now:10};
}
test('category mapping does not mistake skirts for one-piece garments or support suits and underwear',()=>{
 assert.equal(garmentCategory('skirts'),'bottoms');assert.equal(garmentCategory('dresses'),'onepiece');
 assert.equal(garmentCategory('suits'),null);assert.equal(garmentCategory('underwear'),null);
});
test('real variants stay tied to their parent product, with no generated options',()=>{
 const {product}=sample();product.variants.push({id:id(5),product_master_id:id(9),color_name:'Red'},{id:id(6),product_master_id:id(1),color_name:'Green',active:false});
 assert.deepEqual(garmentVariantOptions(product),[{id:id(2),color:'Blue',size:'M'}]);
 assert.equal(garmentCatalogStatus(product),'asset_review_required');
 assert.equal(garmentCatalogStatus({...product,variants:[]}),'variant_review_required');
 assert.equal(garmentCatalogStatus({...product,category:'shoes'}),'unsupported_category');
});
test('mock metadata and header qualify only for offline intake, never rendering',()=>{
 const result=reviewGarmentAsset(sample());assert.equal(result.eligible,true);assert.equal(result.renderingEnabled,false);assert.equal(result.scope,'offline_intake');
});
test('mismatched product, variant, color, offer and retailer fail closed',()=>{
 for(const [key,value] of [['productMasterId',id(9)],['variantId',id(9)],['color','Red'],['offerId',id(9)],['businessId',id(9)],['category','onepiece']]){
  const s=sample();s.asset[key]=value;assert.equal(reviewGarmentAsset(s).eligible,false,key);
 }
 const s=sample();s.product.offers[0].product_variant_id=null;assert.equal(reviewGarmentAsset(s).reason,'offer_mismatch');
});
test('missing, expired, revoked or wrong-purpose rights are rejected',()=>{
 for(const [key,value] of [['status','pending'],['validUntil',10],['revoked',true],['scope','catalog_display'],['evidence','']]){
  const s=sample();s.asset.rights[key]=value;assert.equal(reviewGarmentAsset(s).reason,'rights_not_verified');
 }
});
test('unreviewed, altered or mismatched images are rejected',()=>{
 const s=sample();s.asset.review.noPerson=false;assert.equal(reviewGarmentAsset(s).reason,'image_review_required');
 const t=sample();t.bytes[0]=0;assert.equal(reviewGarmentAsset(t).reason,'image_integrity');
 const u=sample();u.asset.width=999;assert.equal(reviewGarmentAsset(u).reason,'image_dimensions');
});
