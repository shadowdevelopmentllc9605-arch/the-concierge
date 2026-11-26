// Only explicit, versioned, per-user style votes influence taste. No physical-fit inference.
export const OUTFIT_VOTE='outfit_preference_v1';
export const PRODUCT_VOTE='product_preference_v1';
const occasions=new Set(['business','casual','formal','evening','outdoor','active','nightlife','trendy']);
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function outfitSignature(ids) {
  if(!Array.isArray(ids)||ids.length<1||ids.length>4||!ids.every(validId)||new Set(ids).size!==ids.length) return '';
  return [...ids].sort().join('|');
}
export function makeStyleVote(userId,target,value) {
  if(!validId(userId)||![-1,0,1].includes(value)) throw Error('Invalid style feedback');
  const common={user_id:userId,rating:value===1?5:value===-1?1:3,was_helpful:value===0?null:value===1};
  if(target.kind==='outfit'){
    const signature=outfitSignature(target.itemIds);
    if(!signature||!occasions.has(target.occasion)) throw Error('Invalid outfit');
    return {...common,feedback_type:'style_match',actual_outcome:OUTFIT_VOTE,category:target.occasion,feedback_text:signature};
  }
  if(target.kind==='product'&&validId(target.productId))return {...common,feedback_type:'recommendation',actual_outcome:PRODUCT_VOTE,product_master_id:target.productId};
  throw Error('Invalid recommendation');
}
export function buildStyleFeedback(rows=[],userId) {
  const products=new Map(), outfits=new Map();
  if(!validId(userId))return {products,outfits};
  const ordered=rows.filter(r=>r?.user_id===userId&&[1,3,5].includes(r.rating)).sort((a,b)=>{
    const delta=(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0);
    return delta||String(b.id||'').localeCompare(String(a.id||''));
  });
  for(const row of ordered){
    const value=row.rating===5?1:row.rating===1?-1:0;
    if(row.feedback_type==='recommendation'&&row.actual_outcome===PRODUCT_VOTE&&validId(row.product_master_id)){
      if(!products.has(row.product_master_id))products.set(row.product_master_id,value);
    }
    if(row.feedback_type==='style_match'&&row.actual_outcome===OUTFIT_VOTE&&occasions.has(row.category)&&typeof row.feedback_text==='string'){
      const ids=row.feedback_text.split('|'),signature=outfitSignature(ids);
      if(signature!==row.feedback_text)continue;
      const key=row.category+':'+signature;
      if(!outfits.has(key))outfits.set(key,{value,occasion:row.category,ids});
    }
  }
  return {products,outfits};
}
export function outfitVoteValue(model,occasion,ids){
  return model?.outfits?.get(occasion+':'+outfitSignature(ids))?.value??0;
}
export function outfitFeedbackScore(model,occasion,ids){
  if(!model?.outfits)return 0;
  const signature=outfitSignature(ids);
  if(!signature)return 0;
  const exact=outfitVoteValue(model,occasion,ids);
  const related=[];
  for(const row of model.outfits.values()){
    if(row.occasion!==occasion||outfitSignature(row.ids)===signature||!row.value)continue;
    const overlap=row.ids.filter(id=>ids.includes(id)).length;
    if(overlap)related.push(row.value*overlap/Math.max(ids.length,row.ids.length));
  }
  return exact*5+(related.length?clamp(related.reduce((a,b)=>a+b,0)/related.length,-1,1)*1.5:0);
}
export function productFeedbackScore(model,product,products){
  const direct=model?.products?.get(product.id)??0;
  if(!model?.products)return 0;
  const byId=new Map(products.map(p=>[p.id,p]));
  const related=[];
  for(const [id,v] of model.products){
    if(id===product.id||!v)continue;
    const other=byId.get(id);
    if(!other)continue;
    let weight=0;
    if(product.brand&&other.brand===product.brand)weight+=0.7;
    if(product.category&&other.category===product.category)weight+=0.3;
    if(weight)related.push(v*weight);
  }
  return direct*6+(related.length?clamp(related.reduce((a,b)=>a+b,0)/related.length,-1,1)*2:0);
}
