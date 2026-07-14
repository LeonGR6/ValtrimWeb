// n8n Code node: Apply AI Corrections V2
// Place this node after "Attach AI Review" and before "Build Final Clean JSON".

const item = $input.first();
const data = item.json || {};
const binary = item.binary || {};

const MONEY_TOL = 0.05;
const QTY_TOL = 0.0001;

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value) {
  if (!hasValue(value)) return null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function numberOrZero(value) {
  return toNumber(value) ?? 0;
}

function roundMoney(value) {
  const n = toNumber(value);
  return n === null ? null : Math.round(n * 100) / 100;
}

function moneyEquals(a, b) {
  const left = toNumber(a);
  const right = toNumber(b);
  if (left === null || right === null) return false;
  return Math.abs(left - right) <= MONEY_TOL;
}

function qtyEquals(a, b) {
  const left = toNumber(a);
  const right = toNumber(b);
  if (left === null || right === null) return false;
  return Math.abs(left - right) <= QTY_TOL;
}

function lineKey(value) {
  return String(value ?? '').trim();
}

function splitLineRefs(value) {
  if (Array.isArray(value)) {
    return value.flatMap(splitLineRefs);
  }

  return String(value ?? '')
    .split(',')
    .map((line) => line.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(hasValue).map((value) => String(value).trim()).filter(Boolean))];
}

function joinValues(values, separator = ' / ') {
  const cleanValues = values.filter(hasValue).map((value) => String(value).trim()).filter(Boolean);
  return cleanValues.length ? cleanValues.join(separator) : null;
}

function joinLines(values) {
  return unique(values).join(', ') || null;
}

function singleValue(values) {
  const cleanValues = values.filter(hasValue);
  if (cleanValues.length === 0) return null;
  const normalized = unique(cleanValues);
  return normalized.length === 1 ? cleanValues[0] : null;
}

function sumNumbers(values) {
  const sum = values.reduce((total, value) => total + numberOrZero(value), 0);
  return Math.round(sum * 1000000) / 1000000;
}

function sumMoney(values) {
  return roundMoney(values.reduce((total, value) => total + numberOrZero(value), 0));
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

function buildLookupFromRows(rows, side) {
  const lookup = new Map();

  for (const row of rows) {
    const refs = splitLineRefs(side === 'pdf' ? row.pdf_line : row.qb_line);
    for (const ref of refs) {
      if (!lookup.has(lineKey(ref))) {
        lookup.set(lineKey(ref), row);
      }
    }
  }

  return lookup;
}

function buildPdfSourceLookup() {
  const rows = [
    ...asArray(data.pdfData?.line_items),
    ...asArray(data.pdfData?.items),
    ...asArray(data.pdf_lines),
  ];
  const lookup = new Map();

  for (const row of rows) {
    const line = row.line ?? row.pdf_line ?? row.line_number;
    if (hasValue(line) && !lookup.has(lineKey(line))) {
      lookup.set(lineKey(line), row);
    }
  }

  return lookup;
}

function buildQbSourceLookup() {
  const rows = [
    ...asArray(data.qbData?.qb_line_items),
    ...asArray(data.qbData?.line_items),
    ...asArray(data.qb_line_items),
    ...asArray(data.qb_lines),
  ];
  const lookup = new Map();

  for (const row of rows) {
    const line = row.qb_line_num ?? row.qb_line ?? row.line ?? row.LineNum;
    if (hasValue(line) && !lookup.has(lineKey(line))) {
      lookup.set(lineKey(line), row);
    }
  }

  return lookup;
}

function getLineRefsFromRow(row, side) {
  if (!row) return [];
  return splitLineRefs(side === 'pdf' ? row.pdf_line : row.qb_line);
}

function resolveLineSource(lineRef, discrepancyLookup, sourceLookup, side) {
  const line = lineKey(lineRef);
  const discrepancySource = discrepancyLookup.get(line);
  const rawSource = sourceLookup.get(line);

  if (!discrepancySource) {
    return rawSource || {};
  }

  const discrepancyRefs = getLineRefsFromRow(discrepancySource, side);

  // If a prior discrepancy grouped multiple lines, never hydrate one AI correction
  // from that grouped row. Use the original line-level PDF/QB row instead so L/R,
  // qty, rate, amount, and description stay one-to-one.
  if (discrepancyRefs.length > 1 && rawSource) {
    return {
      product_key: discrepancySource.product_key,
      product_label: discrepancySource.product_label,
      item_description: discrepancySource.item_description,
      ...rawSource,
    };
  }

  return discrepancySource;
}

function normalizePdfLine(lineRef, discrepancyLookup, sourceLookup) {
  const line = lineKey(lineRef);
  const source = resolveLineSource(line, discrepancyLookup, sourceLookup, 'pdf');
  const qty = toNumber(source.pdf_qty ?? source.qty ?? source.quantity ?? source.ordered ?? source.qty_used);
  const unitPrice = toNumber(source.pdf_unit_price ?? source.unit_price ?? source.rate);
  const extdPrice = roundMoney(
    source.pdf_extd_price ??
    source.extd_price ??
    source.amount ??
    (qty !== null && unitPrice !== null ? qty * unitPrice : null)
  );

  return compactObject({
    line,
    item_id: source.pdf_item_id ?? source.item_id,
    item_description: source.pdf_item_description ?? source.item_description ?? source.product_label,
    description: source.pdf_description ?? source.description,
    qty_used: qty,
    unit_price: unitPrice,
    extd_price: extdPrice,
    source_qty: qty,
    product_key: source.product_key,
    product_label: source.product_label,
  });
}

function normalizeQbLine(lineRef, discrepancyLookup, sourceLookup) {
  const line = lineKey(lineRef);
  const source = resolveLineSource(line, discrepancyLookup, sourceLookup, 'qb');
  const detail = source.ItemBasedExpenseLineDetail || {};
  const qty = toNumber(source.qb_qty ?? source.qty ?? source.quantity ?? detail.Qty);
  const rate = toNumber(source.qb_rate ?? source.rate ?? source.unit_price ?? detail.UnitPrice);
  const amount = roundMoney(
    source.qb_amount ??
    source.amount ??
    source.Amount ??
    (qty !== null && rate !== null ? qty * rate : null)
  );

  return compactObject({
    line,
    item_description: source.qb_item_description ?? source.item_description ?? source.product_label,
    description: source.qb_description ?? source.description ?? source.Description,
    qty,
    rate,
    amount,
    product_key: source.product_key,
    product_label: source.product_label,
  });
}

function mergePdfAllocation(explicitAllocation, fallbackAllocation) {
  const qtyUsed = toNumber(explicitAllocation.qty_used ?? explicitAllocation.qty ?? explicitAllocation.pdf_qty);
  const unitPrice = toNumber(explicitAllocation.unit_price ?? explicitAllocation.pdf_unit_price ?? fallbackAllocation.unit_price);
  const extdPrice = roundMoney(
    explicitAllocation.extd_price ??
    explicitAllocation.pdf_extd_price ??
    (qtyUsed !== null && unitPrice !== null ? qtyUsed * unitPrice : fallbackAllocation.extd_price)
  );

  return compactObject({
    ...fallbackAllocation,
    item_id: explicitAllocation.item_id ?? explicitAllocation.pdf_item_id ?? fallbackAllocation.item_id,
    item_description: explicitAllocation.item_description ?? explicitAllocation.pdf_item_description ?? fallbackAllocation.item_description,
    description: explicitAllocation.description ?? explicitAllocation.pdf_description ?? fallbackAllocation.description,
    qty_used: qtyUsed ?? fallbackAllocation.qty_used,
    unit_price: unitPrice ?? fallbackAllocation.unit_price,
    extd_price: extdPrice ?? fallbackAllocation.extd_price,
    source_qty: explicitAllocation.source_qty ?? fallbackAllocation.source_qty,
  });
}

function mergeQbAllocation(explicitAllocation, fallbackAllocation) {
  const qty = toNumber(explicitAllocation.qty ?? explicitAllocation.qty_used ?? explicitAllocation.qb_qty);
  const rate = toNumber(explicitAllocation.rate ?? explicitAllocation.unit_price ?? explicitAllocation.qb_rate ?? fallbackAllocation.rate);
  const amount = roundMoney(
    explicitAllocation.amount ??
    explicitAllocation.qb_amount ??
    (qty !== null && rate !== null ? qty * rate : fallbackAllocation.amount)
  );

  return compactObject({
    ...fallbackAllocation,
    item_description: explicitAllocation.item_description ?? explicitAllocation.qb_item_description ?? fallbackAllocation.item_description,
    description: explicitAllocation.description ?? explicitAllocation.qb_description ?? fallbackAllocation.description,
    qty: qty ?? fallbackAllocation.qty,
    rate: rate ?? fallbackAllocation.rate,
    amount: amount ?? fallbackAllocation.amount,
  });
}

function buildPdfAllocations(correction, pdfDiscrepancyLookup, pdfSourceLookup, qbAllocations = []) {
  const explicitAllocations = asArray(correction.pdf_allocations);
  const refs = explicitAllocations.length > 0
    ? explicitAllocations.map((allocation) => allocation.line ?? allocation.pdf_line)
    : splitLineRefs(correction.pdf_line);
  const allocations = refs.map((line, index) => {
    const fallbackAllocation = normalizePdfLine(
      line,
      pdfDiscrepancyLookup,
      pdfSourceLookup
    );

    return explicitAllocations[index]
      ? mergePdfAllocation(explicitAllocations[index], fallbackAllocation)
      : fallbackAllocation;
  });

  if (explicitAllocations.length > 0) {
    return allocations;
  }

  if (!correctionLooksLikeAllowedBundle(correction) || qbAllocations.length !== 1) {
    return allocations;
  }

  const qbQty = toNumber(qbAllocations[0].qty);

  if (qbQty === null || qbQty <= 0) {
    return allocations;
  }

  return allocations.map((allocation) => ({
    ...allocation,
    qty_used: qbQty,
    extd_price: roundMoney(qbQty * numberOrZero(allocation.unit_price)),
  }));
}

function buildQbAllocations(correction, qbDiscrepancyLookup, qbSourceLookup) {
  const explicitAllocations = asArray(correction.qb_allocations);
  const refs = explicitAllocations.length > 0
    ? explicitAllocations.map((allocation) => allocation.line ?? allocation.qb_line)
    : splitLineRefs(correction.qb_line);

  return refs.map((line, index) => {
    const fallbackAllocation = normalizeQbLine(
      line,
      qbDiscrepancyLookup,
      qbSourceLookup
    );

    return explicitAllocations[index]
      ? mergeQbAllocation(explicitAllocations[index], fallbackAllocation)
      : fallbackAllocation;
  });
}

function correctionAction(status) {
  const cleanStatus = String(status || '').toUpperCase();

  if (cleanStatus === 'MATCH_CONFIRMED') {
    return { kind: 'MATCH', type: null };
  }

  if (cleanStatus === 'QTY_PRICE_MISMATCH_CONFIRMED') {
    return { kind: 'DISCREPANCY', type: 'QTY_PRICE_MISMATCH' };
  }

  if (cleanStatus.includes('QTY') && cleanStatus.includes('PRICE')) {
    return { kind: 'DISCREPANCY', type: 'QTY_PRICE_MISMATCH' };
  }

  if (cleanStatus === 'PRICE_MISMATCH_CONFIRMED') {
    return { kind: 'DISCREPANCY', type: 'PRICE_MISMATCH' };
  }

  if (cleanStatus.includes('PRICE')) {
    return { kind: 'DISCREPANCY', type: 'PRICE_MISMATCH' };
  }

  if (cleanStatus === 'QTY_MISMATCH_CONFIRMED') {
    return { kind: 'DISCREPANCY', type: 'QTY_MISMATCH' };
  }

  if (cleanStatus.includes('QTY')) {
    return { kind: 'DISCREPANCY', type: 'QTY_MISMATCH' };
  }

  return { kind: 'AUDIT_ONLY', type: null };
}

function getCanonicalDescription(correction, pdfAllocations, qbAllocations) {
  return (
    correction.item_description ||
    singleValue(pdfAllocations.map((line) => line.item_description)) ||
    singleValue(qbAllocations.map((line) => line.item_description)) ||
    singleValue(pdfAllocations.map((line) => line.product_label)) ||
    singleValue(qbAllocations.map((line) => line.product_label)) ||
    joinValues(pdfAllocations.map((line) => line.item_description)) ||
    joinValues(qbAllocations.map((line) => line.item_description))
  );
}

function getProductKey(correction, pdfAllocations, qbAllocations) {
  return (
    correction.product_key ||
    singleValue(pdfAllocations.map((line) => line.product_key)) ||
    singleValue(qbAllocations.map((line) => line.product_key)) ||
    getCanonicalDescription(correction, pdfAllocations, qbAllocations)
  );
}

function buildCommonFields(correction, pdfAllocations, qbAllocations) {
  const pdfQty = sumNumbers(pdfAllocations.map((line) => line.qty_used));
  const qbQty = sumNumbers(qbAllocations.map((line) => line.qty));
  const pdfTotal = sumMoney(pdfAllocations.map((line) => line.extd_price));
  const qbTotal = sumMoney(qbAllocations.map((line) => line.amount));
  const pdfUnitPrice = singleValue(pdfAllocations.map((line) => line.unit_price));
  const qbRate = singleValue(qbAllocations.map((line) => line.rate));
  const productLabel = getCanonicalDescription(correction, pdfAllocations, qbAllocations);
  const hasGroupedPdf = pdfAllocations.length > 1;
  const hasGroupedQb = qbAllocations.length > 1;

  return compactObject({
    product_key: getProductKey(correction, pdfAllocations, qbAllocations),
    product_label: productLabel,
    item_description: productLabel,

    pdf_line: joinLines(pdfAllocations.map((line) => line.line)),
    pdf_item_id: joinValues(pdfAllocations.map((line) => line.item_id), ', '),
    pdf_item_description: joinValues(pdfAllocations.map((line) => line.item_description)),
    pdf_description: joinValues(pdfAllocations.map((line) => line.description)),
    pdf_qty: hasGroupedPdf ? joinValues(pdfAllocations.map((line) => line.qty_used), ', ') : pdfQty || null,
    pdf_unit_price: hasGroupedPdf ? joinValues(pdfAllocations.map((line) => line.unit_price), ', ') : pdfUnitPrice,
    pdf_extd_price: pdfTotal,

    qb_line: joinLines(qbAllocations.map((line) => line.line)),
    qb_item_description: joinValues(qbAllocations.map((line) => line.item_description)),
    qb_description: joinValues(qbAllocations.map((line) => line.description)),
    qb_qty: hasGroupedQb ? joinValues(qbAllocations.map((line) => line.qty), ', ') : qbQty || null,
    qb_rate: hasGroupedQb ? joinValues(qbAllocations.map((line) => line.rate), ', ') : qbRate,
    qb_amount: qbTotal,

    amount_difference: roundMoney(numberOrZero(pdfTotal) - numberOrZero(qbTotal)),
    variance: roundMoney(numberOrZero(pdfTotal) - numberOrZero(qbTotal)),
    pdf_allocations: pdfAllocations,
    qb_allocations: qbAllocations,
    ai_applied: true,
    ai_status: correction.status,
    ai_reason: correction.reason,
  });
}

function isBundleMatch(common) {
  const text = String(common.item_description || common.product_key || '').toUpperCase();
  return text.includes('BYPASS_BUNDLE') || text.includes('TRACK_HARDWARE_BUNDLE');
}

function correctionLooksLikeAllowedBundle(correction) {
  const text = [
    correction.item_description,
    correction.product_key,
    correction.product_label,
    correction.reason,
  ].filter(hasValue).join(' ').toUpperCase();

  return (
    text.includes('BYPASS_BUNDLE') ||
    text.includes('TRACK_HARDWARE_BUNDLE') ||
    (
      text.includes('BYPASS') &&
      text.includes('TRACK') &&
      text.includes('HARDWARE')
    )
  );
}

function hasMultipleQbLines(correction) {
  return splitLineRefs(correction.qb_line).length > 1;
}

function hasMultiplePdfLines(correction) {
  return splitLineRefs(correction.pdf_line).length > 1;
}

function buildMatchedLine(correction, pdfAllocations, qbAllocations) {
  const common = buildCommonFields(correction, pdfAllocations, qbAllocations);
  const grouped = pdfAllocations.length > 1 || qbAllocations.length > 1;

  return compactObject({
    status: 'MATCHED',
    match_type: grouped ? 'AI_GROUPED_PRODUCT' : 'AI_ONE_TO_ONE_PRODUCT',
    match_rule: isBundleMatch(common)
      ? 'AI_CONFIRMED_BYPASS_TRACK_HARDWARE_BUNDLE'
      : 'AI_CONFIRMED_SAME_PRODUCT_QTY_UNIT_TOTAL',
    ...common,
    match_score: 100,
    match_similarity: 1,
    message: correction.reason
      ? `AI confirmed match. ${correction.reason}`
      : 'AI confirmed same product, quantity, unit price, and total.',
  });
}

function buildMismatchLine(correction, type, pdfAllocations, qbAllocations) {
  const common = buildCommonFields(correction, pdfAllocations, qbAllocations);
  const pdfQty = toNumber(common.pdf_qty);
  const qbQty = toNumber(common.qb_qty);
  const pdfUnitPrice = toNumber(common.pdf_unit_price);
  const qbRate = toNumber(common.qb_rate);
  const qtyDifference = pdfQty !== null && qbQty !== null
    ? Math.round((pdfQty - qbQty) * 1000000) / 1000000
    : null;
  const unitPriceDifference = pdfUnitPrice !== null && qbRate !== null
    ? roundMoney(pdfUnitPrice - qbRate)
    : null;

  return compactObject({
    type,
    status: 'REVIEW',
    source: 'BOTH',
    match_type: pdfAllocations.length > 1 || qbAllocations.length > 1
      ? 'AI_GROUPED_PRODUCT_REVIEW'
      : 'AI_ONE_TO_ONE_PRODUCT_REVIEW',
    match_rule: `AI_CONFIRMED_${type}`,
    ...common,
    qty_difference: qtyDifference,
    unit_price_difference: unitPriceDifference,
    excess_side: qtyDifference === null || Math.abs(qtyDifference) <= QTY_TOL
      ? null
      : qtyDifference > 0 ? 'PDF' : 'QB',
    message: correction.reason
      ? `AI confirmed ${type}. ${correction.reason}`
      : `AI confirmed ${type}.`,
  });
}

function allRefsResolved(refs, resolvedSet) {
  const cleanRefs = splitLineRefs(refs);
  return cleanRefs.length > 0 && cleanRefs.every((ref) => resolvedSet.has(lineKey(ref)));
}

function discrepancyWasResolved(row, resolvedPdfLines, resolvedQbLines) {
  if (row.type === 'LINE_NOT_FOUND_IN_QB') {
    return allRefsResolved(row.pdf_line, resolvedPdfLines);
  }

  if (row.type === 'LINE_NOT_FOUND_IN_PDF') {
    return allRefsResolved(row.qb_line, resolvedQbLines);
  }

  const hasPdfRefs = splitLineRefs(row.pdf_line).length > 0;
  const hasQbRefs = splitLineRefs(row.qb_line).length > 0;

  return (
    hasPdfRefs &&
    hasQbRefs &&
    allRefsResolved(row.pdf_line, resolvedPdfLines) &&
    allRefsResolved(row.qb_line, resolvedQbLines)
  );
}

function hasLineOverlap(correction, usedPdfLines, usedQbLines, pdfAllocations = [], usedPdfQty = new Map()) {
  const qbOverlap = splitLineRefs(correction.qb_line).some((line) => usedQbLines.has(lineKey(line)));

  if (qbOverlap) return true;

  if (correctionLooksLikeAllowedBundle(correction)) {
    return pdfAllocations.some((allocation) => {
      const line = lineKey(allocation.line);
      const sourceQty = toNumber(allocation.source_qty ?? allocation.qty_used);
      const nextUsedQty = numberOrZero(usedPdfQty.get(line)) + numberOrZero(allocation.qty_used);

      return sourceQty !== null && sourceQty > 0 && nextUsedQty > sourceQty + QTY_TOL;
    });
  }

  return splitLineRefs(correction.pdf_line).some((line) => usedPdfLines.has(lineKey(line)));
}

function addUsedPdfQty(usedPdfQty, line, qty) {
  const key = lineKey(line);
  usedPdfQty.set(key, numberOrZero(usedPdfQty.get(key)) + numberOrZero(qty));
}

function markResolved(correction, usedPdfLines, usedQbLines, pdfAllocations = [], usedPdfQty = new Map()) {
  splitLineRefs(correction.qb_line).forEach((line) => usedQbLines.add(lineKey(line)));

  if (correctionLooksLikeAllowedBundle(correction)) {
    for (const allocation of pdfAllocations) {
      const line = lineKey(allocation.line);
      const qtyUsed = numberOrZero(allocation.qty_used);
      const sourceQty = toNumber(allocation.source_qty ?? allocation.qty_used);

      addUsedPdfQty(usedPdfQty, line, qtyUsed);

      if (sourceQty === null || sourceQty <= 0 || numberOrZero(usedPdfQty.get(line)) >= sourceQty - QTY_TOL) {
        usedPdfLines.add(line);
      }
    }

    return;
  }

  splitLineRefs(correction.pdf_line).forEach((line) => {
    usedPdfLines.add(lineKey(line));
    addUsedPdfQty(usedPdfQty, line, 1);
  });
}

function seedResolvedLinesFromMatches(matches, usedPdfLines, usedQbLines, usedPdfQty) {
  for (const match of matches) {
    splitLineRefs(match.qb_line).forEach((line) => usedQbLines.add(lineKey(line)));

    const allocations = asArray(match.pdf_allocations);

    if (allocations.length > 0) {
      for (const allocation of allocations) {
        const line = lineKey(allocation.line);
        const qtyUsed = numberOrZero(allocation.qty_used ?? allocation.qty);
        const sourceQty = toNumber(allocation.source_qty ?? allocation.qty_used ?? allocation.qty);

        addUsedPdfQty(usedPdfQty, line, qtyUsed);

        if (sourceQty === null || sourceQty <= 0 || numberOrZero(usedPdfQty.get(line)) >= sourceQty - QTY_TOL) {
          usedPdfLines.add(line);
        }
      }
    } else {
      splitLineRefs(match.pdf_line).forEach((line) => {
        usedPdfLines.add(lineKey(line));
        addUsedPdfQty(usedPdfQty, line, 1);
      });
    }
  }
}

function mismatchTypeFromNumbers(common) {
  const hasQtyValues = hasValue(common.pdf_qty) && hasValue(common.qb_qty);
  const hasUnitValues = hasValue(common.pdf_unit_price) && hasValue(common.qb_rate);
  const hasTotalValues = hasValue(common.pdf_extd_price) && hasValue(common.qb_amount);

  if (!hasQtyValues && !hasUnitValues && !hasTotalValues) {
    return null;
  }

  const qtyMatches = !hasQtyValues || qtyEquals(common.pdf_qty, common.qb_qty);
  const unitMatches = !hasUnitValues || moneyEquals(common.pdf_unit_price, common.qb_rate);
  const totalMatches = !hasTotalValues || moneyEquals(common.pdf_extd_price, common.qb_amount);

  if (!qtyMatches && (!unitMatches || !totalMatches)) return 'QTY_PRICE_MISMATCH';
  if (!qtyMatches) return 'QTY_MISMATCH';
  if (!unitMatches || !totalMatches) return 'PRICE_MISMATCH';
  return null;
}

function shouldDowngradeAiMatch(matchLine) {
  if (isBundleMatch(matchLine)) return null;
  return mismatchTypeFromNumbers(matchLine);
}

const originalMatchedLines = asArray(data.matched_lines);
const originalDiscrepancies = asArray(data.discrepancias);
const aiReview = data.ai_review || {};
const corrections = asArray(aiReview.corrections);
const pdfDiscrepancyLookup = buildLookupFromRows(originalDiscrepancies, 'pdf');
const qbDiscrepancyLookup = buildLookupFromRows(originalDiscrepancies, 'qb');
const pdfSourceLookup = buildPdfSourceLookup();
const qbSourceLookup = buildQbSourceLookup();
const usedPdfLines = new Set();
const usedQbLines = new Set();
const usedPdfQty = new Map();
const appliedMatches = [];
const appliedDiscrepancies = [];
const appliedCorrections = [];
const skippedCorrections = [];
const auditOnlyCorrections = [];

seedResolvedLinesFromMatches(originalMatchedLines, usedPdfLines, usedQbLines, usedPdfQty);

for (const correction of corrections) {
  const action = correctionAction(correction.status);

  if (action.kind === 'AUDIT_ONLY') {
    auditOnlyCorrections.push(correction);
    continue;
  }

  if (correction.safe_to_auto_apply !== true) {
    skippedCorrections.push({
      ...correction,
      skipped_reason: 'safe_to_auto_apply is not true.',
    });
    continue;
  }

  if (hasMultipleQbLines(correction)) {
    skippedCorrections.push({
      ...correction,
      skipped_reason: 'A single correction cannot contain multiple QuickBooks lines. Bypass bundles must be one QB line per correction with allocated PDF track/hardware quantities.',
    });
    continue;
  }

  if (hasMultiplePdfLines(correction) && !correctionLooksLikeAllowedBundle(correction)) {
    skippedCorrections.push({
      ...correction,
      skipped_reason: 'Multiple PDF lines in one correction are only allowed for the explicit bypass track + hardware bundle.',
    });
    continue;
  }

  const qbAllocations = buildQbAllocations(correction, qbDiscrepancyLookup, qbSourceLookup);
  const pdfAllocations = buildPdfAllocations(correction, pdfDiscrepancyLookup, pdfSourceLookup, qbAllocations);

  if (hasLineOverlap(correction, usedPdfLines, usedQbLines, pdfAllocations, usedPdfQty)) {
    skippedCorrections.push({
      ...correction,
      skipped_reason: 'One or more PDF/QB lines were already resolved by code or an earlier AI correction.',
    });
    continue;
  }

  if (pdfAllocations.length === 0 || qbAllocations.length === 0) {
    skippedCorrections.push({
      ...correction,
      skipped_reason: 'Missing pdf_line or qb_line references.',
    });
    continue;
  }

  if (action.kind === 'MATCH') {
    const matchLine = buildMatchedLine(correction, pdfAllocations, qbAllocations);
    const downgradeType = shouldDowngradeAiMatch(matchLine);

    if (downgradeType) {
      const mismatchLine = buildMismatchLine(
        { ...correction, reason: `${correction.reason || ''} Numeric guard changed AI match to ${downgradeType}.`.trim() },
        downgradeType,
        pdfAllocations,
        qbAllocations
      );
      appliedDiscrepancies.push(mismatchLine);
      appliedCorrections.push({
        status: correction.status,
        applied_as: downgradeType,
        pdf_line: correction.pdf_line,
        qb_line: correction.qb_line,
        reason: mismatchLine.message,
      });
    } else {
      appliedMatches.push(matchLine);
      appliedCorrections.push({
        status: correction.status,
        applied_as: 'MATCHED',
        pdf_line: correction.pdf_line,
        qb_line: correction.qb_line,
        reason: correction.reason,
      });
    }
  }

  if (action.kind === 'DISCREPANCY') {
    appliedDiscrepancies.push(buildMismatchLine(
      correction,
      action.type,
      pdfAllocations,
      qbAllocations
    ));
    appliedCorrections.push({
      status: correction.status,
      applied_as: action.type,
      pdf_line: correction.pdf_line,
      qb_line: correction.qb_line,
      reason: correction.reason,
    });
  }

  markResolved(correction, usedPdfLines, usedQbLines, pdfAllocations, usedPdfQty);
}

const remainingDiscrepancies = originalDiscrepancies.filter((row) => (
  !discrepancyWasResolved(row, usedPdfLines, usedQbLines)
));
const nextMatchedLines = [...originalMatchedLines, ...appliedMatches];
const nextDiscrepancies = [...appliedDiscrepancies, ...remainingDiscrepancies];
const totalsMatch = moneyEquals(data.totalPdf, data.totalQb);
const finalStatus = nextDiscrepancies.length === 0 && totalsMatch ? 'MATCH_TOTAL' : 'REVIEW';

const summary = {
  ...(data.summary || {}),
  matched_lines_count: nextMatchedLines.length,
  discrepancies_count: nextDiscrepancies.length,
  qty_mismatches_count: nextDiscrepancies.filter((line) => String(line.type || '').includes('QTY')).length,
  price_mismatches_count: nextDiscrepancies.filter((line) => String(line.type || '').includes('PRICE')).length,
  qty_price_mismatches_count: nextDiscrepancies.filter((line) => line.type === 'QTY_PRICE_MISMATCH').length,
  pdf_not_in_qb: nextDiscrepancies.filter((line) => line.type === 'LINE_NOT_FOUND_IN_QB').length,
  qb_not_in_pdf: nextDiscrepancies.filter((line) => line.type === 'LINE_NOT_FOUND_IN_PDF').length,
  ai_applied_corrections_count: appliedCorrections.length,
  ai_applied_matches_count: appliedMatches.length,
  ai_applied_mismatches_count: appliedDiscrepancies.length,
  ai_audit_only_corrections_count: auditOnlyCorrections.length,
  ai_skipped_corrections_count: skippedCorrections.length,
  totals_match: totalsMatch,
};

return [{
  json: {
    ...data,
    status: finalStatus,
    verified: finalStatus === 'MATCH_TOTAL',
    final_status: finalStatus,
    final_verified: finalStatus === 'MATCH_TOTAL',
    match_status: finalStatus,
    message: finalStatus === 'MATCH_TOTAL'
      ? 'PDF and QuickBooks match after code and AI-confirmed reconciliation.'
      : 'Review required. Remaining mismatches or missing lines were found.',
    matched_lines: nextMatchedLines,
    discrepancias: nextDiscrepancies,
    ai_review: {
      ...aiReview,
      applied_corrections: appliedCorrections,
      audit_only_corrections: auditOnlyCorrections,
      skipped_corrections: skippedCorrections,
    },
    summary,
  },
  binary,
}];
