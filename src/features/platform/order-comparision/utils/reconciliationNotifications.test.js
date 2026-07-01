import test from 'node:test';
import assert from 'node:assert/strict';

import { getPersistenceNotifications } from './reconciliationNotifications.js';

test('reports a successful database save without a Sheets warning', () => {
  const notifications = getPersistenceNotifications({
    persistence: {
      database: { ok: true, error: null },
      sheets: { ok: true, error: null },
    },
  });

  assert.deepEqual(notifications.map((notification) => notification.title), ['Database saved']);
});

test('distinguishes a Google Sheets failure from a successful database save', () => {
  const notifications = getPersistenceNotifications({
    persistence: {
      database: { ok: true, error: null },
      sheets: { ok: false, error: 'Worksheet unavailable' },
    },
  });

  assert.deepEqual(
    notifications.map((notification) => [notification.tone, notification.title]),
    [
      ['success', 'Database saved'],
      ['warning', 'Google Sheets failed'],
    ]
  );
  assert.equal(notifications[1].message, 'Worksheet unavailable');
});
