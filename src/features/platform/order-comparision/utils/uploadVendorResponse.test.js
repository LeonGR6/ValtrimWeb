import assert from 'node:assert/strict';
import test from 'node:test';

import { findPoNumber, resolveUploadPayload } from './uploadVendorResponse.js';

const persistenceWarningPayload = {
  success: false,
  status: 'PERSISTENCE_WARNING',
  user_message: 'The PO was saved, but Google Sheets could not be updated.',
  persistence: {
    database: { ok: true },
    sheets: { ok: false, error: 'Google Sheets is temporarily unavailable.' },
  },
  data: {
    po_number: 'PO-1042',
  },
};

test('treats a database-persisted response with data as success with a warning', () => {
  const payload = resolveUploadPayload(persistenceWarningPayload, false);

  assert.equal(payload.success, true);
  assert.equal(payload.persistence_warning, 'Google Sheets is temporarily unavailable.');
  assert.equal(findPoNumber(payload), 'PO-1042');
});

test('preserves workflow metadata when n8n wraps the response in an item json property', () => {
  const payload = resolveUploadPayload([{ json: persistenceWarningPayload }]);

  assert.equal(payload.success, true);
  assert.equal(payload.data.po_number, 'PO-1042');
});

test('still rejects a blocking workflow error', () => {
  assert.throws(
    () => resolveUploadPayload({
      ...persistenceWarningPayload,
      status: 'FLOW_ERROR',
      user_message: undefined,
      error_message: 'The workflow failed.',
    }),
    /The workflow failed/
  );
});

test('keeps ordinary successful data payloads navigable', () => {
  const payload = resolveUploadPayload({ data: { purchaseOrderNumber: 'PO-2048' } });

  assert.equal(findPoNumber(payload), 'PO-2048');
  assert.equal(findPoNumber('PO-4096'), 'PO-4096');
});
