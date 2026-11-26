// Deterministic wardrobe coordination from saved item names, colors and styles.
// No generated product claims, images, remote AI calls or fit guarantees.
export const OUTFIT_OCCASIONS = ['business','casual','formal','evening','outdoor','active','nightlife','trendy'];
const token = v => String(v ?? '').trim().toLowerCase();
const neutral = new Set(['black','white','gray','grey','navy','brown','beige','cream','tan','ivory']);
const colors = new Set([...neutral,'red','blue','green','pink','purple','orange','yellow','burgundy','olive','multi']);
const harmonies = new Set(['blue|green','blue|pink','blue|orange','green|yellow','pink|purple','pink|red','purple|yellow','burgundy|olive']);
export function garmentRole(name) {
  const s=token(name).replace(/[_-]/g,' ');
  if (/\b(swimsuit|swimwear|bikini|underwear|bra|lingerie|pajamas|sleepwear)\b/.test(s)) return null;
  if (/\b(shoes?|sneakers?|loafers?|boots?|heels?|sandals?|pumps?|oxfords?|flats?|trainers?)\b/.test(s)) return 'shoes';
  if (/\b(suits?|jumpsuits?|rompers?|gowns?)\b/.test(s) && !/\b(suit jacket|suit pants|suit trousers|tracksuit jacket)\b/.test(s)) return 'onepiece';
  if (/\b(coats?|parkas?|blazers?|jackets?|cardigans?|outerwear)\b/.test(s)) return 'layer';
  if (/\b(pants|trousers?|jeans|shorts|skirts?|khakis|chinos|leggings|slacks)\b/.test(s)) return 'bottom';
  if (/\b(shirts?|tshirts?|tees?|polos?|blouses?|sweaters?|hoodies?|tops?|tanks?|vests?|pullovers?)\b/.test(s)) return 'top';
  if (/\b(dress|dresses)\b/.test(s)) return 'onepiece';
  return null;
}
const colorOf = item => colors.has(token(item.color)) ? token(item.color) : '';
function colorScore(a,b) {
  if(!a||!b||a==='multi'||b==='multi') return 0;
  if(a===b||neutral.has(a)||neutral.has(b)) return 2;
  return harmonies.has([a,b].sort().join('|'))?1:-2;
}
function styleScore(item,occasion) {
  const s=token(item.style_category);
  if(s===occasion) return 5;
  const nearby={business:['formal','evening'],casual:['trendy','outdoor'],formal:['business','evening'],evening:['formal','nightlife','business'],outdoor:['casual','active'],active:['outdoor'],nightlife:['evening','trendy'],trendy:['casual','nightlife']};
  if(nearby[occasion]?.includes(s)) return 1;
  return !s||s==='other'?0:-5;
}
export function buildWardrobeOutfits(items=[],occasion='casual') {
  if(!OUTFIT_OCCASIONS.includes(occasion)) occasion='casual';
  const seen=new Set(), groups={top:[],bottom:[],onepiece:[],shoes:[],layer:[]};
  for(const item of items) {
    if(!item?.id||seen.has(item.id)) continue;
    seen.add(item.id);
    const role=garmentRole(item.item_type);
    if(!role) continue;
    const score=styleScore(item,occasion);
    if(score<0) continue;
    groups[role].push({item,role,score});
  }
  for(const key of Object.keys(groups)) groups[key]=groups[key].sort((a,b)=>b.score-a.score||String(a.item.id).localeCompare(String(b.item.id))).slice(0,12);
  const bases=groups.onepiece.map(x=>[x]);
  for(const top of groups.top) for(const bottom of groups.bottom) bases.push([top,bottom]);
  const candidates=[];
  for(const base of bases) {
    for(const shoe of groups.shoes.length?groups.shoes:[null]) {
      const core=shoe?[...base,shoe]:base;
      const layerChoices=['outdoor','business','formal','evening'].includes(occasion)&&!base.some(x=>x.role==='onepiece'&&/\bsuits?\b/.test(token(x.item.item_type)))?[null,...groups.layer]:[null];
      for(const layer of layerChoices) {
        const parts=layer?[...core,layer]:core;
        let score=parts.reduce((sum,x)=>sum+x.score,0)/parts.length;
        for(let i=0;i<parts.length;i++) for(let j=i+1;j<parts.length;j++) score+=colorScore(colorOf(parts[i].item),colorOf(parts[j].item))/parts.length;
        if(layer&&occasion==='outdoor') score+=2;
        if(shoe) score+=2;
        const missing=shoe?[]:['Footwear'];
        if(occasion==='outdoor'&&!layer) missing.push('Weather-appropriate outerwear (if needed)');
        const signature=parts.map(x=>String(x.item.id)).sort().join('|');
        candidates.push({id:signature,occasion,items:parts.map(x=>x.item),missing,score,complete:missing.length===0});
      }
    }
  }
  candidates.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  const results=[], usedBases=new Set();
  for(const candidate of candidates) {
    const key=candidate.items.filter(i=>['top','bottom','onepiece'].includes(garmentRole(i.item_type))).map(i=>i.id).sort().join('|');
    if(usedBases.has(key)) continue;
    usedBases.add(key);results.push(candidate);
    if(results.length===3) break;
  }
  return {outfits:results,missing:results.length?[]:[...(!groups.onepiece.length&&!groups.top.length?['Top or one-piece outfit']:[]),...(!groups.onepiece.length&&!groups.bottom.length?['Bottoms or one-piece outfit']:[])]};
}
