import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('saved profile exposes body photo preparation without restarting onboarding',()=>{
 const profile=read('src/pages/Profile.jsx'),panel=read('src/components/profile/ProfileBodyPhotos.jsx');
 assert.match(profile,/<ProfileBodyPhotos key=/);
 assert.match(panel,/Body Photos/);assert.match(panel,/Prepare or test a photo/);
 assert.match(panel,/<LocalPhotoPreparation\/>/);
 assert.doesNotMatch(panel,/onboarding_completed|onboarding_step|UserProfile\.create/);
});
test('stored scan reentry requires both gates, consent and matching account',()=>{
 const s=read('src/components/profile/ProfileBodyPhotos.jsx');
 assert.match(s,/VITE_PRIVATE_UPLOADS_ENABLED==='true'&&import\.meta\.env\.VITE_BODY_SCANS_ENABLED==='true'/);
 assert.match(s,/mode==='scan'&&privateScansEnabled/);
 assert.match(s,/Agree and open body scan/);
 assert.match(s,/user\?\.id!==userId/);assert.match(s,/row\.id===profile\.id&&row\.user_id===userId/);
 assert.match(s,/startsWith\('concierge-sensitive\/'\+userId\+'\/'\)/);
 assert.match(s,/Object\.keys\(data\|\|\{\}\)\.length/);
 assert.match(s,/UserProfile\.update\(owned\.id,patch\)/);
 assert.doesNotMatch(s,/Core\.UploadFile|localStorage|sessionStorage/);
});
test('paused body scan does not resolve existing private photo links',()=>{
 const source=read('src/components/onboarding/BodyScan.jsx');
 assert.match(source,/useEffect\(\(\) => \{\s*if \(!privateScansEnabled\) return;/);
});
