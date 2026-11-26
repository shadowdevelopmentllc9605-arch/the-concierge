import test from 'node:test';
import assert from 'node:assert/strict';
import {makeStyleVote,buildStyleFeedback,outfitFeedbackScore,outfitVoteValue,productFeedbackScore} from '../styleFeedback.js';
import {buildWardrobeOutfits} from '../wardrobeOutfits.js';
import {rankStyleProducts} from '../stylePersonalization.js';
const user='user-a';
const event=(target,value,date='2026-11-25T00:00:00Z',uid=user)=>({...makeStyleVote(uid,target,value),created_at:date});
const product=id=>({kind:'product',productId:id});
const outfit=(ids,occasion='casual')=>({kind:'outfit',itemIds:ids,occasion});
test('feedback uses only explicit own-account style events and ignores fit ratings',()=>{
 const model=buildStyleFeedback([event(product('a'),1,undefined,'user-b'),{...event(product('b'),1),feedback_type:'size_suggestion'},event(product('c'),1)],user);
 assert.equal(model.products.size,1);assert.equal(model.products.get('c'),1);
});
test('latest vote supersedes duplicate votes and neutral clears preference',()=>{
 const m=buildStyleFeedback([event(product('a'),1),event(product('a'),-1,'2026-11-26T00:00:00Z'),event(product('a'),0,'2026-11-27T00:00:00Z')],user);
 assert.equal(m.products.get('a'),0);
});
test('outfit preference is exact, order-independent, scoped to occasion and reversible',()=>{
 const m=buildStyleFeedback([event(outfit(['b','a']),1)],user);
 assert.equal(outfitVoteValue(m,'casual',['a','b']),1);
 assert.equal(outfitFeedbackScore(m,'formal',['a','b']),0);
 assert.equal(outfitFeedbackScore(m,'casual',['a','b']),5);
 assert.ok(outfitFeedbackScore(m,'casual',['a','c'])>0);
 const clear=buildStyleFeedback([event(outfit(['a','b']),1),event(outfit(['a','b']),0,'2026-11-26T00:00:00Z')],user);assert.equal(outfitFeedbackScore(clear,'casual',['a','b']),0);
});
test('outfit ranking responds to preference without adding or mixing nonexistent garments',()=>{
 const items=[{id:'a',item_type:'Shirt',color:'White',style_category:'casual'},{id:'b',item_type:'Pants',color:'Black',style_category:'casual'},{id:'c',item_type:'Pants',color:'Black',style_category:'casual'}];
 const m=buildStyleFeedback([event(outfit(['a','b']),-1),event(outfit(['a','c']),1)],user);
 const result=buildWardrobeOutfits(items,'casual',m).outfits[0];assert.ok(result.items.some(i=>i.id==='c'));assert.ok(!result.items.some(i=>i.id==='b'));assert.equal(result.complete,false);
});
test('product ranking learns but unavailable inventory never becomes eligible',()=>{
 const p=id=>({id,category:'jeans',brand:'A',price:50,in_stock:true});
 const items=[p('a'),p('b'),{...p('c'),in_stock:false}];
 const model=buildStyleFeedback([event(product('a'),-1),event(product('b'),1),event(product('c'),1)],user);
 const rows=rankStyleProducts(items,{},[],[],[],model);
 assert.equal(rows[0].product.id,'b');assert.equal(rows.length,2);
 assert.ok(productFeedbackScore(model,items[0],items)<0);
});
test('invalid targets and malformed outfit evidence are rejected',()=>{
 assert.throws(()=>makeStyleVote(user,outfit(['a','a']),1));
 assert.throws(()=>makeStyleVote(user,product('a'),99));
 const row={...event(outfit(['a','b']),1),feedback_text:'a|a'};
 assert.equal(buildStyleFeedback([row],user).outfits.size,0);
});
