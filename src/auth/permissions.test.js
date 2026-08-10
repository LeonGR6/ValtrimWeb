import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canModifyPurchaseOrders,
  getDefaultAuthenticatedPath,
  isPurchaseOrderReadOnlyUser,
  normalizeAppRoles,
} from './permissions.js';

test('normalizes roles from trusted app metadata', () => {
  assert.deepEqual(normalizeAppRoles({ roles: ['Admin', ' viewer ', 'ADMIN'] }), ['admin', 'viewer']);
  assert.deepEqual(normalizeAppRoles({ role: 'Viewer' }), ['viewer']);
});

test('viewer is read-only even when another role is also present', () => {
  const user = { roles: ['admin', 'viewer'] };

  assert.equal(isPurchaseOrderReadOnlyUser(user), true);
  assert.equal(canModifyPurchaseOrders(user), false);
  assert.equal(getDefaultAuthenticatedPath(user), '/order-comparison');
});

test('existing authenticated users without a viewer role keep edit access', () => {
  const user = { roles: [] };

  assert.equal(isPurchaseOrderReadOnlyUser(user), false);
  assert.equal(canModifyPurchaseOrders(user), true);
  assert.equal(getDefaultAuthenticatedPath(user), '/dashboard');
});

test('authorization roles are never read from user metadata', () => {
  const user = {
    app_metadata: {},
    user_metadata: { roles: ['viewer'] },
  };

  assert.equal(isPurchaseOrderReadOnlyUser(user), false);
});
