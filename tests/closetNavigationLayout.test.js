import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('fixed navigation uses a defined opaque fallback and closet reserves safe-area space',()=>{
 const layout=readFileSync(new URL('../src/Layout.jsx',import.meta.url),'utf8');
 const closet=readFileSync(new URL('../src/pages/Closet.jsx',import.meta.url),'utf8');
 assert.match(layout,/backgroundColor: 'var\(--color-surface, hsl\(var\(--background\)\)\)'/);
 assert.match(layout,/flex-1 min-w-0 flex-col/);
 assert.match(closet,/pb-\[calc\(7rem\+env\(safe-area-inset-bottom,0px\)\)\]/);
});
