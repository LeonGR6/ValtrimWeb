const item = $input.first();
const result = item.json || {};
const binary = item.binary || {};

const MONEY_TOL = 0.05;

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

function lineKey(value) {
  return String(value ?? '').trim();
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function joinValues(values) {
  const visible = values.filter(hasValue);
  return visible.length ? visible.join(', ') : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sumLineTotal(lines, keys) {
  return roundMoney(lines.reduce((sum, line) => {
    const value = keys.map((key) => line[key]).find(hasValue);
    return sum + toNumber(value);
  }, 0));
}

function getPdfLineNumber(line) {
  return lineKey(typeof line === 'object' ? line.line ?? line.pdf_line : line);
}

function getQbLineNumber(line) {
  return lineKey(typeof line === 'object' ? line.qb_line_num ?? line.qb_line ?? line.line : line);
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

function normalizePdfLine(line, lookup) {
  if (line && typeof line === 'object') {
    const lineNumber = getPdfLineNumber(line);
    const fallback = lookup.pdf.get(lineNumber) || {};

    return {
      ...fallback,
      pdf_line: fallback.pdf_line ?? lineNumber,
      pdf_item_id: fallback.pdf_item_id ?? line.item_id ?? line.pdf_item_id ?? null,
      pdf_description: fallback.pdf_description ?? line.description ?? line.pdf_description ?? null,
      pdf_qty: fallback.pdf_qty ?? line.qty ?? line.pdf_qty ?? null,
      pdf_unit_price: fallback.pdf_unit_price ?? line.unit_price ?? line.pdf_unit_price ?? null,
      pdf_extd_price: fallback.pdf_extd_price ?? line.extd_price ?? line.pdf_extd_price ?? null,
    };
  }

  return lookup.pdf.get(getPdfLineNumber(line)) || { pdf_line: getPdfLineNumber(line) };
}

function normalizeQbLine(line, lookup) {
  if (line && typeof line === 'object') {
    const lineNumber = getQbLineNumber(line);
    const fallback = lookup.qb.get(lineNumber) || {};

    return {
      ...fallback,
      qb_line: fallback.qb_line ?? lineNumber,
      qb_description: fallback.qb_description ?? line.qb_description ?? line.description ?? null,
      qb_qty: fallback.qb_qty ?? line.qb_qty ?? line.qty ?? null,
      qb_rate: fallback.qb_rate ?? line.qb_rate ?? line.rate ?? null,
      qb_amount: fallback.qb_amount ?? line.qb_amount ?? line.amount ?? null,
    };
  }

  return lookup.qb.get(getQbLineNumber(line)) || { qb_line: getQbLineNumber(line) };
}

const acceptedMatches = (Array.isArray(result.ai_suggested_matches) ? result.ai_suggested_matches : [])
  .filter((match) => match?.financials_match === true && match?.needs_human_review !== true);

const matchedLines = Array.isArray(result.matched_lines) ? [...result.matched_lines] : [];
const discrepancies = Array.isArray(result.discrepancias) ? [...result.discrepancias] : [];
const discrepancyLookup = buildDiscrepancyLookup(discrepancies);
const usedPdfLines = new Set();
const usedQbLines = new Set();
const existingMatchKeys = new Set(matchedLines.map((line) => (
  `${lineKey(line.pdf_line)}|${lineKey(line.qb_line)}`
)));

for (const match of acceptedMatches) {
  const pdfLines = asArray(match.pdf_lines).map((line) => normalizePdfLine(line, discrepancyLookup));
  const qbLines = asArray(match.qb_lines).map((line) => normalizeQbLine(line, discrepancyLookup));
  const pdfLineNums = pdfLines.map((line) => lineKey(line.pdf_line)).filter(Boolean);
  const qbLineNums = qbLines.map((line) => lineKey(line.qb_line)).filter(Boolean);
  const matchKey = `${pdfLineNums.join(', ')}|${qbLineNums.join(', ')}`;

  if (!pdfLineNums.length || !qbLineNums.length || existingMatchKeys.has(matchKey)) {
    continue;
  }

  const pdfTotal = sumLineTotal(pdfLines, ['extd_price', 'pdf_extd_price']);
  const qbTotal = sumLineTotal(qbLines, ['qb_amount', 'amount']);

  if (!moneyMatch(pdfTotal, qbTotal)) {
    continue;
  }

  matchedLines.push({
    status: 'MATCHED',
    match_type: match.match_type || (pdfLines.length > 1 || qbLines.length > 1 ? 'GROUPED_AI_MATCH' : 'ONE_TO_ONE'),
    match_rule: 'AI_ACCEPTED_FINANCIAL_MATCH',
    pdf_line: pdfLineNums.join(', '),
    pdf_item_id: joinValues(pdfLines.map((line) => line.pdf_item_id ?? line.item_id)),
    pdf_description: joinValues(pdfLines.map((line) => line.pdf_description ?? line.description)),
    pdf_qty: joinValues(pdfLines.map((line) => line.pdf_qty ?? line.qty)),
    pdf_unit_price: joinValues(pdfLines.map((line) => line.pdf_unit_price ?? line.unit_price)),
    pdf_extd_price: pdfTotal,
    qb_line: qbLineNums.join(', '),
    qb_description: joinValues(qbLines.map((line) => line.qb_description ?? line.description)),
    qb_qty: joinValues(qbLines.map((line) => line.qb_qty ?? line.qty)),
    qb_rate: joinValues(qbLines.map((line) => line.qb_rate ?? line.rate)),
    qb_amount: qbTotal,
    match_score: 100,
    match_similarity: 1,
    message: match.reason || 'AI accepted suggested match. Financials match.',
  });

  existingMatchKeys.add(matchKey);
  pdfLineNums.forEach((line) => usedPdfLines.add(line));
  qbLineNums.forEach((line) => usedQbLines.add(line));
}

const nextDiscrepancies = discrepancies.filter((line) => {
  if (line.type === 'LINE_NOT_FOUND_IN_QB' && usedPdfLines.has(lineKey(line.pdf_line))) {
    return false;
  }

  if (line.type === 'LINE_NOT_FOUND_IN_PDF' && usedQbLines.has(lineKey(line.qb_line))) {
    return false;
  }

  return true;
});

const summary = {
  ...(result.summary || {}),
  matched_lines_count: matchedLines.length,
  discrepancies_count: nextDiscrepancies.length,
  pdf_not_in_qb: nextDiscrepancies.filter((line) => line.type === 'LINE_NOT_FOUND_IN_QB').length,
  qb_not_in_pdf: nextDiscrepancies.filter((line) => line.type === 'LINE_NOT_FOUND_IN_PDF').length,
  ai_promoted_matches_count: acceptedMatches.length,
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
    summary,
  },
  binary,
}];
