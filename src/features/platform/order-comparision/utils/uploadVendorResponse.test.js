import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRecoveredUploadPayload,
  findPoNumber,
  getPoNumberCandidatesFromFileName,
  resolveUploadPayload,
  wasPurchaseOrderRecentlyUpdated,
} from './uploadVendorResponse.js';

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

test('treats the direct n8n item array as success with a warning', () => {
  const payload = resolveUploadPayload([
    {
      ...persistenceWarningPayload,
      status: undefined,
    },
  ], false);

  assert.equal(payload.success, true);
  assert.equal(payload.persistence_warning, 'Google Sheets is temporarily unavailable.');
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

test('extracts PO candidates from uploaded PDF file names', () => {
  assert.deepEqual(
    getPoNumberCandidatesFromFileName('E-33343.pdf'),
    ['E-33343', 'E33343', '33343']
  );

  assert.deepEqual(
    getPoNumberCandidatesFromFileName('PO 33343 vendor.pdf'),
    ['PO 33343 vendor', '33343 vendor', 'PO 33343', 'PO-33343', 'PO33343', '33343']
  );
});

test('builds a recovered warning payload from a recently updated database row', () => {
  const startedAt = Date.parse('2026-07-03T14:00:00.000Z');
  const purchaseOrder = {
    dbRow: {
      po_number: 'E-33343',
      updated_at: '2026-07-03T14:00:03.000Z',
    },
    poNumber: 'E-33343',
    reconciliation: { po_number: 'E-33343' },
  };
  const payload = buildRecoveredUploadPayload(purchaseOrder, new Error('Upload response failed (502).'));

  assert.equal(wasPurchaseOrderRecentlyUpdated(purchaseOrder, startedAt), true);
  assert.equal(payload.success, true);
  assert.equal(payload.persistence.database.ok, true);
  assert.equal(payload.persistence.sheets.ok, false);
  assert.equal(findPoNumber(payload), 'E-33343');
});
