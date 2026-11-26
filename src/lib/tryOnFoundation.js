// Catalog availability is distinct from demonstration rendering.
export function parseTryOnProductId(search='') {
  const params=new URLSearchParams(search);
  const raw=params.get('id')??params.get('product');
  if(raw===null)return {id:null,invalid:false};
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw))return {id:null,invalid:true};
  return {id:raw.toLowerCase(),invalid:false};
}
export function resolveTryOnProduct(rows=[],id) {
  return id?(rows.find(p=>String(p?.id).toLowerCase()===id&&p.active!==false&&p.discontinued!==true)||null):null;
}
export function getTryOnProductState(product) {
  if(!product)return 'missing';
  // Legacy URLs do not establish permission, transparency, or category alignment.
  // The real garment renderer stays unavailable until a verified asset pipeline exists.
  return product.tryOn_image||product.try_on_image_url?'asset_review_required':'asset_unavailable';
}
export function getTryOnPriceLabel(product) {
  return product?.in_stock===true&&Number.isFinite(product.price)&&product.price>0
    ? '$'+product.price.toFixed(2):'Price unavailable';
}
export const DEMO_GARMENTS=Object.freeze([
  {id:'demo-shirt',label:'Sample shirt',color:'#879cb7'},
  {id:'demo-jacket',label:'Sample jacket',color:'#b5a083'},
]);
