const item = $input.first();
const data = item.json || {};
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

function qtyMatch(a, b) {
  return Math.abs(toNumber(a) - toNumber(b)) < 0.0001;
}

function text(value) {
  return String(value || '').toUpperCase();
}

function getPdfHand(description) {
  const value = text(description);
  if (/\bRH\b/.test(value)) return 'R';
  if (/\bLH\b/.test(value)) return 'L';
  return null;
}

function getQbHands(description) {
  const value = text(description);
  const hands = new Set();

  for (const match of value.matchAll(/\b(?:\d+\s*)?(LH|RH)\b/g)) {
    hands.add(match[1] === 'LH' ? 'L' : 'R');
  }

  const handLabel = value.match(/HAND:\s*([RL])/);
  if (handLabel) {
    hands.add(handLabel[1]);
  }

  return hands;
}

function isMetalHandingPdf(description) {
  const value = text(description);
  return /\bMETAL\b/.test(value) && getPdfHand(value);
}

function handCompatible(pdfDescription, qbDescription) {
  const pdfHand = getPdfHand(pdfDescription);
  const qbHands = getQbHands(qbDescription);

  if (!pdfHand || qbHands.size === 0) {
    return false;
  }

  const expectedQbHand = pdfHand === 'R' ? 'L' : 'R';
  return qbHands.has(expectedQbHand);
}

function normalizeDimensionToken(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/"/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getWidth(description) {
  const value = normalizeDimensionToken(description);
  const match = value.match(/\b(\d+\s*[-/]\s*\d{1,2})\b/);
  return match ? match[1].replace(/\s+/g, '').replace('/', '-') : null;
}

function parseFraction(value) {
  const match = String(value || '').match(/^(\d+)\/(\d+)$/);
  if (!match) return 0;
  const denominator = Number(match[2]);
  return denominator ? Number(match[1]) / denominator : 0;
}

function inchesFromHeight(value) {
  const height = normalizeDimensionToken(value);

  let match = height.match(/^(\d+)\s*'\s*(\d{1,2})(?:[-\s](\d+\/\d+))?$/);
  if (match) {
    return Number(match[1]) * 12 + Number(match[2]) + parseFraction(match[3]);
  }

  match = height.match(/^(\d+)\s*[-/]\s*(\d{1,2})(?:[-\s](\d+\/\d+))?$/);
  if (match) {
    return Number(match[1]) * 12 + Number(match[2]) + parseFraction(match[3]);
  }

  return null;
}

function getHeightInches(description) {
  const value = normalizeDimensionToken(description);

  let match = value.match(/\b\d+\s*[-/]\s*\d{1,2}\s*X\s*(\d+\s*'\s*\d{1,2}(?:[-\s]\d+\/\d+)?|\d+\s*[-/]\s*\d{1,2}(?:[-\s]\d+\/\d+)?)\b/);
  if (match) {
    return inchesFromHeight(match[1]);
  }

  match = value.match(/\b\d+\s*[-/]\s*\d{1,2}\s+\d+\/\d+\s+(\d+\s*[-/]\s*\d{1,2}(?:[-\s]\d+\/\d+)?)\b/);
  if (match) {
    return inchesFromHeight(match[1]);
  }

  match = value.match(/\b\d+\s*[-/]\s*\d{1,2}\s+(\d+\s*[-/]\s*\d{1,2}(?:[-\s]\d+\/\d+)?)\b/);
  if (match) {
    return inchesFromHeight(match[1]);
  }

  return null;
}

function dimensionsCompatible(pdfDescription, qbDescription) {
  const pdfWidth = getWidth(pdfDescription);
  const qbWidth = getWidth(qbDescription);
  const pdfHeight = getHeightInches(pdfDescription);
  const qbHeight = getHeightInches(qbDescription);

  if (pdfWidth && qbWidth && pdfWidth !== qbWidth) {
    return false;
  }

  if (pdfHeight !== null && qbHeight !== null && Math.abs(pdfHeight - qbHeight) > 0.125) {
    return false;
  }

  return true;
}

function isAlreadyMatched(matchedLines, pdfLine, qbLine) {
  return matchedLines.some((line) => (
    String(line.pdf_line ?? '').split(',').map((value) => value.trim()).includes(String(pdfLine)) ||
    String(line.qb_line ?? '').split(',').map((value) => value.trim()).includes(String(qbLine))
  ));
}

const discrepancies = Array.isArray(data.discrepancias) ? [...data.discrepancias] : [];
const matchedLines = Array.isArray(data.matched_lines) ? [...data.matched_lines] : [];

const pdfOnly = discrepancies
  .map((line, index) => ({ line, index }))
  .filter(({ line }) => line.type === 'LINE_NOT_FOUND_IN_QB' && isMetalHandingPdf(line.pdf_description));

const qbOnly = discrepancies
  .map((line, index) => ({ line, index }))
  .filter(({ line }) => line.type === 'LINE_NOT_FOUND_IN_PDF');

const usedIndexes = new Set();

for (const { line: pdfLine, index: pdfIndex } of pdfOnly) {
  if (usedIndexes.has(pdfIndex)) continue;

  const match = qbOnly.find(({ line: qbLine, index: qbIndex }) => (
    !usedIndexes.has(qbIndex) &&
    !isAlreadyMatched(matchedLines, pdfLine.pdf_line, qbLine.qb_line) &&
    qtyMatch(pdfLine.pdf_qty, qbLine.qb_qty) &&
    moneyMatch(pdfLine.pdf_unit_price, qbLine.qb_rate) &&
    moneyMatch(pdfLine.pdf_extd_price, qbLine.qb_amount) &&
    handCompatible(pdfLine.pdf_description, qbLine.qb_description) &&
    dimensionsCompatible(pdfLine.pdf_description, qbLine.qb_description)
  ));

  if (!match) continue;

  const qbLine = match.line;

  matchedLines.push({
    status: 'MATCHED',
    match_type: 'ONE_TO_ONE',
    match_rule: 'METAL_HANDING_INVERTED_FINANCIAL_MATCH',
    pdf_line: pdfLine.pdf_line,
    pdf_item_id: pdfLine.pdf_item_id ?? pdfLine.item_id ?? null,
    pdf_description: pdfLine.pdf_description,
    pdf_qty: pdfLine.pdf_qty,
    pdf_unit_price: pdfLine.pdf_unit_price,
    pdf_extd_price: roundMoney(pdfLine.pdf_extd_price),
    qb_line: qbLine.qb_line,
    qb_description: qbLine.qb_description,
    qb_qty: qbLine.qb_qty,
    qb_rate: qbLine.qb_rate,
    qb_amount: roundMoney(qbLine.qb_amount),
    match_score: 100,
    match_similarity: 1,
    message: 'Automatic one-to-one match for metal handing. PDF RH/LH METAL maps to the opposite QB LH/RH hand, with exact quantity, unit price, and total.',
  });

  usedIndexes.add(pdfIndex);
  usedIndexes.add(match.index);
}

const nextDiscrepancies = discrepancies.filter((_, index) => !usedIndexes.has(index));
const summary = {
  ...(data.summary || {}),
  discrepancies_count: nextDiscrepancies.length,
  matched_lines_count: matchedLines.length,
  pdf_not_in_qb: nextDiscrepancies.filter((line) => line.type === 'LINE_NOT_FOUND_IN_QB').length,
  qb_not_in_pdf: nextDiscrepancies.filter((line) => line.type === 'LINE_NOT_FOUND_IN_PDF').length,
};

return [{
  json: {
    ...data,
    status: nextDiscrepancies.length === 0 ? 'MATCH_TOTAL' : data.status,
    verified: nextDiscrepancies.length === 0 ? true : data.verified,
    discrepancias: nextDiscrepancies,
    matched_lines: matchedLines,
    summary,
  },
  binary,
}];
