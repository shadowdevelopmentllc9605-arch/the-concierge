import test from 'node:test';
import assert from 'node:assert/strict';
import {productMatchesStyle,rankStyleProducts} from '../stylePersonalization.js';
const product=(id,category,extra={})=>({id,category,active:true,in_stock:true,price:50,...extra});
test('style matching uses clothing categories and explicit tags rather than equating product type with style',()=>{
 assert.equal(productMatchesStyle(product('a','dress_shirts'),'business'),true);
 assert.equal(productMatchesStyle(product('a','jeans'),'business'),false);
 assert.equal(productMatchesStyle(product('a','jeans',{occasion_tags:['trendy']}),'trendy'),true);
 assert.equal(productMatchesStyle(product('a','jeans'),'trendy'),false);
});
test('ranked recommendations use selected preferences and existing closet styles',()=>{
 const rows=rankStyleProducts([product('a','jeans'),product('b','dress_shirts')],{style_preferences:['business']},[{style_category:'business'}]);
 assert.equal(rows[0].product.id,'b');assert.equal(rows[0].score,7);assert.equal(rows[0].reasons.length,2);
});
test('unverified, missing-price and inactive products cannot become shopping recommendations',()=>{
 assert.deepEqual(rankStyleProducts([product('a','jeans',{in_stock:false}),product('b','jeans',{price:null}),product('c','jeans',{active:false}),product('d','jeans',{in_stock:undefined})]),[]);
});
test('wishlist and purchase history are grounded in actual records',()=>{
 const rows=rankStyleProducts([product('a','jeans',{brand:'A'}),product('b','jeans',{brand:'A'}),product('c','jeans',{brand:'B'})],{},[],[{product_id:'a'}],[{product_id:'b'}]);
 assert.equal(rows[0].product.id,'b');assert.ok(rows[0].reasons.includes('Saved in your wishlist'));
});
