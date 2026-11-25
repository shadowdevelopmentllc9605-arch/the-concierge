import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('vision provider diagnostics do not log image, key or provider message',()=>{
 const s=readFileSync(new URL('../supabase/functions/concierge-actions/index.ts',import.meta.url),'utf8');
 assert.match(s,/concierge_vision_provider_failure",JSON.stringify\(\{status:response.status,code:safeCode\}\)/);
 assert.match(s,/allowedCodes.includes\(reportedCode\)/);
 assert.match(s,/concierge_vision_invalid_json/);
});
test('clothing editor uses an opaque body portal above fixed navigation',()=>{
 const s=readFileSync(new URL('../src/components/closet/ClosetItemEditor.jsx',import.meta.url),'utf8');
 assert.match(s,/return createPortal\(/);
 assert.match(s,/document.body/);
 assert.match(s,/z-\[100\]/);
 assert.match(s,/bg-white dark:bg-slate-900/);
});
