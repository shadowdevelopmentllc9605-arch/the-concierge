import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('release does not register the narration-only QA route',()=>{
 const s=read('src/App.jsx');
 assert.doesNotMatch(s,/import TylerVoicePreview/);
 assert.doesNotMatch(s,/path="\/TylerVoicePreview"/);
 assert.match(s,/path !== 'TylerVoicePreview'/);
});
test('precision photo collection requires explicit scan and private upload flags',()=>{
 const s=read('src/pages/PrecisionScan.jsx');
 assert.match(s,/VITE_PRIVATE_UPLOADS_ENABLED !== 'true' \|\| import\.meta\.env\.VITE_BODY_SCANS_ENABLED !== 'true'/);
 assert.match(s,/return <PausedPrecisionScan \/>/);
 assert.match(read('src/pages/Profile.jsx'),/VITE_PRIVATE_UPLOADS_ENABLED === 'true' && import\.meta\.env\.VITE_BODY_SCANS_ENABLED === 'true'/);
});
test('wardrobe shows a truthful paused state without offering photo capture',()=>{
 const s=read('src/pages/Closet.jsx');
 assert.match(s,/if \(!wardrobeUploadsEnabled\) return/);
 assert.match(s,/wardrobeUploadsEnabled && <div className="ml-auto/);
 assert.match(s,/Wardrobe photo uploads are temporarily paused/);
});
