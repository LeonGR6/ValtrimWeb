const item = $input.first();
const data = item.json || {};
const binary = item.binary || {};

function toNumber(value) {
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value) {
  return Math.round(toNumber(value) * 100) / 100;
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

function normalizeDescription(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getPdfHand(item) {
  const value = normalizeDescription(`${item?.description || ''} ${item?.pdf_description || ''}`);

  if (/\b(?:LH|LEFT\s+HAND|HANDING\s+L|HAND\s*:\s*L)\b/.test(value)) return 'L';
  if (/\b(?:RH|RIGHT\s+HAND|HANDING\s+R|HAND\s*:\s*R)\b/.test(value)) return 'R';

  return null;
}

function handSortValue(item) {
  const hand = getPdfHand(item);

  if (hand === 'L') return 0;
  if (hand === 'R') return 1;

  return 2;
}

function getPdfSourceLines(data) {
  return Array.isArray(data.pdfData?.line_items)
    ? data.pdfData.line_items
    : [];
}

function sameMoney(a, b) {
  return Math.abs(toNumber(a) - toNumber(b)) <= 0.01;
}

function hydratePdfItems(pdfItems, data) {
  const sourceLines = getPdfSourceLines(data);
  const usedSourceIndexes = new Set();

  return pdfItems
    .map((item) => {
      if (hasValue(item.line)) return item;

      const itemDescription = normalizeDescription(item.description);
      const sourceIndex = sourceLines.findIndex((source, index) => {
        if (usedSourceIndexes.has(index)) return false;

        const sourceDescription = normalizeDescription(source.description);

        return (
          sourceDescription === itemDescription &&
          sameMoney(source.extd_price, item.extd_price) &&
          sameMoney(source.unit_price, item.unit_price) &&
          toNumber(source.ordered ?? source.qty ?? source.pdf_qty) === toNumber(item.qty)
        );
      });

      if (sourceIndex === -1) return item;

      usedSourceIndexes.add(sourceIndex);
      return {
        ...item,
        line: sourceLines[sourceIndex].line ?? item.line,
        item_id: item.item_id ?? sourceLines[sourceIndex].item_id ?? null,
      };
    })
    .sort((a, b) => handSortValue(a) - handSortValue(b));
}

function splitLineRefs(value) {
  return String(value ?? '')
    .split(',')
    .map((line) => line.trim())
    .filter(Boolean);
}

function groupedWarningKey(warning) {
  const pdfLines = (warning.pdf_items || [])
    .map((line) => line.line)
    .filter(Boolean)
    .join(', ');

  return `${pdfLines}|${lineKey(warning.qb_line)}`;
}

function isGroupedWarningAlreadyMatched(warning, matchedLines) {
  const qbLine = lineKey(warning.qb_line);
  const pdfItems = hydratePdfItems(
    Array.isArray(warning.pdf_items) ? warning.pdf_items : [],
    data
  );
  const warningPdfLines = pdfItems.map((line) => lineKey(line.line)).filter(Boolean);

  return matchedLines.some((line) => {
    const matchedQbLines = splitLineRefs(line.qb_line);
    const matchedPdfLines = splitLineRefs(line.pdf_line);

    if (!matchedQbLines.includes(qbLine)) {
      return false;
    }

    if (warningPdfLines.length === 0) {
      return true;
    }

    return warningPdfLines.every((pdfLine) => matchedPdfLines.includes(pdfLine));
  });
}

function warningToMatchedLine(warning) {
  const pdfItems = hydratePdfItems(
    Array.isArray(warning.pdf_items) ? warning.pdf_items : [],
    data
  );
  const pdfTotal = roundMoney(pdfItems.reduce((sum, line) => sum + toNumber(line.extd_price), 0));

  return {
    status: 'MATCHED',
    match_type: 'MANY_PDF_TO_ONE_QB',
    match_rule: 'QB_GROUPED_LINES_TOTAL',
    pdf_line: joinValues(pdfItems.map((line) => line.line)),
    pdf_item_id: joinValues(pdfItems.map((line) => line.item_id)),
    pdf_description: joinValues(pdfItems.map((line) => line.description), ' / '),
    pdf_qty: joinValues(pdfItems.map((line) => line.qty)),
    pdf_unit_price: joinValues(pdfItems.map((line) => line.unit_price)),
    pdf_extd_price: pdfTotal,
    qb_line: warning.qb_line,
    qb_description: warning.qb_description,
    qb_qty: warning.qb_qty,
    qb_rate: warning.qb_rate,
    qb_amount: roundMoney(warning.qb_amount),
    match_score: 100,
    match_similarity: 1,
    message: warning.message || 'QuickBooks grouped multiple PDF lines into one line. Total amount matches.',
  };
}

const warnings = Array.isArray(data.warnings) ? data.warnings : [];
const matchedLines = Array.isArray(data.matched_lines) ? [...data.matched_lines] : [];
const auditNotes = Array.isArray(data.audit_notes) ? [...data.audit_notes] : [];
const actionableWarnings = [];
let groupedWarningsMoved = 0;

for (const warning of warnings) {
  if (warning?.type === 'QB_GROUPED_LINES') {
    if (!isGroupedWarningAlreadyMatched(warning, matchedLines)) {
      matchedLines.push(warningToMatchedLine(warning));
      groupedWarningsMoved += 1;
    }

    auditNotes.push({
      ...warning,
      type: 'QB_GROUPED_LINES',
      severity: 'INFO',
      message: warning.message || 'QuickBooks grouped multiple PDF lines into one line. Total amount matches.',
    });

    continue;
  }

  actionableWarnings.push(warning);
}

const discrepancies = Array.isArray(data.discrepancias) ? data.discrepancias : [];
const summary = {
  ...(data.summary || {}),
  matched_lines_count: matchedLines.length,
  discrepancies_count: discrepancies.length,
  warnings_count: actionableWarnings.length,
  audit_notes_count: auditNotes.length,
  grouped_warnings_promoted_count: groupedWarningsMoved,
};

return [{
  json: {
    ...data,
    warnings: actionableWarnings,
    audit_notes: auditNotes,
    matched_lines: matchedLines,
    summary,
  },
  binary,
}];
