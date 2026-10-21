import test from 'node:test';
import assert from 'node:assert/strict';
import { removeAndVerifyTestObject } from '../phase1_verified_cleanup.mjs';

const path = 'synthetic-owner/test.png';

function fixture({ ownerDeletes = false, adminDeletes = true, listError = false } = {}) {
  const existing = new Set([path]);
  let adminRemoveCalls = 0;
  let listCalls = 0;
  const client = {
    storage: {
      from() {
        return { async remove(keys) {
          if (ownerDeletes) keys.forEach((key) => existing.delete(key));
          return { data: [], error: null };
        } };
      },
    },
  };
  const admin = {
    storage: {
      from() {
        return {
          async list(folder, { search }) {
            listCalls++;
            if (listError) return { data: null, error: { message: 'listing denied' } };
            return {
              data: [...existing].filter((key) => key.startsWith(folder + '/') && key.endsWith('/' + search)).map(() => ({ name: search })),
              error: null,
            };
          },
          async remove(keys) {
            adminRemoveCalls++;
            if (adminDeletes) keys.forEach((key) => existing.delete(key));
            return { data: [], error: null };
          },
        };
      },
    },
  };
  return { client, admin, existing, getAdminCalls: () => adminRemoveCalls, getListCalls: () => listCalls };
}

test('owner deletion success is independently verified', async () => {
  const x = fixture({ ownerDeletes: true });
  await removeAndVerifyTestObject({ ...x, bucket: 'concierge-uploads', path });
  assert.equal(x.existing.size, 0);
  assert.equal(x.getAdminCalls(), 0);
  assert.equal(x.getListCalls(), 2 - 1); // only post-owner absence check needed
});

test('silent successful delete with retained bytes triggers admin removal', async () => {
  const x = fixture();
  await removeAndVerifyTestObject({ ...x, bucket: 'concierge-uploads', path });
  assert.equal(x.existing.size, 0);
  assert.equal(x.getAdminCalls(), 1);
  assert.equal(x.getListCalls(), 2);
});

test('refuses cleanup success when both deletes silently do nothing', async () => {
  const x = fixture({ adminDeletes: false });
  await assert.rejects(() => removeAndVerifyTestObject({ ...x, bucket: 'concierge-uploads', path }), /still exists/);
  assert.equal(x.existing.size, 1);
  assert.equal(x.getAdminCalls(), 1);
});

test('refuses success if independent Storage listing fails', async () => {
  const x = fixture({ listError: true });
  await assert.rejects(() => removeAndVerifyTestObject({ ...x, bucket: 'concierge-sensitive', path }), /independently verify/);
});

test('refuses unsafe paths before mutation', async () => {
  const x = fixture();
  for (const invalid of ['x.png', '/x.png', '../x.png', 'bad/../x.png']) {
    await assert.rejects(() => removeAndVerifyTestObject({ ...x, bucket: 'concierge-sensitive', path: invalid }), /Unsafe/);
  }
  assert.equal(x.existing.size, 1);
});
