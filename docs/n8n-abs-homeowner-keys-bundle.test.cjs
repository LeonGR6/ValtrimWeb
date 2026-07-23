const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const docsDirectory = __dirname;
const reconcileSource = fs.readFileSync(
  path.join(docsDirectory, 'n8n-reconcile-v2-code-node.js'),
  'utf8'
);
const cleanSource = fs.readFileSync(
  path.join(docsDirectory, 'n8n-build-final-clean-json.js'),
  'utf8'
);

function runCodeNode(source, json) {
  const execute = new Function('$input', source);
  const result = execute({
    first: () => ({ json, binary: {} }),
  });

  return result[0].json;
}

function pdfLines({
  cutQty = 24,
  keyblankQty = 24,
  cutExtdPrice = cutQty * 1.2,
  keyblankExtdPrice = 29.02,
} = {}) {
  return [
    {
      line: '13',
      item_id: '9LAB003',
      description: 'CUT KEYS STANDARD',
      ordered: cutQty,
      unit_price: 1.2,
      extd_price: cutExtdPrice,
    },
    {
      line: '12',
      item_id: '9SCH35100C',
      description: 'SCH, KEYBLANK, 35-100C',
      ordered: keyblankQty,
      unit_price: 3.1,
      extd_price: keyblankExtdPrice,
    },
  ];
}

function qbHomeownerKeysLine({ qty = 24, rate = 2.4091667, amount = 57.82 } = {}) {
  return {
    qb_line_num: '9',
    qb_description: 'Schlage - Set of (4) Home Owners Keys | Qty: 6',
    qb_qty: qty,
    qb_rate: rate,
    qb_amount: amount,
  };
}

function reconciliationInput({
  supplier = 'American Building Supply',
  pdf = pdfLines(),
  qb = [qbHomeownerKeysLine()],
} = {}) {
  return {
    pdfData: {
      supplier,
      po_number: '33484',
      line_items: pdf,
    },
    qbData: {
      qb_po_number: '33484',
      qb_vendor_name: supplier,
      qb_line_items: qb,
    },
  };
}

function runReconciliation(options) {
  return runCodeNode(reconcileSource, reconciliationInput(options));
}

{
  const result = runReconciliation();
  const row = result.matched_lines[0];

  assert.equal(result.matched_lines.length, 1);
  assert.equal(result.discrepancias.length, 0);
  assert.equal(row.status, 'MATCHED');
  assert.equal(row.match_rule, 'ABS_HOMEOWNER_KEYS_BUNDLE');
  assert.equal(row.match_type, 'MANY_PDF_TO_ONE_QB');
  assert.equal(row.pdf_qty, '24, 24');
  assert.equal(row.pdf_unit_price, '1.2, 1.21');
  assert.equal(row.pdf_extd_price, 57.82);
  assert.equal(row.qb_qty, 24);
  assert.equal(row.qb_line, '9');
  assert.equal(row.pdf_allocations.length, 2);
  assert.equal(row.pdf_allocations[0].extd_price, 28.8);
  assert.equal(row.pdf_allocations[1].extd_price, 29.02);
  assert.equal(result.summary.pdf_not_in_qb, 0);
  assert.equal(result.summary.qb_not_in_pdf, 0);
  assert.equal(result.summary.price_mismatches_count, 0);
  assert.equal(result.summary.abs_homeowner_keys_bundle_count, 1);

  const cleaned = runCodeNode(cleanSource, result);
  const cleanedRow = cleaned.matched_lines[0];

  assert.equal(cleanedRow.pdf_qty, '24, 24');
  assert.equal(cleanedRow.pdf_unit_price, '1.2, 1.21');
  assert.equal(cleanedRow.pdf_extd_price, 57.82);
  assert.equal(cleanedRow.pdf_allocations.length, 2);
  assert.equal(cleaned.summary.abs_homeowner_keys_bundle_count, 1);
}

{
  const result = runReconciliation({
    pdf: pdfLines({ keyblankExtdPrice: 74.4 }),
    qb: [qbHomeownerKeysLine({ qty: 24, rate: 4.3, amount: 103.2 })],
  });
  const row = result.matched_lines[0];

  assert.equal(result.discrepancias.length, 0);
  assert.equal(result.matched_lines.length, 1);
  assert.equal(row.status, 'MATCHED');
  assert.equal(row.match_rule, 'ABS_HOMEOWNER_KEYS_BUNDLE');
}

{
  const result = runReconciliation({
    qb: [qbHomeownerKeysLine({ qty: 20, rate: 2.4091667, amount: 48.18 })],
  });

  assert.equal(result.discrepancias.length, 1);
  assert.equal(result.discrepancias[0].type, 'QTY_MISMATCH');
  assert.equal(result.discrepancias[0].pdf_qty, '24, 24');
  assert.equal(result.discrepancias[0].qb_qty, 20);
}

{
  const result = runReconciliation({
    qb: [qbHomeownerKeysLine({ qty: 24, rate: 2.2, amount: 52.8 })],
  });

  assert.equal(result.discrepancias.length, 1);
  assert.equal(result.discrepancias[0].type, 'PRICE_MISMATCH');
  assert.equal(result.discrepancias[0].pdf_extd_price, 57.82);
}

{
  const result = runReconciliation({
    supplier: 'Different Vendor',
  });

  assert.equal(result.discrepancias.length, 3);
  assert.equal(result.discrepancias.filter((row) => row.type === 'LINE_NOT_FOUND_IN_QB').length, 2);
  assert.equal(result.discrepancias.filter((row) => row.type === 'LINE_NOT_FOUND_IN_PDF').length, 1);
  assert.equal(result.summary.abs_homeowner_keys_bundle_count, 0);
}

{
  const result = runReconciliation({
    pdf: pdfLines({ cutQty: 24, keyblankQty: 23, keyblankExtdPrice: 27.83 }),
  });

  assert.equal(result.discrepancias.length, 3);
  assert.equal(result.summary.abs_homeowner_keys_bundle_count, 0);
}

{
  const result = runReconciliation({ qb: [] });
  const row = result.discrepancias[0];

  assert.equal(result.discrepancias.length, 1);
  assert.equal(row.type, 'LINE_NOT_FOUND_IN_QB');
  assert.equal(row.match_rule, 'ABS_HOMEOWNER_KEYS_BUNDLE');
  assert.equal(row.pdf_qty, '24, 24');
}

console.log('American Building Supply homeowner keys bundle tests passed.');
