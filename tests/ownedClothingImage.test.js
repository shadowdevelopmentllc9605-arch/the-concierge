import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveOwnedClothingImage } from '../supabase/functions/concierge-actions/owned-image-path.mjs';

const project = 'https://isolated.example';
const owner = '11111111-2222-4333-8444-555555555555';
const other = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const ownPath = owner + '/qa-photo.jpg';

test('private closet image references resolve without public or signed URL exposure', () => {
  assert.deepEqual(resolveOwnedClothingImage({file_uri:'concierge-sensitive/'+ownPath},project,owner),{bucket:'concierge-sensitive',path:ownPath});
  assert.deepEqual(resolveOwnedClothingImage({file_url:project+'/storage/v1/object/sign/concierge-sensitive/'+ownPath+'?token=example'},project,owner),{bucket:'concierge-sensitive',path:ownPath});
  assert.deepEqual(resolveOwnedClothingImage({file_url:project+'/storage/v1/object/public/concierge-uploads/'+ownPath},project,owner),{bucket:'concierge-uploads',path:ownPath});
});

test('foreign owners, public sensitive paths, other hosts, traversal and encoded separators fail closed', () => {
  const bad = [
    {file_uri:'concierge-sensitive/'+other+'/qa-photo.jpg'},
    {file_uri:'concierge-uploads/'+ownPath},
    {file_uri:'concierge-sensitive/'+owner+'/../qa.jpg'},
    {file_uri:'concierge-sensitive/'+owner+'/qa.jpg?token=abc'},
    {file_url:'https://foreign.example/storage/v1/object/sign/concierge-sensitive/'+ownPath},
    {file_url:project+'/storage/v1/object/public/concierge-sensitive/'+ownPath},
    {file_url:project+'/storage/v1/object/sign/concierge-sensitive/'+other+'/qa-photo.jpg'},
    {file_url:project+'/storage/v1/object/sign/concierge-sensitive/'+owner+'%2Fqa.jpg'},
    {file_url:project+'/storage/v1/object/sign/concierge-sensitive/'+owner+'/%2E%2E/'+other+'/qa.jpg'},
    {file_url:project+'/storage/v1/object/sign/concierge-sensitive/'+owner+'/bad%5Cname.jpg'},
    {file_uri:'concierge-sensitive/'+owner+'/'},
    {}
  ];
  for(const payload of bad) assert.equal(resolveOwnedClothingImage(payload,project,owner),null,JSON.stringify(payload));
});

test('clothing analysis uses the signed-in caller Storage client and manual fallback preserves private URI', () => {
  const action=readFileSync(new URL('../supabase/functions/concierge-actions/index.ts',import.meta.url),'utf8');
  const area=action.slice(action.indexOf('if(name==="analyzeClothingItem")'),action.indexOf('if(name==="deleteMyData"'));
  assert.match(area,/resolveOwnedClothingImage\(payload,url,user.id\)/);
  assert.match(area,/client\.storage\.from\(owned\.bucket\)\.download\(owned\.path\)/);
  assert.doesNotMatch(area,/admin\.storage/);
  const closet=readFileSync(new URL('../src/pages/Closet.jsx',import.meta.url),'utf8');
  const upload=closet.slice(closet.indexOf('const handleUpload'),closet.indexOf('const removeItem'));
  assert.match(upload,/analyzeClothingItem', \{ file_uri \}/);
  assert.match(upload,/catch \{[\s\S]*analysisUnavailable = true/);
  assert.match(upload,/image: file_uri/);
  assert.match(upload,/Photo saved\. Automatic clothing analysis is unavailable/);
  assert.doesNotMatch(upload,/getPublicUrl/);
});
