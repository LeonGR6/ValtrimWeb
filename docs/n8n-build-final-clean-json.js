const item = $input.first();
const data = item.json || {};
const binary = item.binary || {};

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function toNumber(value) {
  if (!hasValue(value)) return null;

  const n = Number(String(value).replace(/[^0-9.-]/g, ''));

  return Number.isFinite(n) ? n : null;
}

function roundMoney(value) {
  const n = toNumber(value);

  return n === null ? null : Math.round(n * 100) / 100;
}

function cleanMoneyValue(value) {
  if (!hasValue(value)) return null;

  if (typeof value === 'string' && value.includes(',')) {
    return value;
  }

  return roundMoney(value);
}

function compactObject(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => {
      if (value === null || value === undefined || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
  );
}

function compactArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function cleanAllocation(allocation) {
  return compactObject({
    line: allocation.line,
    item_id: allocation.item_id,
    item_description: allocation.item_description,
    description: allocation.description,
    qty_used: allocation.qty_used,
    qty: allocation.qty,
    unit_price: cleanMoneyValue(allocation.unit_price),
    rate: cleanMoneyValue(allocation.rate),
    extd_price: cleanMoneyValue(allocation.extd_price),
    amount: cleanMoneyValue(allocation.amount),
    source_qty: allocation.source_qty,
  });
}

function cleanComparisonLine(line) {
  const isMatched = line.status === 'MATCHED';

  return compactObject({
    status: line.status,
    type: line.type,
    source: line.source,
    match_type: line.match_type,
    match_rule: line.match_rule,

    product_key: line.product_key,
    item_description: line.item_description || line.product_label,

    pdf_line: line.pdf_line,
    pdf_item_id: line.pdf_item_id,
    pdf_item_description: line.pdf_item_description,
    pdf_description: line.pdf_description,
    pdf_qty: line.pdf_qty,
    pdf_unit_price: cleanMoneyValue(line.pdf_unit_price),
    pdf_extd_price: cleanMoneyValue(line.pdf_extd_price),

    qb_line: line.qb_line,
    qb_item_description: line.qb_item_description,
    qb_description: line.qb_description,
    qb_qty: line.qb_qty,
    qb_rate: cleanMoneyValue(line.qb_rate),
    qb_amount: cleanMoneyValue(line.qb_amount),

    qty_difference: line.qty_difference,
    excess_side: line.excess_side,
    unit_price_difference: cleanMoneyValue(line.unit_price_difference),
    amount_difference: cleanMoneyValue(line.amount_difference),
    variance: cleanMoneyValue(line.variance),

    match_score: isMatched ? line.match_score : undefined,
    match_similarity: isMatched ? line.match_similarity : undefined,
    message: line.message,
    ai_applied: line.ai_applied,
    ai_status: line.ai_status,
    ai_reason: line.ai_reason,

    pdf_allocations: compactArray(line.pdf_allocations).map(cleanAllocation),
    qb_allocations: compactArray(line.qb_allocations).map(cleanAllocation),
  });
}

function cleanAiReview(aiReview) {
  const review = aiReview || {};
  const corrections = compactArray(review.corrections).map((correction) => compactObject({
    status: correction.status,
    pdf_line: correction.pdf_line,
    qb_line: correction.qb_line,
    item_description: correction.item_description,
    reason: correction.reason,
    safe_to_auto_apply: correction.safe_to_auto_apply,
  }));

  return compactObject({
    status: review.ai_review_status || review.status || 'NOT_RUN',
    corrections,
    applied_corrections: compactArray(review.applied_corrections),
    audit_only_corrections: compactArray(review.audit_only_corrections),
    skipped_corrections: compactArray(review.skipped_corrections),
    notes: compactArray(review.notes),
    raw_error: review.raw_error || review.error,
  });
}

const matchedLines = compactArray(data.matched_lines).map(cleanComparisonLine);
const discrepancies = compactArray(data.discrepancias).map(cleanComparisonLine);
const warnings = compactArray(data.warnings).map((warning) => compactObject({
  type: warning.type,
  severity: warning.severity,
  pdf_line: warning.pdf_line,
  qb_line: warning.qb_line,
  item_description: warning.item_description,
  message: warning.message,
}));
const aiReview = cleanAiReview(data.ai_review);
const totalPdf = roundMoney(data.totalPdf);
const totalQb = roundMoney(data.totalQb);

const summary = compactObject({
  pdf_lines_count: data.summary?.pdf_lines_count,
  qb_lines_count: data.summary?.qb_lines_count,
  qb_lines_count_original: data.summary?.qb_lines_count_original ?? data.summary?.qb_lines_count,
  qb_lines_count_after_filter: data.summary?.qb_lines_count_after_filter ?? data.summary?.qb_lines_count,
  matched_lines_count: matchedLines.length,
  discrepancies_count: discrepancies.length,
  qty_mismatches_count: discrepancies.filter((line) => String(line.type || '').includes('QTY')).length,
  price_mismatches_count: discrepancies.filter((line) => String(line.type || '').includes('PRICE')).length,
  pdf_not_in_qb: discrepancies.filter((line) => line.type === 'LINE_NOT_FOUND_IN_QB').length,
  qb_not_in_pdf: discrepancies.filter((line) => line.type === 'LINE_NOT_FOUND_IN_PDF').length,
  bundle_matches_count: matchedLines.filter((line) => line.match_rule === 'BYPASS_TRACK_HARDWARE_BUNDLE').length,
  warnings_count: warnings.length,
  ai_review_status: aiReview.status,
  ai_corrections_count: compactArray(aiReview.corrections).length,
  ai_applied_corrections_count: data.summary?.ai_applied_corrections_count,
  ai_applied_matches_count: data.summary?.ai_applied_matches_count,
  ai_applied_mismatches_count: data.summary?.ai_applied_mismatches_count,
  ai_audit_only_corrections_count: data.summary?.ai_audit_only_corrections_count,
  ai_skipped_corrections_count: data.summary?.ai_skipped_corrections_count,
  total_pdf: totalPdf,
  total_qb: totalQb,
  total_difference: roundMoney(totalPdf - totalQb),
  totals_match: data.summary?.totals_match,
});

const finalStatus = discrepancies.length === 0 && data.summary?.totals_match === true
  ? 'MATCH_TOTAL'
  : 'REVIEW';

return [{
  json: compactObject({
    schema_version: 'reconcile_v2_clean_1',
    po_number: data.po_number,
    supplier: data.supplier,
    vendor_name: data.supplier,
    job: data.job,
    phaseLots: data.phaseLots,
    required_date: data.required_date,
    order_date: data.order_date,
    ship_date: data.ship_date,

    totalPdf,
    totalQb,
    status: finalStatus,
    verified: finalStatus === 'MATCH_TOTAL',
    final_status: finalStatus,
    final_verified: finalStatus === 'MATCH_TOTAL',
    match_status: finalStatus,
    workflow_status: data.workflow_status || 'PENDING',
    message: finalStatus === 'MATCH_TOTAL'
      ? 'PDF and QuickBooks match by normalized item description, quantity, unit price, and total.'
      : 'Review required. Product-level differences were found.',

    summary,
    matched_lines: matchedLines,
    discrepancias: discrepancies,
    warnings,
    ai_review: aiReview,

    // Compatibility fields for the current frontend. These can be removed after the UI reads ai_review directly.
    ai_final_status: aiReview.status,
    ai_summary: compactArray(aiReview.notes).join(' '),
    ai_decision_reason: compactArray(aiReview.corrections).map((correction) => correction.reason).filter(Boolean).join(' '),
    ai_suggested_matches: [],
    ai_differences: [],

    storage: data.storage,
    reconciledAt: data.reconciledAt || new Date().toISOString(),
  }),
  binary,
}];
