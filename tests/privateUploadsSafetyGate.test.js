import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const adapter = readFileSync(new URL('../src/api/base44Client.js',import.meta.url),'utf8');

test('production private-image upload defaults to disabled until backup recovery is operational',()=>{
 const area=adapter.slice(adapter.indexOf('async UploadPrivateFile'), adapter.indexOf('async CreateFileSignedUrl'));
 assert.match(area,/import\.meta\.env\.VITE_PRIVATE_UPLOADS_ENABLED !== 'true'/);
 assert.match(area,/Private photo uploads are temporarily unavailable/);
 assert.match(area,/concierge-sensitive/);
 assert.doesNotMatch(area,/getPublicUrl\(/);
});

test('onboarding lets shoppers bypass paused body scans without uploading', () => {
 const bodyScan = readFileSync(new URL('../src/components/onboarding/BodyScan.jsx', import.meta.url), 'utf8');
 const onboarding = readFileSync(new URL('../src/pages/Onboarding.jsx', import.meta.url), 'utf8');
 assert.match(bodyScan,/VITE_PRIVATE_UPLOADS_ENABLED === 'true'/);
 assert.match(bodyScan,/if \(!privateScansEnabled\)/);
 assert.match(bodyScan,/Continue without body scan/);
 assert.match(bodyScan,/onClick=\{\(\) => onComplete\(\{\}\)\}/);
 assert.match(onboarding,/onboarding_step: nextStep/);
 assert.match(onboarding,/Your progress could not be saved/);
});
