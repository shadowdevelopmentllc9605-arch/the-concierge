// Offline intake only. All catalog records and review evidence must come from
// a trusted export; never accept shopper-supplied rights or object paths.
import {createHash} from 'node:crypto';
import {garmentCategory,garmentVariantOptions} from '../../src/lib/garmentCatalog.js';
import {inspectPhotoHeader,PHOTO_LIMITS} from '../../src/lib/tryOnPhoto.js';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function reviewGarmentAsset({product,asset,bytes,now}={}){
 const fail=reason=>({eligible:false,reason});
 if(!product||!uuid(product.id)||product.active!==true||product.discontinued===true||!asset||asset.productMasterId!==product.id)return fail('product_mismatch');
 const category=garmentCategory(product.category);
 if(!category||asset.category!==category)return fail('category_mismatch');
 const variant=garmentVariantOptions(product).find(v=>v.id===asset.variantId);
 if(!variant||!uuid(variant.id)||asset.color!==variant.color)return fail('variant_mismatch');
 const offer=Array.isArray(product.offers)&&product.offers.find(o=>o?.id===asset.offerId);
 if(!offer||!uuid(offer.id)||offer.active!==true||offer.product_master_id!==product.id||offer.product_variant_id!==variant.id||!uuid(offer.business_id)||offer.business_id!==asset.businessId)return fail('offer_mismatch');
 if(!Number.isFinite(now))return fail('invalid_review_time');
 const rights=asset.rights;
 if(rights?.status!=='commercially-cleared'||rights.scope!=='virtual_try_on_derivatives'||!nonempty(rights.evidence)||!nonempty(rights.reviewer)||!Number.isFinite(rights.validFrom)||!Number.isFinite(rights.validUntil)||rights.validFrom>now||rights.validUntil<=now||rights.revoked!==false)return fail('rights_not_verified');
 const review=asset.review;
 if(review?.status!=='approved'||!nonempty(review.reviewer)||review.frontView!==true||review.singleGarment!==true||review.colorMatched!==true||review.cleanBackground!==true||review.noPerson!==true||!Number.isFinite(review.reviewedAt)||review.reviewedAt>now)return fail('image_review_required');
 if(!(bytes instanceof Uint8Array)||bytes.length>PHOTO_LIMITS.maxBytes||!hash(asset.sha256)||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)return fail('image_integrity');
 const image=inspectPhotoHeader(bytes,asset.mimeType);
 if(!image.ok||!['image/jpeg','image/png'].includes(asset.mimeType))return fail('image_format');
 if(asset.width!==image.width||asset.height!==image.height)return fail('image_dimensions');
 return {eligible:true,productMasterId:product.id,variantId:variant.id,offerId:offer.id,businessId:offer.business_id,category,color:variant.color,sha256:asset.sha256,scope:'offline_intake',renderingEnabled:false};
}
