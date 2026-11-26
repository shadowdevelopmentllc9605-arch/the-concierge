import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {authEventAction,createAuthEpoch} from '../authRevalidation.js';
test('camera return and repeat sign-in for verified account revalidate without resetting UI',()=>{
 for(let i=0;i<1000;i++)assert.equal(authEventAction('SIGNED_IN','shopper-a','shopper-a'),'background');
 assert.equal(authEventAction('USER_UPDATED','shopper-a','shopper-a'),'background');
 assert.equal(authEventAction('TOKEN_REFRESHED','shopper-a','shopper-a'),'ignore');
});
test('different account, initial sign-in and sign-out cannot reuse prior UI',()=>{
 assert.equal(authEventAction('SIGNED_IN','shopper-b','shopper-a'),'blocking');
 assert.equal(authEventAction('SIGNED_IN','shopper-a',null),'blocking');
 assert.equal(authEventAction('SIGNED_OUT',null,'shopper-a'),'clear');
 assert.equal(authEventAction('SIGNED_IN',null,'shopper-a'),'clear');
});
test('stale verification cannot restore state after sign-out or account switch',()=>{
 const epoch=createAuthEpoch();
 const previous=epoch.advance(),next=epoch.advance();
 assert.equal(epoch.isCurrent(previous),false);assert.equal(epoch.isCurrent(next),true);
 epoch.advance();assert.equal(epoch.isCurrent(next),false);
});
test('auth provider retains UI only for same account and still verifies with server',()=>{
 const source=readFileSync(new URL('../AuthContext.jsx',import.meta.url),'utf8');
 assert.match(source,/if\(!background\)\{[\s\S]*?setIsLoadingAuth\(true\)/);
 assert.match(source,/await base44\.auth\.me\(\)/);
 assert.match(source,/currentUser\.id!==expectedId/);
 assert.match(source,/if\(!epoch\.current\.isCurrent\(revision\)\)return/);
 assert.match(source,/if\(action==='clear'\)\{clearAuth\(\);return;\}/);
 assert.match(source,/if\(!epoch\.current\.isCurrent\(eventRevision\)\)return/);
 assert.match(source,/background:action==='background'/);
 const app=readFileSync(new URL('../../App.jsx',import.meta.url),'utf8');
 assert.match(app,/<Routes key=\{user\?\.id \|\| 'anonymous'\}>/);
});
