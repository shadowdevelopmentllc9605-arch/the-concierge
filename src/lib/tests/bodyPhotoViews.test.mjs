import test from 'node:test';
import assert from 'node:assert/strict';
import {BODY_PHOTO_VIEWS,BODY_PHOTO_SETUP} from '../bodyPhotoViews.js';
test('three immutable views provide distinct complete-body instructions',()=>{
 assert.deepEqual(BODY_PHOTO_VIEWS.map(v=>v.id),['front','side','back']);
 assert.match(BODY_PHOTO_VIEWS[0].instruction,/Face the camera directly/);
 assert.match(BODY_PHOTO_VIEWS[1].instruction,/90 degrees/);
 assert.match(BODY_PHOTO_VIEWS[2].instruction,/Turn away/);
 assert.equal(new Set(BODY_PHOTO_VIEWS.map(v=>v.instruction)).size,3);
 assert.ok(BODY_PHOTO_VIEWS.every(Object.isFrozen));
 assert.match(BODY_PHOTO_SETUP,/same camera position and distance/);
 assert.match(BODY_PHOTO_SETUP,/fully covering clothing/);
});
