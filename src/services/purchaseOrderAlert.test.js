import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPurchaseOrderAlert,
  getPurchaseOrderAiSuggestionCount,
  getPurchaseOrderIssueCount,
  getPurchaseOrderIssueCounts,
} from './purchaseOrderAlert.js';

test('returns Review when AI approved data still contains discrepancies', () => {
  assert.equal(
    buildPurchaseOrderAlert({ ai_final_status: 'AI_APPROVED' }, { discrepancies_count: 2 }),
    'Review'
  );
});

test('returns OK only for a completed matching result without discrepancies', () => {
  assert.equal(
    buildPurchaseOrderAlert({ final_status: 'MATCH_TOTAL' }, { discrepancies_count: 0 }),
    'OK'
  );
});

test('returns Pending when no comparison result exists', () => {
  assert.equal(buildPurchaseOrderAlert({}, { discrepancies_count: 0 }), 'Pending');
});

test('returns Error when the comparison workflow reports a failure', () => {
  assert.equal(buildPurchaseOrderAlert({ status: 'FLOW_ERROR' }, {}), 'Error');
});

test('combines true discrepancies and warnings without counting AI suggestions as issues', () => {
  const counts = getPurchaseOrderIssueCounts(
    {
      summary: { discrepancies_count: 2, warnings_count: 1 },
      ai_differences: [{}, {}, {}],
      ai_suggested_matches: [{}, {}],
    },
    { discrepancies_count: 0 }
  );

  assert.deepEqual(counts, { discrepancies: 2, warnings: 1, total: 3 });
  assert.equal(getPurchaseOrderIssueCount({ ai_differences: [{}, {}] }), 0);
});

test('keeps AI suggestions as a separate informational count', () => {
  assert.equal(
    getPurchaseOrderAiSuggestionCount({
      ai_suggested_matches: [{}, {}],
      ai_differences: [{}],
    }),
    2
  );
});

test('does not count AI differences as AI suggestions by themselves', () => {
  assert.equal(
    getPurchaseOrderAiSuggestionCount({
      ai_differences: [{}, {}],
    }),
    0
  );
});

test('AI suggestions alone do not change a clear comparison to Review', () => {
  assert.equal(
    buildPurchaseOrderAlert(
      { final_status: 'MATCH_TOTAL', ai_suggested_matches: [{}, {}] },
      { discrepancies_count: 0, warnings_count: 0 }
    ),
    'OK'
  );
});

test('warnings require review even when no discrepancies exist', () => {
  assert.equal(
    buildPurchaseOrderAlert(
      { final_status: 'MATCH_TOTAL', warnings: [{ code: 'missing-date' }] },
      { discrepancies_count: 0 }
    ),
    'Review'
  );
});

test('informational grouped-line notes do not count as warnings', () => {
  assert.deepEqual(
    getPurchaseOrderIssueCounts(
      {
        warnings: [{ type: 'QB_GROUPED_LINES', severity: 'INFO' }],
      },
      { warnings_count: 1 }
    ),
    { discrepancies: 0, warnings: 0, total: 0 }
  );
});

test('prefers reconciled summary counts over stale row counters', () => {
  assert.deepEqual(
    getPurchaseOrderIssueCounts(
      {
        summary: { discrepancies_count: 0, warnings_count: 0 },
        discrepancias: [{ type: 'LINE_NOT_FOUND_IN_QB' }],
      },
      { discrepancies_count: 2, warnings_count: 1 }
    ),
    { discrepancies: 0, warnings: 0, total: 0 }
  );
});
