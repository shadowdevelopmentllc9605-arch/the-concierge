import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../../../'+path,import.meta.url),'utf8');
test('shopper try-on does not wire offline provider or asset review to client',()=>{
 const files=['src/pages/TryOn.jsx','src/components/tryon/LocalPhotoPreparation.jsx','src/components/tryon/GarmentAssetStatus.jsx','src/components/tryon/TryOnDemo.jsx','src/components/tryon/OutfitPreview.jsx','src/lib/tryOnPhoto.js','src/lib/outfitPreview.js','src/lib/garmentCatalog.js'];
 for(const path of files)assert.doesNotMatch(read(path),/offlineRendererAdapter|evaluateRenderer|reviewGarmentAsset|service_role|UploadPrivateFile|CreateFileSignedUrl/);
});
test('photo component never calls network or persistence methods; consent and cleanup remain present',()=>{
 const s=read('src/components/tryon/LocalPhotoPreparation.jsx');
 assert.doesNotMatch(s,/fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB|supabase/);
 assert.match(s,/if\(!file\|\|!consent\)return/);
 assert.match(s,/URL\.revokeObjectURL/);
 assert.match(s,/photoJobGate\.acquire/);
});
test('catalog availability cannot masquerade as actual rendering or stock',()=>{
 const s=read('src/components/tryon/GarmentAssetStatus.jsx');
 assert.match(s,/Virtual try-on unavailable/);assert.match(s,/not a stock confirmation/);
 assert.doesNotMatch(s,/<img|<image|fetch\s*\(/);
});
