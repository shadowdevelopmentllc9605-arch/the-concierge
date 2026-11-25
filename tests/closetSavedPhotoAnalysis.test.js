import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const closet=readFileSync(new URL('../src/pages/Closet.jsx',import.meta.url),'utf8');
const editor=readFileSync(new URL('../src/components/closet/ClosetItemEditor.jsx',import.meta.url),'utf8');
test('saved garment reanalysis uses original private URI and requires explicit review',()=>{
 assert.match(closet,/onEdit=\{\(\) => setEditingItem\(item\)\}/);
 assert.match(closet,/analyzeClothingItem', \{ file_uri: editingItem.image \}/);
 assert.match(editor,/Analyze saved photo/);
 assert.match(editor,/Sends this clothing photo to the AI service/);
 assert.match(editor,/item_type: prev.item_type \|\| result.item_type.trim\(\)/);
 assert.match(editor,/Review them and tap Save Item/);
 assert.match(editor,/disabled=\{saving \|\| analyzing\}/);
});
