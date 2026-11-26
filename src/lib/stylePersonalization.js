// Explainable local personalization; no remote AI calls or inferred inventory.
export const STYLE_CATEGORIES = Object.freeze({
  business: ['suits','vests','dress_shirts','pants','blouse','dress_skirts','sports_jackets','collar_stays','cufflinks','tie_bar','tie_chain','tie_pin','pocket_square','lapel_pin'],
  casual: ['polos','tshirts','jackets','jeans','shorts','khakis','dresses','skirts','jumpers','swimwear'],
  formal: ['suits','vests','dress_shirts','dresses','evening_dresses','sports_jackets'],
  evening: ['evening_dresses','dresses','suits','sports_jackets','pattern_shirts'],
  outdoor: ['coats','parkas','outerwear','jackets','boots','hats','swimwear'],
  active: ['tshirts','shorts','pants','jackets','shoes','boots','hats'],
  nightlife: ['pattern_shirts','graphic_tees','sports_jackets','evening_dresses'],
  trendy: [],
});
const token = value => String(value ?? '').trim().toLowerCase().replace(/[ -]+/g,'_');
const list = values => Array.isArray(values) ? values.map(token).filter(Boolean) : [];
export function productMatchesStyle(product, style) {
  const key = token(style);
  if (!Object.hasOwn(STYLE_CATEGORIES,key)) return false;
  const explicit = [...list(product?.occasion_tags), ...list(product?.activity_tags), token(product?.style_type), token(product?.style_category)];
  return explicit.includes(key) || STYLE_CATEGORIES[key].includes(token(product?.category));
}
export function rankStyleProducts(products = [], profile = {}, closet = [], purchases = [], wishlist = []) {
  const preferences = [...new Set(list(profile.style_preferences))].filter(x=>Object.hasOwn(STYLE_CATEGORIES,x));
  const wardrobeStyles = [...new Set(closet.map(x=>token(x.style_category)))].filter(x=>Object.hasOwn(STYLE_CATEGORIES,x));
  const byId = new Map(products.map(p=>[p.id,p]));
  const bought = new Set(purchases.map(p=>p.product_id).filter(Boolean));
  const saved = new Set(wishlist.map(p=>p.product_id).filter(Boolean));
  const boughtBrands = new Set([...bought].map(id=>token(byId.get(id)?.brand)).filter(Boolean));
  const boughtCategories = new Set([...bought].map(id=>token(byId.get(id)?.category)).filter(Boolean));
  return products.filter(p=>p.id && p.active!==false && p.discontinued!==true && p.in_stock===true && Number.isFinite(p.price) && p.price>0).map(product=>{
    let score=0; const reasons=[];
    if (preferences.some(s=>productMatchesStyle(product,s))) {score+=5;reasons.push('Matches your selected styles');}
    if (wardrobeStyles.some(s=>productMatchesStyle(product,s))) {score+=2;reasons.push('Similar to styles in your closet');}
    if (boughtBrands.has(token(product.brand))) {score+=3;reasons.push('A brand you have purchased');}
    if (boughtCategories.has(token(product.category))) score+=2;
    if (saved.has(product.id)) {score+=3;reasons.push('Saved in your wishlist');}
    if (bought.has(product.id)) score-=4;
    if (product.is_new===true) score+=1;
    return {product,score,reasons};
  }).sort((a,b)=>b.score-a.score || String(a.product.id).localeCompare(String(b.product.id)));
}
