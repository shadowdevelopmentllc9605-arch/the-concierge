// Shared catalog classification, not evidence that an image is licensed.
const groups={
 tops:['vests','dress_shirts','blouse','tshirts','polos','jackets','pattern_shirts','graphic_tees','sports_jackets'],
 bottoms:['pants','jeans','shorts','khakis','dress_skirts','skirts'],
 onepiece:['dresses','evening_dresses']
};
export function garmentCategory(category){
 return Object.keys(groups).find(k=>groups[k].includes(category))||null;
}
export function garmentCatalogStatus(product){
 if(!product||product.active===false||product.discontinued===true)return 'unavailable';
 if(!garmentCategory(product.category))return 'unsupported_category';
 if(!Array.isArray(product.variants)||!product.variants.some(v=>v?.id&&v.product_master_id===product.id&&v.active!==false&&typeof v.color_name==='string'&&v.color_name.trim()))return 'variant_review_required';
 return 'asset_review_required';
}
export function garmentVariantOptions(product){
 if(!product||!garmentCategory(product.category)||product.active===false||product.discontinued===true)return [];
 const variants=Array.isArray(product.variants)?product.variants:[];
 const unique=new Map();
 for(const v of variants){
  if(!v?.id||v.product_master_id!==product.id||v.active===false||typeof v.color_name!=='string'||!v.color_name.trim())continue;
  const size=typeof v.size_label==='string'?v.size_label.trim():'';
  if(unique.has(v.id))continue;
  unique.set(v.id,{id:v.id,color:v.color_name.trim(),size});
 }
 return [...unique.values()];
}
