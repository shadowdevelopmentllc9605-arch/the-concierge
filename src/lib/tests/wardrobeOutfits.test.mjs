import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWardrobeOutfits,garmentRole} from '../wardrobeOutfits.js';
const item=(id,item_type,color='Navy',style_category='business')=>({id,item_type,color,style_category});
test('recognizes dress shirts as tops and complete dresses as one-piece garments',()=>{
 assert.equal(garmentRole('White dress shirt'),'top');assert.equal(garmentRole('Summer dress'),'onepiece');assert.equal(garmentRole('Suit jacket'),'layer');assert.equal(garmentRole('bra'),null);
});
test('creates an outfit using only distinct wardrobe records',()=>{
 const items=[item('a','Dress shirt','White'),item('b','Trousers'),item('c','Loafers','Brown'),item('a','Dress shirt','White')];
 const r=buildWardrobeOutfits(items,'business').outfits[0];assert.equal(r.complete,true);assert.equal(r.items.length,3);assert.equal(new Set(r.items.map(i=>i.id)).size,3);assert.deepEqual(r.items.map(i=>i.id),['a','b','c']);
});
test('missing garments are disclosed; no fictitious clothing is generated',()=>{
 assert.equal(buildWardrobeOutfits([item('a','Shirt')],'business').outfits.length,0);
 const r=buildWardrobeOutfits([item('a','Dress shirt'),item('b','Pants')],'business').outfits[0];assert.equal(r.complete,false);assert.deepEqual(r.missing,['Footwear']);
});
test('one-piece outfits do not require separate tops or bottoms',()=>{
 const r=buildWardrobeOutfits([item('a','Evening dress','Black','evening'),item('b','Heels','Black','evening')],'evening').outfits[0];assert.equal(r.complete,true);assert.equal(r.items.length,2);
});
test('explicitly incompatible styles are excluded and neutral coordination is preferred',()=>{
 const items=[item('a','Dress shirt','Red'),item('b','Pants','Green'),item('c','Pants','Black'),item('d','Sneakers','Blue','active')];
 const r=buildWardrobeOutfits(items,'business').outfits[0];assert.ok(r.items.some(i=>i.id==='c'));assert.ok(!r.items.some(i=>i.id==='d'));
});
test('outfits are stable and bounded for large wardrobes',()=>{
 const items=Array.from({length:300},(_,i)=>item(String(i),['Shirt','Pants','Loafers'][i%3]));
 const a=buildWardrobeOutfits(items,'business');assert.equal(a.outfits.length,3);assert.deepEqual(a,buildWardrobeOutfits(items,'business'));
});
