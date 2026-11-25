import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('selected clothing style categories use black background and white label in both themes',()=>{
 const s=readFileSync(new URL('../src/components/closet/ClosetItemEditor.jsx',import.meta.url),'utf8');
 const category=s.slice(s.indexOf('{/* Style Category */}'),s.indexOf('{/* Footer */}'));
 assert.match(category,/aria-pressed=\{formData.style_category === cat.id\}/);
 assert.match(category,/formData.style_category === cat.id\s*\? 'bg-black text-white'/);
 assert.doesNotMatch(category,/--color-accent/);
 assert.match(category,/\{cat.label\}/);
});
