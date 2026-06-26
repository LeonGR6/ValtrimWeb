const item = $input.first();
const result = item.json || {};
const binary = item.binary || {};

const MONEY_TOL = 0.05;
const QTY_TOL = 0.0001;

function toNumber(value) {
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function moneyMatch(a, b) {
  return Math.abs(toNumber(a) - toNumber(b)) <= MONEY_TOL;
}

function qtyMatch(a, b) {
  return Math.abs(toNumber(a) - toNumber(b)) <= QTY_TOL;
}

function lineKey(value) {
  return String(value ?? '').trim();
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function joinValues(values, separator = ', ') {
  const visible = values.filter(hasValue);
  return visible.length ? visible.join(separator) : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function splitLineRefs(value) {
  return String(value ?? '')
    .split(',')
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildPdfSourceLookup() {
  const sourceLines = Array.isArray(result.pdfData?.line_items)
    ? result.pdfData.line_items
    : [];

  return sourceLines.reduce((lookup, line) => {
    if (hasValue(line.line)) {
      lookup.set(lineKey(line.line), line);
    }

    return lookup;
  }, new Map());
}

function buildQbSourceLookup() {
  const sourceLines = Array.isArray(result.qbData?.qb_line_items)
    ? result.qbData.qb_line_items
    : [];

  return sourceLines.reduce((lookup, line) => {
    const lineNumber = line.qb_line_num ?? line.qb_line ?? line.line;

    if (hasValue(lineNumber)) {
      lookup.set(lineKey(lineNumber), line);
    }

    return lookup;
  }, new Map());
}

function buildDiscrepancyLookup(lines) {
  return lines.reduce((lookup, line) => {
    if (line.type === 'LINE_NOT_FOUND_IN_QB' && hasValue(line.pdf_line)) {
      lookup.pdf.set(lineKey(line.pdf_line), line);
    }

    if (line.type === 'LINE_NOT_FOUND_IN_PDF' && hasValue(line.qb_line)) {
      lookup.qb.set(lineKey(line.qb_line), line);
    }

    return lookup;
  }, { pdf: new Map(), qb: new Map() });
}

function getPdfLineNumber(line) {
  return lineKey(typeof line === 'object' ? line.line ?? line.pdf_line : line);
}

function getQbLineNumber(line) {
  return lineKey(typeof line === 'object' ? line.qb_line_num ?? line.qb_line ?? line.line : line);
}

function getPdfOriginalQty(line) {
  return toNumber(
    line?.pdf_qty ??
    line?.qty ??
    line?.ordered ??
    line?.allocated ??
    0
  );
}

function getPdfUnitPrice(line) {
  return toNumber(line?.pdf_unit_price ?? line?.unit_price ?? 0);
}

function getPdfExtdPrice(line) {
  return roundMoney(line?.pdf_extd_price ?? line?.extd_price ?? (getPdfOriginalQty(line) * getPdfUnitPrice(line)));
}

function resolvePdfSource(lineNumber, discrepancyLookup, pdfSourceLookup) {
  return (
    discrepancyLookup.pdf.get(lineKey(lineNumber)) ||
    pdfSourceLookup.get(lineKey(lineNumber)) ||
    {}
  );
}

function resolveQbSource(lineNumber, discrepancyLookup, qbSourceLookup) {
  return (
    discrepancyLookup.qb.get(lineKey(lineNumber)) ||
    qbSourceLookup.get(lineKey(lineNumber)) ||
    {}
  );
}

function normalizeFullPdfLine(line, discrepancyLookup, pdfSourceLookup) {
  const lineNumber = getPdfLineNumber(line);
  const source = resolvePdfSource(lineNumber, discrepancyLookup, pdfSourceLookup);
  const sourceQty = getPdfOriginalQty(source);
  const unitPrice = getPdfUnitPrice(source);

  return {
    line: lineNumber,
    item_id: source.pdf_item_id ?? source.item_id ?? null,
    description: source.pdf_description ?? source.description ?? null,
    qty_used: sourceQty,
    unit_price: unitPrice,
    extd_price: getPdfExtdPrice(source),
    source_qty: sourceQty,
  };
}

function normalizeFullQbLine(line, discrepancyLookup, qbSourceLookup) {
  const lineNumber = getQbLineNumber(line);
  const source = resolveQbSource(lineNumber, discrepancyLookup, qbSourceLookup);
  const qty = toNumber(source.qb_qty ?? source.qty ?? 0);
  const rate = toNumber(source.qb_rate ?? source.rate ?? 0);

  return {
    line: lineNumber,
    description: source.qb_description ?? source.description ?? null,
    qty,
    rate,
    amount: roundMoney(source.qb_amount ?? source.amount ?? (qty * rate)),
  };
}

function normalizePdfAllocation(allocation, discrepancyLookup, pdfSourceLookup) {
  const lineNumber = getPdfLineNumber(allocation);
  const source = resolvePdfSource(lineNumber, discrepancyLookup, pdfSourceLookup);
  const sourceQty = getPdfOriginalQty(source);
  const qtyUsed = toNumber(allocation.qty_used ?? allocation.qty ?? allocation.pdf_qty);
  const unitPrice = toNumber(allocation.unit_price ?? allocation.pdf_unit_price ?? getPdfUnitPrice(source));
  const extdPrice = hasValue(allocation.extd_price ?? allocation.pdf_extd_price)
    ? roundMoney(allocation.extd_price ?? allocation.pdf_extd_price)
    : roundMoney(qtyUsed * unitPrice);
  const computedExtdPrice = roundMoney(qtyUsed * unitPrice);

  return {
    line: lineNumber,
    item_id: allocation.item_id ?? allocation.pdf_item_id ?? source.pdf_item_id ?? source.item_id ?? null,
    description: allocation.description ?? allocation.pdf_description ?? source.pdf_description ?? source.description ?? null,
    qty_used: qtyUsed,
    unit_price: unitPrice,
    extd_price: extdPrice,
    computed_extd_price: computedExtdPrice,
    source_qty: sourceQty,
  };
}

function normalizeQbAllocation(allocation, discrepancyLookup, qbSourceLookup) {
  const lineNumber = getQbLineNumber(allocation);
  const source = resolveQbSource(lineNumber, discrepancyLookup, qbSourceLookup);
  const qty = toNumber(allocation.qty ?? allocation.qty_used ?? allocation.qb_qty ?? source.qb_qty);
  const rate = toNumber(allocation.rate ?? allocation.unit_price ?? allocation.qb_rate ?? source.qb_rate);
  const amount = hasValue(allocation.amount ?? allocation.qb_amount)
    ? roundMoney(allocation.amount ?? allocation.qb_amount)
    : roundMoney(qty * rate);

  return {
    line: lineNumber,
    description: allocation.description ?? allocation.qb_description ?? source.qb_description ?? source.description ?? null,
    qty,
    rate,
    amount,
  };
}

function buildPdfAllocations(match, discrepancyLookup, pdfSourceLookup) {
  const explicitAllocations = asArray(match.pdf_allocations);

  if (explicitAllocations.length > 0) {
    return explicitAllocations.map((allocation) => normalizePdfAllocation(
      allocation,
      discrepancyLookup,
      pdfSourceLookup
    ));
  }

  return asArray(match.pdf_lines).map((line) => normalizeFullPdfLine(
    line,
    discrepancyLookup,
    pdfSourceLookup
  ));
}

function buildQbAllocations(match, discrepancyLookup, qbSourceLookup) {
  const explicitAllocations = asArray(match.qb_allocations);

  if (explicitAllocations.length > 0) {
    return explicitAllocations.map((allocation) => normalizeQbAllocation(
      allocation,
      discrepancyLookup,
      qbSourceLookup
    ));
  }

  return asArray(match.qb_lines).map((line) => normalizeFullQbLine(
    line,
    discrepancyLookup,
    qbSourceLookup
  ));
}

function sumBy(lines, key) {
  return roundMoney(lines.reduce((sum, line) => sum + toNumber(line[key]), 0));
}

function addToMap(map, key, amount) {
  const cleanKey = lineKey(key);
  map.set(cleanKey, toNumber(map.get(cleanKey)) + toNumber(amount));
}

function buildInitialUsage(matchedLines, pdfSourceLookup) {
  const usedPdfQty = new Map();
  const usedQbLines = new Set();

  for (const line of matchedLines) {
    for (const qbLine of splitLineRefs(line.qb_line)) {
      usedQbLines.add(lineKey(qbLine));
    }

    const pdfLines = splitLineRefs(line.pdf_line);
    const pdfQtys = splitLineRefs(line.pdf_qty);

    pdfLines.forEach((pdfLine, index) => {
      const qtyFromMatch = pdfQtys.length === pdfLines.length ? toNumber(pdfQtys[index]) : null;
      const source = pdfSourceLookup.get(lineKey(pdfLine));
      const qty = qtyFromMatch !== null && Number.isFinite(qtyFromMatch)
        ? qtyFromMatch
        : getPdfOriginalQty(source);

      addToMap(usedPdfQty, pdfLine, qty);
    });
  }

  return { usedPdfQty, usedQbLines };
}

function validateAllocations({
  match,
  pdfAllocations,
  qbAllocations,
  usedPdfQty,
  usedQbLines,
  pdfSourceLookup,
}) {
  const errors = [];

  if (pdfAllocations.length === 0) {
    errors.push('No PDF allocations or PDF lines were provided.');
  }

  if (qbAllocations.length === 0) {
    errors.push('No QB allocations or QB lines were provided.');
  }

  const hasExplicitPdfAllocations = asArray(match.pdf_allocations).length > 0;

  for (const allocation of pdfAllocations) {
    if (!hasValue(allocation.line)) {
      errors.push('A PDF allocation is missing line.');
      continue;
    }

    if (allocation.qty_used <= 0) {
      errors.push(`PDF line ${allocation.line} has invalid qty_used.`);
    }

    if (allocation.unit_price < 0) {
      errors.push(`PDF line ${allocation.line} has invalid unit_price.`);
    }

    if (!moneyMatch(allocation.extd_price, allocation.computed_extd_price)) {
      errors.push(
        `PDF line ${allocation.line} extd_price ${allocation.extd_price} does not equal qty_used * unit_price ${allocation.computed_extd_price}.`
      );
    }

    const source = pdfSourceLookup.get(lineKey(allocation.line));
    const sourceQty = allocation.source_qty || getPdfOriginalQty(source);
    const nextUsedQty = toNumber(usedPdfQty.get(lineKey(allocation.line))) + allocation.qty_used;

    if (sourceQty > 0 && nextUsedQty > sourceQty + QTY_TOL) {
      errors.push(`PDF line ${allocation.line} is over-allocated: ${nextUsedQty} used of ${sourceQty}.`);
    }
  }

  for (const allocation of qbAllocations) {
    if (!hasValue(allocation.line)) {
      errors.push('A QB allocation is missing line.');
      continue;
    }

    if (usedQbLines.has(lineKey(allocation.line))) {
      errors.push(`QB line ${allocation.line} is already matched.`);
    }

    if (allocation.amount < 0) {
      errors.push(`QB line ${allocation.line} has invalid amount.`);
    }
  }

  const pdfTotal = sumBy(pdfAllocations, 'extd_price');
  const qbTotal = sumBy(qbAllocations, 'amount');

  if (!moneyMatch(pdfTotal, qbTotal)) {
    errors.push(`Allocation totals do not match: PDF ${pdfTotal}, QB ${qbTotal}.`);
  }

  if (match.financials_match === true && !hasExplicitPdfAllocations && !moneyMatch(pdfTotal, qbTotal)) {
    errors.push('AI marked financials_match=true, but only full-line totals were provided and they do not match.');
  }

  return {
    errors,
    pdfTotal,
    qbTotal,
  };
}

function buildMatchedLine(match, pdfAllocations, qbAllocations, pdfTotal, qbTotal) {
  return {
    status: 'MATCHED',
    match_type: match.match_type || (pdfAllocations.length > 1 || qbAllocations.length > 1 ? 'GROUPED_AI_MATCH' : 'ONE_TO_ONE'),
    match_rule: asArray(match.pdf_allocations).length > 0
      ? 'AI_ACCEPTED_ALLOCATED_MATCH'
      : 'AI_ACCEPTED_FINANCIAL_MATCH',
    pdf_line: joinValues(pdfAllocations.map((line) => line.line)),
    pdf_item_id: joinValues(pdfAllocations.map((line) => line.item_id)),
    pdf_description: joinValues(pdfAllocations.map((line) => line.description)),
    pdf_qty: joinValues(pdfAllocations.map((line) => line.qty_used)),
    pdf_unit_price: joinValues(pdfAllocations.map((line) => line.unit_price)),
    pdf_extd_price: pdfTotal,
    qb_line: joinValues(qbAllocations.map((line) => line.line)),
    qb_description: joinValues(qbAllocations.map((line) => line.description)),
    qb_qty: joinValues(qbAllocations.map((line) => line.qty)),
    qb_rate: joinValues(qbAllocations.map((line) => line.rate)),
    qb_amount: qbTotal,
    pdf_allocations: pdfAllocations,
    qb_allocations: qbAllocations,
    match_score: 100,
    match_similarity: 1,
    message: match.reason || 'AI accepted allocated match. Financials match.',
  };
}

function updateDiscrepancies(discrepancies, usedPdfQty, usedQbLines, pdfSourceLookup) {
  return discrepancies.flatMap((line) => {
    if (line.type === 'LINE_NOT_FOUND_IN_QB' && hasValue(line.pdf_line)) {
      const pdfLine = lineKey(line.pdf_line);
      const source = pdfSourceLookup.get(pdfLine) || line;
      const originalQty = getPdfOriginalQty(line) || getPdfOriginalQty(source);
      const usedQty = toNumber(usedPdfQty.get(pdfLine));

      if (usedQty <= QTY_TOL) {
        return [line];
      }

      const remainingQty = originalQty - usedQty;

      if (remainingQty <= QTY_TOL) {
        return [];
      }

      const unitPrice = getPdfUnitPrice(line) || getPdfUnitPrice(source);

      return [{
        ...line,
        pdf_qty: remainingQty,
        pdf_extd_price: roundMoney(remainingQty * unitPrice),
        message: `Residual PDF quantity still not found in QuickBooks after AI allocation: ${remainingQty} remaining from original qty ${originalQty}.`,
      }];
    }

    if (line.type === 'LINE_NOT_FOUND_IN_PDF' && hasValue(line.qb_line)) {
      return usedQbLines.has(lineKey(line.qb_line)) ? [] : [line];
    }

    return [line];
  });
}

function reasonConfirmsDescriptionMatch(reason) {
  return (
    /\b(?:match(?:es|ed)?|coincid(?:e|en|encia|encias))\b/i.test(reason) &&
    /\b(?:physical|product(?:\s+details)?|description|descripcion|descripci[oó]n|details|specifications?|especificaci(?:o|ó)n(?:es)?|size|hand(?:ing)?|mano|cantidad|qty|casing|profile)\b/i.test(reason)
  );
}

function reasonConfirmsPriceDifference(reason) {
  return (
    /\b(?:unit\s+price|price|rate|cost|precio|tarifa)\b/i.test(reason) &&
    /\b(?:diff(?:erence|erent)?|differ|mismatch|review|diferencia|difiere|difieren|distinto|distinta)\b/i.test(reason)
  );
}

function hasPriceOnlyAiDifference(pdfAllocation, qbAllocation, aiDifferences) {
  const pdfLine = lineKey(pdfAllocation.line);
  const qbLine = lineKey(qbAllocation.line);
  const pairDifferences = asArray(aiDifferences).filter((difference) => (
    lineKey(difference.pdf_line) === pdfLine &&
    lineKey(difference.qb_line) === qbLine
  ));

  return (
    pairDifferences.length > 0 &&
    pairDifferences.some((difference) => String(difference.type || '').toUpperCase() === 'PRICE') &&
    pairDifferences.every((difference) => String(difference.type || '').toUpperCase() === 'PRICE')
  );
}

function isOneToOnePriceOnlySuggestedMatch(match, pdfAllocations, qbAllocations, aiDifferences) {
  if (match?.financials_match === true && match?.needs_human_review !== true) {
    return false;
  }

  if (pdfAllocations.length !== 1 || qbAllocations.length !== 1) {
    return false;
  }

  const pdfAllocation = pdfAllocations[0] || {};
  const qbAllocation = qbAllocations[0] || {};
  const reason = String(match?.reason || match?.message || '');
  const isStructuredPriceOnly = hasPriceOnlyAiDifference(pdfAllocation, qbAllocation, aiDifferences);
  const reasonLooksPriceOnly = (
    reasonConfirmsDescriptionMatch(reason) &&
    reasonConfirmsPriceDifference(reason)
  );

  return (
    hasValue(pdfAllocation.line) &&
    hasValue(qbAllocation.line) &&
    qtyMatch(pdfAllocation.qty_used, qbAllocation.qty) &&
    (
      !moneyMatch(pdfAllocation.unit_price, qbAllocation.rate) ||
      !moneyMatch(pdfAllocation.extd_price, qbAllocation.amount)
    ) &&
    (isStructuredPriceOnly || reasonLooksPriceOnly)
  );
}

function canUsePriceOnlySuggestedMatch(pdfAllocation, qbAllocation, usedPdfQty, usedQbLines, pdfSourceLookup) {
  if (usedQbLines.has(lineKey(qbAllocation.line))) {
    return false;
  }

  const source = pdfSourceLookup.get(lineKey(pdfAllocation.line));
  const sourceQty = pdfAllocation.source_qty || getPdfOriginalQty(source);
  const nextUsedQty = toNumber(usedPdfQty.get(lineKey(pdfAllocation.line))) + pdfAllocation.qty_used;

  return sourceQty <= 0 || nextUsedQty <= sourceQty + QTY_TOL;
}

const suggestedMatches = asArray(result.ai_suggested_matches);
const aiDifferences = asArray(result.ai_differences);
const matchedLines = Array.isArray(result.matched_lines) ? [...result.matched_lines] : [];
const discrepancies = Array.isArray(result.discrepancias) ? [...result.discrepancias] : [];
const pdfSourceLookup = buildPdfSourceLookup();
const qbSourceLookup = buildQbSourceLookup();
const discrepancyLookup = buildDiscrepancyLookup(discrepancies);
const validationNotes = Array.isArray(result.ai_validation_notes) ? [...result.ai_validation_notes] : [];
const { usedPdfQty, usedQbLines } = buildInitialUsage(matchedLines, pdfSourceLookup);
const hydratedSuggestedMatches = suggestedMatches.map((match) => ({
  ...match,
  pdf_allocations: buildPdfAllocations(match, discrepancyLookup, pdfSourceLookup),
  qb_allocations: buildQbAllocations(match, discrepancyLookup, qbSourceLookup),
}));
const acceptedMatches = suggestedMatches
  .filter((match) => match?.financials_match === true && match?.needs_human_review !== true);

let promotedCount = 0;

for (const match of acceptedMatches) {
  const pdfAllocations = buildPdfAllocations(match, discrepancyLookup, pdfSourceLookup);
  const qbAllocations = buildQbAllocations(match, discrepancyLookup, qbSourceLookup);
  const validation = validateAllocations({
    match,
    pdfAllocations,
    qbAllocations,
    usedPdfQty,
    usedQbLines,
    pdfSourceLookup,
  });

  if (validation.errors.length > 0) {
    validationNotes.push({
      type: 'AI_MATCH_REJECTED',
      severity: 'WARNING',
      match_type: match.match_type || null,
      pdf_lines: asArray(match.pdf_lines),
      qb_lines: asArray(match.qb_lines),
      errors: validation.errors,
      reason: match.reason || null,
    });
    continue;
  }

  matchedLines.push(buildMatchedLine(
    match,
    pdfAllocations,
    qbAllocations,
    validation.pdfTotal,
    validation.qbTotal
  ));

  for (const allocation of pdfAllocations) {
    addToMap(usedPdfQty, allocation.line, allocation.qty_used);
  }

  for (const allocation of qbAllocations) {
    usedQbLines.add(lineKey(allocation.line));
  }

  promotedCount += 1;
}

let priceOnlySuggestedMatchesCount = 0;

for (const match of hydratedSuggestedMatches) {
  const pdfAllocations = asArray(match.pdf_allocations);
  const qbAllocations = asArray(match.qb_allocations);

  if (!isOneToOnePriceOnlySuggestedMatch(match, pdfAllocations, qbAllocations, aiDifferences)) {
    continue;
  }

  const pdfAllocation = pdfAllocations[0];
  const qbAllocation = qbAllocations[0];

  if (!canUsePriceOnlySuggestedMatch(
    pdfAllocation,
    qbAllocation,
    usedPdfQty,
    usedQbLines,
    pdfSourceLookup
  )) {
    continue;
  }

  addToMap(usedPdfQty, pdfAllocation.line, pdfAllocation.qty_used);
  usedQbLines.add(lineKey(qbAllocation.line));
  priceOnlySuggestedMatchesCount += 1;
}

const nextDiscrepancies = updateDiscrepancies(
  discrepancies,
  usedPdfQty,
  usedQbLines,
  pdfSourceLookup
);

const summary = {
  ...(result.summary || {}),
  matched_lines_count: matchedLines.length,
  discrepancies_count: nextDiscrepancies.length,
  pdf_not_in_qb: nextDiscrepancies.filter((line) => line.type === 'LINE_NOT_FOUND_IN_QB').length,
  qb_not_in_pdf: nextDiscrepancies.filter((line) => line.type === 'LINE_NOT_FOUND_IN_PDF').length,
  ai_promoted_matches_count: promotedCount,
  ai_rejected_matches_count: validationNotes.filter((note) => note.type === 'AI_MATCH_REJECTED').length,
  ai_price_only_suggested_matches_count: priceOnlySuggestedMatchesCount,
};

const aiApproved = result.ai_final_status === 'APPROVED' || result.final_status === 'AI_APPROVED';
const isMatched = nextDiscrepancies.length === 0 && aiApproved;

return [{
  json: {
    ...result,
    status: isMatched ? 'MATCH_TOTAL' : result.status,
    verified: isMatched ? true : result.verified,
    final_status: isMatched ? 'MATCH_TOTAL' : result.final_status,
    final_verified: isMatched ? true : result.final_verified,
    discrepancias: nextDiscrepancies,
    matched_lines: matchedLines,
    ai_suggested_matches: hydratedSuggestedMatches,
    ai_validation_notes: validationNotes,
    summary,
  },
  binary,
}];
