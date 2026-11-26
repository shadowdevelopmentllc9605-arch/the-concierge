import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/pages/ProductDetail.jsx',import.meta.url),'utf8');
test('product heading and price stack vertically and wrap on narrow screens',()=>{
 const section=source.slice(source.indexOf('{/* Product Info */}'),source.indexOf('{/* Try On Button */}'));
 assert.match(section,/min-w-0 space-y-2/);
 assert.match(section,/<h1[^>]*break-words[^>]*>\{product.name\}<\/h1>/);
 assert.ok(section.indexOf('product.name')<section.indexOf('product.price'));
 assert.doesNotMatch(section,/flex justify-between/);
});
test('missing product imagery uses a compact honest placeholder without inventing an image',()=>{
 assert.match(source,/product.images\?\.\[0\] \? "aspect-square[^"]*" : "min-h-36/);
 assert.match(source,/Product image unavailable/);
 assert.match(source,/Number.isFinite\(product.price\) && product.price > 0/);
 assert.match(source,/Availability not verified/);
});
