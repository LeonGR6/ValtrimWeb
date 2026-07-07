import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import PODetailHeader from '../components/po-detail/PODetailHeader.jsx';
import PONotesPanel from '../components/po-detail/PONotesPanel.jsx';
import PODetailTable from '../components/po-detail/PODetailTable.jsx';
import { getPersistenceNotifications } from '../utils/reconciliationNotifications.js';
import {
  fetchCurrentPurchaseOrderPdf,
  fetchPurchaseOrderByPoNumber,
  formatDisplayDate,
  formatWorkflowStatus,
  reconcilePurchaseOrderWithCurrentPdf,
  updateQuickBooksPurchaseOrderLine,
  updatePurchaseOrderNote,
  updatePurchaseOrderWorkflowStatus,
} from '../../../../services/purchaseOrdersApi.js';

const MOCK_PO = {
  poNumber: '33308',
  vendor: 'Woodgrain Millwork',
  job: 'Magnolia Phase 6',
  phase: 'Lots 39-45',
  requiredDate: '06/11/2026',
  vendorShipDate: '06/05/2026',
  total: '$24,658.77',
  status: 'needs-review',
  confirmation: 'RECEIVED',
};

const MOCK_LINES = [
  {
    status: 'matched',
    aiMatch: 98,
    issueType: null,
    poLineNumber: 1,
    poQty: 2,
    confQty: 2,
    poDescription: '2-8 x 6-8 SC 2 Panel D/B',
    vendorDescription: {
      itemId: null,
      description: 'HTT Entry Unit 2/8 6/8 SC 2PNL Double Bore',
    },
    poUnitCost: 133.18,
    confUnitCost: 133.18,
    poTotal: 266.36,
    confTotal: 266.36,
    variance: 0,
    reqDate: '06/11/2026',
    vendorShipDate: '06/05/2026',
  },
  {
    status: 'price-issue',
    aiMatch: 86,
    issueType: 'Price',
    poLineNumber: 12,
    poQty: 1,
    confQty: 1,
    poDescription: '3-0 x 6-8 x 1-3/4 SC Carrara 2-Panel SQ 20MIN D/B SI',
    vendorDescription: {
      itemId: null,
      description: 'HTT ENTRY UNIT 3/0 6/8 1-3/4 RH SC 2PNL SQ 20MIN DBL BORE',
    },
    poUnitCost: 133.18,
    confUnitCost: 142.27,
    poTotal: 133.18,
    confTotal: 142.27,
    variance: 9.09,
    reqDate: '06/11/2026',
    vendorShipDate: '06/05/2026',
  },
];

const formatCurrency = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatPlainNumber = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return value ?? '-';
  }

  return amount.toLocaleString('en-US', {
    maximumFractionDigits: 2,
  });
};

const isSingleNumericValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return false;
  }

  if (typeof value === 'string' && value.includes(',')) {
    return false;
  }

  return Number.isFinite(Number(value));
};

const isStaleQuickBooksError = (error) => (
  /QuickBooks (?:quantity|rate) changed .*Refresh before saving/i.test(error?.message || '')
);

const formatStatus = (status) => {
  return formatWorkflowStatus(status);
};

const mapLineStatus = (line) => {
  if (line.status === 'MATCHED') return 'matched';

  if (line.type === 'LINE_NOT_FOUND_IN_QB') {
    return 'extra';
  }

  if (line.type === 'LINE_NOT_FOUND_IN_PDF') {
    return 'missing';
  }

  if (line.type?.includes('QTY')) {
    return 'qty-issue';
  }

  if (line.type?.includes('PRICE')) {
    return 'price-issue';
  }

  return 'price-issue';
};

const formatIssueType = (line) => {
  if (line.status === 'MATCHED') return null;
  if (!line.type) return line.message || 'Review';

  if (line.type === 'LINE_NOT_FOUND_IN_QB') {
    return 'Found in PDF, Missing in QuickBooks';
  }

  if (line.type === 'LINE_NOT_FOUND_IN_PDF') {
    return 'Found in QuickBooks, Missing in PDF';
  }

  return line.type
    .replace(/^LINE_NOT_FOUND_IN_/, 'Missing in ')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const getVariance = (pdfTotal, qbTotal) => {
  const pdfAmount = Number(pdfTotal);
  const qbAmount = Number(qbTotal);

  if (!Number.isFinite(pdfAmount) || !Number.isFinite(qbAmount)) {
    return null;
  }

  return pdfAmount - qbAmount;
};

const sumNumbers = (values) => {
  const validValues = values.map(Number).filter(Number.isFinite);

  if (validValues.length === 0) {
    return null;
  }

  return validValues.reduce((total, value) => total + value, 0);
};

const joinValues = (values, separator = ', ') => {
  const visibleValues = values.filter((value) => value !== null && value !== undefined && value !== '');

  return visibleValues.length > 0 ? visibleValues.join(separator) : null;
};

const splitGroupedValues = (value, separator = ',') => {
  if (value === null || value === undefined || value === '') {
    return [];
  }

  return String(value)
    .split(separator)
    .map((item) => item.trim());
};

const getPdfHandSortValue = (description) => {
  const text = String(description || '').toUpperCase();

  if (/\b(?:LH|LEFT\s+HAND|HANDING\s+L|HAND\s*:\s*L)\b/.test(text)) return 0;
  if (/\b(?:RH|RIGHT\s+HAND|HANDING\s+R|HAND\s*:\s*R)\b/.test(text)) return 1;

  return 2;
};

const reorderGroupedPdfLine = (line) => {
  if (line.match_type !== 'MANY_PDF_TO_ONE_QB' || !String(line.pdf_description || '').includes(' / ')) {
    return line;
  }

  const descriptions = splitGroupedValues(line.pdf_description, ' / ');

  if (descriptions.length < 2) {
    return line;
  }

  const groupedItems = descriptions.map((description, index) => ({
    description,
    line: splitGroupedValues(line.pdf_line)[index],
    itemId: splitGroupedValues(line.pdf_item_id)[index],
    qty: splitGroupedValues(line.pdf_qty)[index],
    unitPrice: splitGroupedValues(line.pdf_unit_price)[index],
  }));

  groupedItems.sort((a, b) => getPdfHandSortValue(a.description) - getPdfHandSortValue(b.description));

  return {
    ...line,
    pdf_line: joinValues(groupedItems.map((item) => item.line)),
    pdf_item_id: joinValues(groupedItems.map((item) => item.itemId)),
    pdf_description: joinValues(groupedItems.map((item) => item.description), ' / '),
    pdf_qty: joinValues(groupedItems.map((item) => item.qty)),
    pdf_unit_price: joinValues(groupedItems.map((item) => item.unitPrice)),
  };
};

const normalizeLineRef = (value) => {
  const text = String(value ?? '').trim().toUpperCase();

  if (/^\d+$/.test(text)) {
    return String(Number(text));
  }

  return text;
};

const splitLineRefs = (value) => {
  if (value === null || value === undefined || value === '') {
    return [];
  }

  return String(value)
    .split(',')
    .map((line) => normalizeLineRef(line))
    .filter(Boolean);
};

const getSuggestedPdfLineRef = (line) => {
  if (line && typeof line === 'object') {
    return line.pdf_line ?? line.pdf_line_num ?? line.line ?? null;
  }

  return line;
};

const getSuggestedQbLineRef = (line) => {
  if (line && typeof line === 'object') {
    return line.qb_line ?? line.qb_line_num ?? line.line ?? null;
  }

  return line;
};

const uniqueByLineRef = (lines, lineKey) => {
  const seen = new Set();

  return lines.filter((line) => {
    const refs = splitLineRefs(line?.[lineKey]);
    const key = refs.length > 0 ? refs.join('|') : normalizeLineRef(line?.[lineKey]);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const hasSameLineRefs = (sourceRefs, matchedRefs) => (
  sourceRefs.length > 0 && sourceRefs.every((lineRef) => matchedRefs.includes(normalizeLineRef(lineRef)))
);

const parseComparableNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'string' && value.includes(',')) {
    return null;
  }

  const amount = Number(String(value).replace(/[^0-9.-]/g, ''));

  return Number.isFinite(amount) ? amount : null;
};

const numbersMatch = (left, right, tolerance = 0.0001) => {
  const leftNumber = parseComparableNumber(left);
  const rightNumber = parseComparableNumber(right);

  return leftNumber !== null && rightNumber !== null && Math.abs(leftNumber - rightNumber) <= tolerance;
};

const numbersDiffer = (left, right, tolerance = 0.01) => {
  const leftNumber = parseComparableNumber(left);
  const rightNumber = parseComparableNumber(right);

  return leftNumber !== null && rightNumber !== null && Math.abs(leftNumber - rightNumber) > tolerance;
};

const getSuggestedPdfRefs = (line) => {
  const sourceRefs = (line.sourcePdfLineNumbers || []).map(normalizeLineRef).filter(Boolean);

  return sourceRefs.length > 0 ? sourceRefs : splitLineRefs(line.pdfLineNumber);
};

const getSuggestedQbRefs = (line) => {
  const sourceRefs = (line.sourceQbLineNumbers || []).map(normalizeLineRef).filter(Boolean);

  return sourceRefs.length > 0 ? sourceRefs : splitLineRefs(line.poLineNumber);
};

const suggestedReasonConfirmsDescriptionMatch = (reason) => (
  /\b(?:match(?:es|ed)?|coincid(?:e|en|encia|encias))\b/i.test(reason) &&
  /\b(?:physical|product(?:\s+details)?|description|descripcion|descripci[oó]n|details|specifications?|especificaci(?:o|ó)n(?:es)?|size|hand(?:ing)?|mano|cantidad|qty|casing|profile)\b/i.test(reason)
);

const suggestedReasonConfirmsPriceDifference = (reason) => (
  /\b(?:unit\s+price|price|rate|cost|precio|tarifa)\b/i.test(reason) &&
  /\b(?:diff(?:erence|erent)?|differ|mismatch|review|diferencia|difiere|difieren|distinto|distinta)\b/i.test(reason)
);

const hasPriceOnlyAiDifference = (line, aiDifferences = []) => {
  const pdfRefs = getSuggestedPdfRefs(line);
  const qbRefs = getSuggestedQbRefs(line);

  if (pdfRefs.length !== 1 || qbRefs.length !== 1) {
    return false;
  }

  const pairDifferences = aiDifferences.filter((difference) => (
    normalizeLineRef(difference?.pdf_line) === pdfRefs[0] &&
    normalizeLineRef(difference?.qb_line) === qbRefs[0]
  ));

  return (
    pairDifferences.length > 0 &&
    pairDifferences.some((difference) => String(difference?.type || '').toUpperCase() === 'PRICE') &&
    pairDifferences.every((difference) => String(difference?.type || '').toUpperCase() === 'PRICE')
  );
};

const isOneToOnePriceOnlySuggestedLine = (line, aiDifferences = []) => {
  const reason = String(line.sourceMessage || '');
  const reasonLooksPriceOnly = (
    suggestedReasonConfirmsDescriptionMatch(reason) &&
    suggestedReasonConfirmsPriceDifference(reason)
  );

  return (
    line.status === 'suggested' &&
    line.financialsMatch !== true &&
    getSuggestedPdfRefs(line).length === 1 &&
    getSuggestedQbRefs(line).length === 1 &&
    numbersMatch(line.confQty, line.poQty) &&
    (
      numbersDiffer(line.confUnitCost, line.poUnitCost) ||
      numbersDiffer(line.confTotal, line.poTotal)
    ) &&
    (hasPriceOnlyAiDifference(line, aiDifferences) || reasonLooksPriceOnly)
  );
};

const isActionableWarning = (warning) => warning?.type !== 'QB_GROUPED_LINES';

const buildSuggestedRateFix = (line) => {
  const currentQty = parseComparableNumber(line.poQty);
  const currentRate = parseComparableNumber(line.poUnitCost);
  const nextRate = parseComparableNumber(line.confUnitCost);
  const qbLineNumber = getSuggestedQbRefs(line)[0] ?? line.poLineNumber;

  if (!qbLineNumber) {
    return {
      error: 'A selected AI suggestion is missing a QuickBooks line number.',
      line,
    };
  }

  if (!Number.isFinite(currentQty) || currentQty <= 0) {
    return {
      error: `QB line ${qbLineNumber} is missing a valid quantity.`,
      line,
    };
  }

  if (!Number.isFinite(currentRate) || currentRate < 0) {
    return {
      error: `QB line ${qbLineNumber} is missing a valid current rate.`,
      line,
    };
  }

  if (!Number.isFinite(nextRate) || nextRate < 0) {
    return {
      error: `QB line ${qbLineNumber} is missing a valid suggested rate.`,
      line,
    };
  }

  return {
    currentQty,
    currentRate,
    line,
    nextQty: currentQty,
    nextRate,
    qbDescription: line.poDescription,
    qbLineNumber,
  };
};

const isSuggestedAlreadyMatched = (suggestedLine, matchedDetailLines) => {
  const suggestedPdfRefs = suggestedLine.sourcePdfLineNumbers.map(normalizeLineRef);
  const suggestedQbRefs = suggestedLine.sourceQbLineNumbers.map(normalizeLineRef);

  return matchedDetailLines.some((matchedLine) => (
    hasSameLineRefs(suggestedPdfRefs, splitLineRefs(matchedLine.pdfLineNumber)) &&
    hasSameLineRefs(suggestedQbRefs, splitLineRefs(matchedLine.poLineNumber))
  ));
};

const getLookupLine = (lookup, lineNumber) => {
  if (lineNumber === null || lineNumber === undefined) return null;

  return lookup.get(lineNumber) ?? lookup.get(String(lineNumber)) ?? lookup.get(Number(lineNumber)) ?? lookup.get(normalizeLineRef(lineNumber));
};

const setLookupLine = (lookup, lineNumber, line) => {
  if (lineNumber === null || lineNumber === undefined || lineNumber === '') return;

  lookup.set(lineNumber, line);
  lookup.set(String(lineNumber), line);
  lookup.set(normalizeLineRef(lineNumber), line);

  const numericLineNumber = Number(lineNumber);
  if (Number.isFinite(numericLineNumber)) {
    lookup.set(numericLineNumber, line);
  }
};

const normalizeSuggestedPdfLine = (line, lineLookup) => {
  const isObjectLine = line && typeof line === 'object';
  const sourceLine = isObjectLine ? line : {};
  const lineNumber = isObjectLine ? sourceLine.pdf_line ?? sourceLine.pdf_line_num ?? sourceLine.line : line;
  const lookupLine = getLookupLine(lineLookup.pdf, lineNumber);

  if (isObjectLine || lookupLine) {
    return {
      ...lookupLine,
      pdf_line: lookupLine?.pdf_line ?? lookupLine?.pdf_line_num ?? lookupLine?.line ?? lineNumber ?? null,
      pdf_item_id: lookupLine?.pdf_item_id ?? lookupLine?.item_id ?? sourceLine.item_id ?? null,
      pdf_description: lookupLine?.pdf_description ?? lookupLine?.description ?? sourceLine.pdf_description ?? sourceLine.description ?? null,
      pdf_qty: lookupLine?.pdf_qty ?? lookupLine?.qty ?? lookupLine?.ordered ?? sourceLine.pdf_qty ?? sourceLine.qty_used ?? sourceLine.qty ?? null,
      pdf_unit_price: lookupLine?.pdf_unit_price ?? lookupLine?.unit_price ?? sourceLine.pdf_unit_price ?? sourceLine.unit_price ?? null,
      pdf_extd_price: lookupLine?.pdf_extd_price ?? lookupLine?.extd_price ?? sourceLine.pdf_extd_price ?? sourceLine.extd_price ?? null,
    };
  }

  return null;
};

const normalizeSuggestedQbLine = (line, lineLookup) => {
  const isObjectLine = line && typeof line === 'object';
  const sourceLine = isObjectLine ? line : {};
  const lineNumber = isObjectLine ? sourceLine.qb_line ?? sourceLine.qb_line_num ?? sourceLine.line : line;
  const lookupLine = getLookupLine(lineLookup.qb, lineNumber);

  if (isObjectLine || lookupLine) {
    return {
      ...lookupLine,
      qb_line: lookupLine?.qb_line ?? lookupLine?.qb_line_num ?? lookupLine?.line ?? lineNumber ?? null,
      qb_description: lookupLine?.qb_description ?? lookupLine?.description ?? sourceLine.qb_description ?? sourceLine.description ?? null,
      qb_qty: lookupLine?.qb_qty ?? lookupLine?.qty ?? sourceLine.qb_qty ?? sourceLine.qty_used ?? sourceLine.qty ?? null,
      qb_rate: lookupLine?.qb_rate ?? lookupLine?.rate ?? sourceLine.qb_rate ?? sourceLine.unit_price ?? sourceLine.rate ?? null,
      qb_amount: lookupLine?.qb_amount ?? lookupLine?.amount ?? sourceLine.qb_amount ?? sourceLine.amount ?? null,
    };
  }

  return null;
};

const normalizeDetailLine = (sourceLine, index, po) => {
  const line = reorderGroupedPdfLine(sourceLine);

  return {
    id: `${line.qb_line ?? 'pdf'}-${line.pdf_line ?? 'qb'}-${index}`,
    status: mapLineStatus(line),
    aiMatch: line.match_score ?? null,
    matchSimilarity: line.match_similarity ?? null,
    issueType: formatIssueType(line),
    itemId: line.pdf_item_id ?? line.item_id ?? null,
    pdfLineNumber: line.pdf_line ?? null,
    poLineNumber: line.qb_line ?? null,
    poQty: line.qb_qty ?? null,
    confQty: line.pdf_qty ?? null,
    poDescription: line.qb_description,
    vendorDescription: {
      itemId: line.pdf_item_id ?? null,
      description: line.pdf_description ?? null,
    },
    poUnitCost: line.qb_rate ?? null,
    confUnitCost: line.pdf_unit_price ?? null,
    poTotal: line.qb_amount ?? null,
    confTotal: line.pdf_extd_price ?? null,
    variance: getVariance(line.pdf_extd_price, line.qb_amount),
    reqDate: po.requiredDate,
    vendorShipDate: po.vendorShipDate,
    sourceMessage: line.message,
  };
};

const buildSuggestedLine = (match, index, po, lineLookup) => {
  const pdfSources = Array.isArray(match.pdf_allocations) && match.pdf_allocations.length > 0
    ? match.pdf_allocations
    : (match.pdf_lines || []);
  const qbSources = Array.isArray(match.qb_allocations) && match.qb_allocations.length > 0
    ? match.qb_allocations
    : (match.qb_lines || []);
  const sourcePdfLineNumbers = pdfSources
    .map(getSuggestedPdfLineRef)
    .filter((lineNumber) => lineNumber !== null && lineNumber !== undefined);
  const sourceQbLineNumbers = qbSources
    .map(getSuggestedQbLineRef)
    .filter((lineNumber) => lineNumber !== null && lineNumber !== undefined);
  const pdfLines = uniqueByLineRef(
    pdfSources
      .map((line) => normalizeSuggestedPdfLine(line, lineLookup))
      .filter(Boolean),
    'pdf_line'
  );
  const qbLines = uniqueByLineRef(
    qbSources
      .map((line) => normalizeSuggestedQbLine(line, lineLookup))
      .filter(Boolean),
    'qb_line'
  );
  const pdfLineNumbers = pdfLines.map((line) => line.pdf_line).filter((lineNumber) => lineNumber !== null && lineNumber !== undefined);
  const qbLineNumbers = qbLines.map((line) => line.qb_line).filter((lineNumber) => lineNumber !== null && lineNumber !== undefined);
  const pdfTotal = sumNumbers(pdfLines.map((line) => line.pdf_extd_price));
  const qbTotal = sumNumbers(qbLines.map((line) => line.qb_amount));
  const isAutoMatched = match.financials_match && !match.needs_human_review;

  return {
    id: `suggested-${index}-${pdfLineNumbers.join('-')}-${qbLineNumbers.join('-')}`,
    status: isAutoMatched ? 'matched' : 'suggested',
    aiMatch: match.financials_match ? 100 : null,
    issueType: isAutoMatched ? null : 'AI Suggested Match - Review',
    itemId: joinValues(pdfLines.map((line) => line.pdf_item_id ?? line.item_id)),
    pdfLineNumber: joinValues(pdfLineNumbers),
    poLineNumber: joinValues(qbLineNumbers),
    poQty: joinValues(qbLines.map((line) => line.qb_qty)),
    confQty: joinValues(pdfLines.map((line) => line.pdf_qty)),
    poDescription: joinValues(qbLines.map((line) => line.qb_description)),
    vendorDescription: {
      itemId: joinValues(pdfLines.map((line) => line.pdf_item_id ?? line.item_id)),
      description: joinValues(pdfLines.map((line) => line.pdf_description)),
    },
    poUnitCost: qbLines.length === 1 ? qbLines[0].qb_rate : null,
    confUnitCost: pdfLines.length === 1 ? pdfLines[0].pdf_unit_price : null,
    poTotal: qbTotal,
    confTotal: pdfTotal,
    variance: getVariance(pdfTotal, qbTotal),
    reqDate: po.requiredDate,
    vendorShipDate: po.vendorShipDate,
    sourceMessage: match.reason,
    matchType: match.match_type,
    financialsMatch: match.financials_match,
    needsHumanReview: match.needs_human_review,
    sourcePdfLineNumbers,
    sourceQbLineNumbers,
  };
};

const buildSectionLine = (id, label, description) => ({
  id,
  isSection: true,
  label,
  description,
});

const buildDetailFromOrder = (order, poId) => {
  const reconciliation = order?.reconciliation;

  if (!reconciliation) {
    return {
      po: { ...MOCK_PO, poNumber: poId },
      lines: MOCK_LINES,
      totalResults: MOCK_LINES.length,
    };
  }

  const actionableWarnings = (reconciliation.warnings || []).filter(isActionableWarning);
  const po = {
    poNumber: order.poNumber || reconciliation.po_number || poId,
    vendor: order.vendor || reconciliation.supplier || reconciliation.vendor_name || '',
    job: order.job || reconciliation.job || '',
    phase: order.phaseLots || reconciliation.phaseLots || '',
    requiredDate: formatDisplayDate(order.requiredDate || reconciliation.required_date),
    vendorShipDate: formatDisplayDate(order.vendorShipDate || reconciliation.ship_date) || 'PENDING',
    total: order.total || formatCurrency(reconciliation.totalPdf ?? reconciliation.totalQb),
    totalPdf: formatCurrency(reconciliation.totalPdf),
    totalQb: formatCurrency(reconciliation.totalQb),
    status: order.workflowStatus || order.status || formatStatus(reconciliation.workflow_status),
    confirmation: order.workflowStatus || order.confirmation || formatStatus(reconciliation.workflow_status),
    matchStatus: order.matchStatus || formatStatus(reconciliation.match_status || reconciliation.final_status || reconciliation.status),
    aiStatus: order.aiStatus || formatStatus(reconciliation.ai_final_status),
    aiConfidence: reconciliation.ai_confidence,
    aiSummary: reconciliation.ai_summary,
    aiDecisionReason: reconciliation.ai_decision_reason,
    aiSuggestedMatches: reconciliation.ai_suggested_matches || [],
    aiDifferences: reconciliation.ai_differences || [],
    warnings: actionableWarnings,
    warningsCount: actionableWarnings.length,
    suggestedMatchesCount: reconciliation.ai_suggested_matches?.length ?? 0,
    matchedCount: reconciliation.summary?.matched_lines_count ?? reconciliation.matched_lines?.length ?? 0,
    discrepanciesCount: reconciliation.summary?.discrepancies_count ?? reconciliation.discrepancias?.length ?? 0,
    pdfLinesCount: reconciliation.summary?.pdf_lines_count,
    qbLinesCount: reconciliation.summary?.qb_lines_count_after_filter ?? reconciliation.summary?.qb_lines_count_original,
  };

  const matchedLines = reconciliation.matched_lines || [];
  const discrepancyLines = reconciliation.discrepancias || [];
  const pdfSourceLines = Array.isArray(reconciliation.pdfData?.line_items) ? reconciliation.pdfData.line_items : [];
  const qbSourceLines = Array.isArray(reconciliation.qbData?.qb_line_items) ? reconciliation.qbData.qb_line_items : [];
  const lineLookup = { pdf: new Map(), qb: new Map() };

  pdfSourceLines.forEach((line) => {
    setLookupLine(lineLookup.pdf, line.pdf_line ?? line.pdf_line_num ?? line.line, line);
  });
  qbSourceLines.forEach((line) => {
    setLookupLine(lineLookup.qb, line.qb_line ?? line.qb_line_num ?? line.line, line);
  });
  [...matchedLines, ...discrepancyLines].forEach((line) => {
    setLookupLine(lineLookup.pdf, line.pdf_line, line);
    setLookupLine(lineLookup.qb, line.qb_line, line);
  });
  const suggestedLines = po.aiSuggestedMatches.map((match, index) => (
    buildSuggestedLine(match, index, po, lineLookup)
  ));
  const normalizedMatchedLines = matchedLines.map((line, index) => normalizeDetailLine(line, `matched-${index}`, po));
  const aiMatchedLines = suggestedLines.filter((line) => (
    line.status === 'matched' && !isSuggestedAlreadyMatched(line, normalizedMatchedLines)
  ));
  const reviewSuggestedLines = suggestedLines.filter((line) => line.status !== 'matched');
  const discrepancyCoveredSuggestedLines = [
    ...aiMatchedLines,
    ...reviewSuggestedLines.filter((line) => isOneToOnePriceOnlySuggestedLine(line, po.aiDifferences)),
  ];
  const coveredPdfLineNumbers = new Set(discrepancyCoveredSuggestedLines.flatMap((line) => (
    getSuggestedPdfRefs(line)
  )));
  const coveredQbLineNumbers = new Set(discrepancyCoveredSuggestedLines.flatMap((line) => (
    getSuggestedQbRefs(line)
  )));
  const unresolvedDiscrepancyLines = discrepancyLines.filter((line) => {
    if (line.type === 'LINE_NOT_FOUND_IN_QB' && coveredPdfLineNumbers.has(normalizeLineRef(line.pdf_line))) {
      return false;
    }

    if (line.type === 'LINE_NOT_FOUND_IN_PDF' && coveredQbLineNumbers.has(normalizeLineRef(line.qb_line))) {
      return false;
    }

    return true;
  });

  const pdfOnlyLines = unresolvedDiscrepancyLines.filter((line) => line.type === 'LINE_NOT_FOUND_IN_QB');
  const qbOnlyLines = unresolvedDiscrepancyLines.filter((line) => line.type === 'LINE_NOT_FOUND_IN_PDF');
  const otherDiscrepancies = unresolvedDiscrepancyLines.filter((line) => (
    line.type !== 'LINE_NOT_FOUND_IN_QB' &&
    line.type !== 'LINE_NOT_FOUND_IN_PDF'
  ));
  const displayMatchedLines = [...aiMatchedLines, ...normalizedMatchedLines];

  const lines = [
    ...(reviewSuggestedLines.length > 0
      ? [
          buildSectionLine(
            'section-suggested',
            'AI Suggested Matches',
            'Suggested pairings to use as a guide before reviewing missing lines.'
          ),
        ]
      : []),
    ...reviewSuggestedLines,
    ...(pdfOnlyLines.length > 0
      ? [
          buildSectionLine(
            'section-pdf-only',
            'Found in PDF, Missing in QuickBooks',
            'Vendor PDF lines that were not found as matching QuickBooks PO lines.'
          ),
        ]
      : []),
    ...pdfOnlyLines.map((line, index) => normalizeDetailLine(line, `pdf-only-${index}`, po)),
    ...(qbOnlyLines.length > 0
      ? [
          buildSectionLine(
            'section-qb-only',
            'Found in QuickBooks, Missing in PDF',
            'QuickBooks PO lines that were not found in the vendor PDF.'
          ),
        ]
      : []),
    ...qbOnlyLines.map((line, index) => normalizeDetailLine(line, `qb-only-${index}`, po)),
    ...(otherDiscrepancies.length > 0
      ? [
          buildSectionLine(
            'section-other-discrepancies',
            'Other Discrepancies',
            'Quantity, price, total, description, or other review items.'
          ),
        ]
      : []),
    ...otherDiscrepancies.map((line, index) => normalizeDetailLine(line, `discrepancy-${index}`, po)),
    ...(displayMatchedLines.length > 0
      ? [
          buildSectionLine(
            'section-matched',
            'Matched Lines',
            'Lines that matched between the vendor PDF and QuickBooks.'
          ),
        ]
      : []),
    ...displayMatchedLines,
  ];

  const totalResults = lines.filter((line) => !line.isSection).length;

  return {
    po: {
      ...po,
      discrepanciesCount: unresolvedDiscrepancyLines.length,
      matchedCount: displayMatchedLines.length,
    },
    lines,
    totalResults,
  };
};

export default function PODetailPage() {
  const { addToast } = useToast();
  const { poId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [order, setOrder] = useState(location.state?.order || null);
  const [noteDraft, setNoteDraft] = useState(location.state?.order?.note || '');
  const [noteSaveState, setNoteSaveState] = useState({
    error: '',
    isSaving: false,
    phase: 'idle',
  });
  const [isLoading, setIsLoading] = useState(!location.state?.order);
  const [loadError, setLoadError] = useState('');
  const [statusUpdateError, setStatusUpdateError] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [editingQbLine, setEditingQbLine] = useState(null);
  const [qbLineDraft, setQbLineDraft] = useState({ qty: '', rate: '' });
  const [qbLineUpdateState, setQbLineUpdateState] = useState({
    error: '',
    isSaving: false,
    phase: 'idle',
  });
  const [selectedRateFixLineIds, setSelectedRateFixLineIds] = useState([]);
  const [bulkRateUpdateState, setBulkRateUpdateState] = useState({
    completed: 0,
    currentLine: null,
    error: '',
    isSaving: false,
    phase: 'idle',
    total: 0,
  });
  const [pdfViewer, setPdfViewer] = useState({
    error: '',
    fileName: '',
    isLoading: false,
    isOpen: false,
    url: '',
  });
  const persistedNote = order?.note || '';

  const refreshPurchaseOrderDetails = useCallback(async () => {
    const previousNote = persistedNote;
    const purchaseOrder = await fetchPurchaseOrderByPoNumber(poId);

    if (!purchaseOrder) {
      throw new Error(`PO ${poId} was not found.`);
    }

    setOrder(purchaseOrder);
    setNoteDraft((currentDraft) => (
      currentDraft === previousNote ? purchaseOrder.note || '' : currentDraft
    ));
    setLoadError('');

    return purchaseOrder;
  }, [persistedNote, poId]);

  const syncEditorWithOrder = useCallback((updatedOrder, sourceLine) => {
    if (!updatedOrder || !sourceLine?.poLineNumber) return;

    const refreshedDetail = buildDetailFromOrder(updatedOrder, poId);
    const refreshedLine = refreshedDetail.lines.find((line) => (
      !line.isSection &&
      String(line.poLineNumber) === String(sourceLine.poLineNumber)
    ));

    if (!refreshedLine) return;

    const suggestedRate = refreshedLine.status === 'suggested' && isSingleNumericValue(refreshedLine.confUnitCost)
      ? refreshedLine.confUnitCost
      : null;

    setEditingQbLine(refreshedLine);
    setQbLineDraft({
      qty: refreshedLine.poQty ?? '',
      rate: suggestedRate ?? refreshedLine.poUnitCost ?? '',
    });
  }, [poId]);

  useEffect(() => {
    let ignore = false;

    const loadOrder = async () => {
      setNoteSaveState({
        error: '',
        isSaving: false,
        phase: 'idle',
      });

      if (location.state?.order) {
        setOrder(location.state.order);
        setNoteDraft(location.state.order.note || '');
      }

      setIsLoading(!location.state?.order);
      setLoadError('');

      try {
        const purchaseOrder = await fetchPurchaseOrderByPoNumber(poId);

        if (!ignore) {
          setOrder(purchaseOrder);
          setNoteDraft(purchaseOrder?.note || '');
          if (!purchaseOrder) {
            setLoadError(`PO ${poId} was not found.`);
          }
        }
      } catch (error) {
        console.error('Error loading purchase order detail:', error);

        if (!ignore) {
          setLoadError(error.message || 'Could not load purchase order detail.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    loadOrder();

    return () => {
      ignore = true;
    };
  }, [location.key, location.state, poId]);

  const { po, lines, totalResults } = buildDetailFromOrder(order, poId);
  const priceOnlyRateFixLines = lines.filter((line) => (
    !line.isSection &&
    isOneToOnePriceOnlySuggestedLine(line, po.aiDifferences || []) &&
    !buildSuggestedRateFix(line).error
  ));
  const priceOnlyRateFixIds = priceOnlyRateFixLines.map((line) => line.id);
  const selectedRateFixLineIdSet = new Set(selectedRateFixLineIds);
  const selectedRateFixLines = priceOnlyRateFixLines.filter((line) => selectedRateFixLineIdSet.has(line.id));

  const handleNoteDraftChange = (nextNote) => {
    setNoteDraft(nextNote);
    setNoteSaveState((current) => ({
      ...current,
      error: '',
      phase: current.isSaving ? current.phase : 'idle',
    }));
  };

  const handleClearNote = () => {
    if (noteSaveState.isSaving) return;

    setNoteDraft('');
    setNoteSaveState({
      error: '',
      isSaving: false,
      phase: 'idle',
    });
  };

  const handleResetNote = () => {
    if (noteSaveState.isSaving) return;

    setNoteDraft(persistedNote);
    setNoteSaveState({
      error: '',
      isSaving: false,
      phase: 'idle',
    });
  };

  const handleSaveNote = async () => {
    if (noteSaveState.isSaving || noteDraft === persistedNote) return;

    setNoteSaveState({
      error: '',
      isSaving: true,
      phase: 'saving',
    });

    try {
      const updatedOrder = await updatePurchaseOrderNote(poId, noteDraft);
      const updatedNote = updatedOrder.note || '';

      setOrder(updatedOrder);
      setNoteDraft(updatedNote);
      setNoteSaveState({
        error: '',
        isSaving: false,
        phase: 'saved',
      });
      addToast({
        tone: 'success',
        title: updatedNote ? 'Note saved' : 'Note cleared',
        message: `PO ${poId} note was updated.`,
      });
    } catch (error) {
      console.error('Error saving purchase order note:', error);

      setNoteSaveState({
        error: error.message || 'Could not save the note.',
        isSaving: false,
        phase: 'idle',
      });
      addToast({
        tone: 'error',
        title: 'Note not saved',
        message: error.message || 'Could not save the purchase order note.',
      });
    }
  };

  const handleWorkflowStatusChange = async (nextStatus) => {
    setIsUpdatingStatus(true);
    setStatusUpdateError('');

    try {
      const updatedOrder = await updatePurchaseOrderWorkflowStatus(poId, nextStatus);

      if (updatedOrder) {
        const updatedNote = updatedOrder.note || '';

        setOrder(updatedOrder);
        setNoteDraft((currentDraft) => (
          currentDraft === persistedNote ? updatedNote : currentDraft
        ));
      }
    } catch (error) {
      console.error('Error updating workflow status:', error);
      setStatusUpdateError(error.message || 'Could not update workflow status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleViewPdf = async () => {
    setPdfViewer({
      error: '',
      fileName: '',
      isLoading: true,
      isOpen: true,
      url: '',
    });

    try {
      const pdf = await fetchCurrentPurchaseOrderPdf(poId);

      setPdfViewer({
        error: '',
        fileName: pdf.original_filename || `PO ${poId} PDF`,
        isLoading: false,
        isOpen: true,
        url: pdf.signedUrl,
      });
    } catch (error) {
      console.error('Error loading purchase order PDF:', error);
      setPdfViewer({
        error: error.message || 'Could not load the PDF.',
        fileName: '',
        isLoading: false,
        isOpen: true,
        url: '',
      });
    }
  };

  const handleClosePdf = () => {
    setPdfViewer((current) => ({
      ...current,
      isOpen: false,
    }));
  };

  const handleEditQbLine = (line) => {
    const suggestedRate = line.status === 'suggested' && isSingleNumericValue(line.confUnitCost)
      ? line.confUnitCost
      : null;

    setEditingQbLine(line);
    setQbLineDraft({
      qty: line.poQty ?? '',
      rate: suggestedRate ?? line.poUnitCost ?? '',
    });
    setQbLineUpdateState({
      error: '',
      isSaving: false,
      phase: 'idle',
    });
  };

  const handleCloseQbLineEditor = () => {
    if (qbLineUpdateState.isSaving) return;

    setEditingQbLine(null);
    setQbLineUpdateState({
      error: '',
      isSaving: false,
      phase: 'idle',
    });
  };

  const handleQbLineDraftChange = (field, value) => {
    setQbLineDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleToggleRateFixLine = (lineId) => {
    if (bulkRateUpdateState.isSaving) return;

    setBulkRateUpdateState((current) => ({
      ...current,
      error: '',
    }));
    setSelectedRateFixLineIds((current) => (
      current.includes(lineId)
        ? current.filter((currentLineId) => currentLineId !== lineId)
        : [...current, lineId]
    ));
  };

  const handleToggleAllRateFixLines = () => {
    if (bulkRateUpdateState.isSaving) return;

    setBulkRateUpdateState((current) => ({
      ...current,
      error: '',
    }));
    setSelectedRateFixLineIds((current) => {
      const applicableIds = new Set(priceOnlyRateFixIds);
      const currentApplicableIds = current.filter((lineId) => applicableIds.has(lineId));

      return currentApplicableIds.length === priceOnlyRateFixIds.length ? [] : priceOnlyRateFixIds;
    });
  };

  const handleClearRateFixSelection = () => {
    if (bulkRateUpdateState.isSaving) return;

    setBulkRateUpdateState((current) => ({
      ...current,
      error: '',
    }));
    setSelectedRateFixLineIds([]);
  };

  const handleApplySelectedRateFixes = async () => {
    if (bulkRateUpdateState.isSaving) return;

    const fixes = selectedRateFixLines.map(buildSuggestedRateFix);
    const invalidFix = fixes.find((fix) => fix.error);

    if (fixes.length === 0) {
      const validationMessage = 'Select at least one suggested rate before applying.';
      setBulkRateUpdateState({
        completed: 0,
        currentLine: null,
        error: validationMessage,
        isSaving: false,
        phase: 'idle',
        total: 0,
      });
      addToast({
        tone: 'error',
        title: 'No rates selected',
        message: validationMessage,
      });
      return;
    }

    if (invalidFix) {
      setBulkRateUpdateState({
        completed: 0,
        currentLine: null,
        error: invalidFix.error,
        isSaving: false,
        phase: 'idle',
        total: fixes.length,
      });
      addToast({
        tone: 'error',
        title: 'Invalid suggested rate',
        message: invalidFix.error,
      });
      return;
    }

    setBulkRateUpdateState({
      completed: 0,
      currentLine: fixes[0]?.qbLineNumber ?? null,
      error: '',
      isSaving: true,
      phase: 'saving-qb',
      total: fixes.length,
    });

    let failureStage = 'quickbooks';
    let completed = 0;

    try {
      for (const fix of fixes) {
        setBulkRateUpdateState({
          completed,
          currentLine: fix.qbLineNumber,
          error: '',
          isSaving: true,
          phase: 'saving-qb',
          total: fixes.length,
        });

        await updateQuickBooksPurchaseOrderLine({
          poNumber: poId,
          qbLineNumber: fix.qbLineNumber,
          currentQty: fix.currentQty,
          currentRate: fix.currentRate,
          nextQty: fix.nextQty,
          nextRate: fix.nextRate,
          qbDescription: fix.qbDescription,
        });

        completed += 1;
        setBulkRateUpdateState({
          completed,
          currentLine: fix.qbLineNumber,
          error: '',
          isSaving: true,
          phase: 'saving-qb',
          total: fixes.length,
        });
      }

      addToast({
        tone: 'success',
        title: 'QuickBooks updated',
        message: `${fixes.length} suggested rate${fixes.length === 1 ? '' : 's'} applied to PO ${poId}.`,
      });

      setBulkRateUpdateState({
        completed,
        currentLine: null,
        error: '',
        isSaving: true,
        phase: 'reconciling',
        total: fixes.length,
      });

      failureStage = 'comparison';

      let reconciliationResult;
      try {
        reconciliationResult = await reconcilePurchaseOrderWithCurrentPdf(poId);
      } catch (error) {
        throw new Error(
          `QuickBooks was updated, but reconciliation failed: ${error.message || 'Could not rerun the comparison.'}`,
          { cause: error }
        );
      }

      addToast({
        tone: 'success',
        title: 'Comparison completed',
        message: `PO ${poId} was compared again using its current PDF.`,
      });
      getPersistenceNotifications(reconciliationResult).forEach(addToast);

      setBulkRateUpdateState({
        completed,
        currentLine: null,
        error: '',
        isSaving: true,
        phase: 'refreshing',
        total: fixes.length,
      });

      failureStage = 'refresh';

      await refreshPurchaseOrderDetails();

      setSelectedRateFixLineIds([]);
      setBulkRateUpdateState({
        completed,
        currentLine: null,
        error: '',
        isSaving: true,
        phase: 'success',
        total: fixes.length,
      });

      await new Promise((resolve) => {
        setTimeout(resolve, 900);
      });

      setBulkRateUpdateState({
        completed: 0,
        currentLine: null,
        error: '',
        isSaving: false,
        phase: 'idle',
        total: 0,
      });
    } catch (error) {
      console.error('Error applying suggested QuickBooks rates:', error);

      const failureTitle = {
        quickbooks: 'QuickBooks update failed',
        comparison: 'Comparison failed',
        refresh: 'Data refresh failed',
      }[failureStage];
      const baseMessage = error.message || 'The operation could not be completed.';
      const errorMessage = completed > 0 && failureStage === 'quickbooks'
        ? `${completed} of ${fixes.length} QuickBooks lines were updated before this stopped. ${baseMessage}`
        : baseMessage;

      addToast({
        tone: 'error',
        title: failureTitle,
        message: errorMessage,
      });

      if (completed > 0 || isStaleQuickBooksError(error)) {
        try {
          await refreshPurchaseOrderDetails();
        } catch (refreshError) {
          console.error('Error refreshing purchase order after bulk rate update:', refreshError);
        }
      }

      setBulkRateUpdateState({
        completed,
        currentLine: null,
        error: isStaleQuickBooksError(error)
          ? `${baseMessage} The latest PO data was refreshed. Review the selected rates and apply again.`
          : errorMessage,
        isSaving: false,
        phase: 'idle',
        total: fixes.length,
      });
    }
  };

  const handleSaveQbLine = async () => {
    if (!editingQbLine) return;

    const nextQty = Number(qbLineDraft.qty);
    const nextRate = Number(qbLineDraft.rate);

    if (!Number.isFinite(nextQty) || nextQty <= 0 || !Number.isFinite(nextRate) || nextRate < 0) {
      const validationMessage = 'Enter a valid quantity and unit rate before saving.';
      setQbLineUpdateState({
        error: validationMessage,
        isSaving: false,
        phase: 'idle',
      });
      addToast({
        tone: 'error',
        title: 'Invalid line values',
        message: validationMessage,
      });
      return;
    }

    setQbLineUpdateState({
      error: '',
      isSaving: true,
      phase: 'saving-qb',
    });

    let failureStage = 'quickbooks';

    try {
      await updateQuickBooksPurchaseOrderLine({
        poNumber: poId,
        qbLineNumber: editingQbLine.poLineNumber,
        currentQty: editingQbLine.poQty,
        currentRate: editingQbLine.poUnitCost,
        nextQty,
        nextRate,
        qbDescription: editingQbLine.poDescription,
      });

      addToast({
        tone: 'success',
        title: 'QuickBooks updated',
        message: `Line ${editingQbLine.poLineNumber} of PO ${poId} was updated successfully.`,
      });

      setQbLineUpdateState({
        error: '',
        isSaving: true,
        phase: 'reconciling',
      });

      failureStage = 'comparison';

      let reconciliationResult;
      try {
        reconciliationResult = await reconcilePurchaseOrderWithCurrentPdf(poId);
      } catch (error) {
        throw new Error(
          `QuickBooks was updated, but reconciliation failed: ${error.message || 'Could not rerun the comparison.'}`,
          { cause: error }
        );
      }

      addToast({
        tone: 'success',
        title: 'Comparison completed',
        message: `PO ${poId} was compared again using its current PDF.`,
      });
      getPersistenceNotifications(reconciliationResult).forEach(addToast);

      setQbLineUpdateState({
        error: '',
        isSaving: true,
        phase: 'refreshing',
      });

      failureStage = 'refresh';

      await refreshPurchaseOrderDetails();

      setQbLineUpdateState({
        error: '',
        isSaving: true,
        phase: 'success',
      });

      await new Promise((resolve) => {
        setTimeout(resolve, 900);
      });

      setEditingQbLine(null);
      setQbLineUpdateState({
        error: '',
        isSaving: false,
        phase: 'idle',
      });
    } catch (error) {
      console.error('Error updating QuickBooks line:', error);

      const failureTitle = {
        quickbooks: 'QuickBooks update failed',
        comparison: 'Comparison failed',
        refresh: 'Data refresh failed',
      }[failureStage];

      addToast({
        tone: 'error',
        title: failureTitle,
        message: error.message || 'The operation could not be completed.',
      });

      if (isStaleQuickBooksError(error)) {
        try {
          const updatedOrder = await refreshPurchaseOrderDetails();
          syncEditorWithOrder(updatedOrder, editingQbLine);
        } catch (refreshError) {
          console.error('Error refreshing stale QuickBooks line:', refreshError);
        }
      }

      setQbLineUpdateState({
        error: isStaleQuickBooksError(error)
          ? `${error.message} The latest PO data was refreshed. Review the line and save again.`
          : error.message || 'Could not update the QuickBooks line.',
        isSaving: false,
        phase: 'idle',
      });
    }
  };

  const qbLineProgress = {
    'saving-qb': {
      title: 'Updating QuickBooks',
      message: 'Saving the quantity and rate changes to the purchase order.',
    },
    reconciling: {
      title: 'QuickBooks updated',
      message: 'Re-running the latest vendor PDF comparison against QuickBooks.',
    },
    refreshing: {
      title: 'Reconciliation complete',
      message: 'Refreshing the purchase order details from the database.',
    },
    success: {
      title: 'Line updated',
      message: 'QuickBooks and the reconciled PDF data are now up to date.',
    },
  }[qbLineUpdateState.phase];

  const qbLineSaveLabel = {
    'saving-qb': 'Updating QuickBooks...',
    reconciling: 'Reconciling PDF...',
    refreshing: 'Refreshing data...',
    success: 'Updated',
  }[qbLineUpdateState.phase] || 'Save in QuickBooks';

  const hasPdfRateSuggestion = editingQbLine?.status === 'suggested' && isSingleNumericValue(editingQbLine.confUnitCost);

  return (
    <div className="order-page">
      <button
        className="btn-back"
        onClick={() => navigate('/order-comparison')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer',
          padding: '0',
          marginBottom: '20px',
        }}
      >
       ← Back to Orders
      </button>

      {loadError && (
        <div className="order-state order-state--error">
          {loadError}
        </div>
      )}

      {statusUpdateError && (
        <div className="order-state order-state--error">
          {statusUpdateError}
        </div>
      )}

      {isLoading ? (
        <div className="order-state">Loading purchase order...</div>
      ) : order ? (
        <>
          <PODetailHeader
            po={po}
            workflowStatusValue={order.workflowStatusRaw || 'PENDING'}
            isUpdatingStatus={isUpdatingStatus}
            onWorkflowStatusChange={handleWorkflowStatusChange}
            onViewPdf={handleViewPdf}
          />
          <PONotesPanel
            isSaving={noteSaveState.isSaving}
            persistedValue={persistedNote}
            saveState={noteSaveState}
            updatedAt={order.noteUpdatedAt}
            value={noteDraft}
            onChange={handleNoteDraftChange}
            onClear={handleClearNote}
            onReset={handleResetNote}
            onSave={handleSaveNote}
          />
          <PODetailTable
            bulkApplicableLineIds={priceOnlyRateFixIds}
            bulkSelectionDisabled={bulkRateUpdateState.isSaving}
            bulkUpdateState={bulkRateUpdateState}
            lines={lines}
            onApplyBulkRateFixes={handleApplySelectedRateFixes}
            onClearBulkSelection={handleClearRateFixSelection}
            onEditQuickBooksLine={handleEditQbLine}
            onToggleAllBulkLines={handleToggleAllRateFixLines}
            onToggleBulkLine={handleToggleRateFixLine}
            selectedBulkLineIds={selectedRateFixLineIds}
            totalResults={totalResults}
          />
        </>
      ) : (
        <div className="order-state">No purchase order data available.</div>
      )}

      {pdfViewer.isOpen && (
        <div className="pdf-modal-overlay" role="dialog" aria-modal="true" aria-label="Purchase order PDF">
          <div className="pdf-modal">
            <div className="pdf-modal-header">
              <div>
                <div className="pdf-modal-eyebrow">Current PDF</div>
                <h3>{pdfViewer.fileName || `PO ${poId}`}</h3>
              </div>
              <div className="pdf-modal-actions">
                {pdfViewer.url && (
                  <a
                    className="pdf-modal-open-link"
                    href={pdfViewer.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in new tab
                  </a>
                )}
                <button className="pdf-modal-close" type="button" onClick={handleClosePdf}>
                  Close
                </button>
              </div>
            </div>

            <div className="pdf-modal-body">
              {pdfViewer.isLoading && (
                <div className="pdf-modal-state">Loading PDF...</div>
              )}
              {pdfViewer.error && (
                <div className="pdf-modal-state pdf-modal-state--error">
                  {pdfViewer.error}
                </div>
              )}
              {pdfViewer.url && (
                <iframe
                  className="pdf-modal-frame"
                  src={pdfViewer.url}
                  title={`PDF for PO ${poId}`}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {editingQbLine && (
        <div className="pdt-edit-overlay" role="dialog" aria-modal="true" aria-label="Edit QuickBooks line">
          <div className="pdt-edit-modal">
            <div className="pdt-edit-header">
              <div>
                <div className="pdt-edit-eyebrow">QuickBooks line</div>
                <h3>Update line {editingQbLine.poLineNumber}</h3>
              </div>
              <button
                className="pdt-edit-close"
                type="button"
                onClick={handleCloseQbLineEditor}
                disabled={qbLineUpdateState.isSaving}
              >
                Close
              </button>
            </div>

            <div className="pdt-edit-body">
              {hasPdfRateSuggestion && (
                <div className="pdt-edit-suggestion">
                  <div>
                    <span className="pdt-edit-suggestion-label">Suggested QB rate</span>
                    <strong>{formatCurrency(editingQbLine.confUnitCost)}</strong>
                  </div>
                  <button
                    className="pdt-edit-suggestion-btn"
                    disabled={qbLineUpdateState.isSaving}
                    type="button"
                    onClick={() => handleQbLineDraftChange('rate', editingQbLine.confUnitCost)}
                  >
                    Use PDF unit price
                  </button>
                </div>
              )}

              {editingQbLine.status === 'suggested' ? (
                <div className="pdt-edit-comparison">
                  <section>
                    <div className="pdt-edit-section-title">PDF line</div>
                    <div className="pdt-edit-description">
                      {editingQbLine.vendorDescription?.description || 'No PDF description available.'}
                    </div>
                    <dl className="pdt-edit-facts">
                      <div>
                        <dt>Qty</dt>
                        <dd>{formatPlainNumber(editingQbLine.confQty)}</dd>
                      </div>
                      <div>
                        <dt>Unit price</dt>
                        <dd>{formatCurrency(editingQbLine.confUnitCost) || '-'}</dd>
                      </div>
                    </dl>
                  </section>

                  <section>
                    <div className="pdt-edit-section-title">QuickBooks line</div>
                    <div className="pdt-edit-description">
                      {editingQbLine.poDescription || 'No QuickBooks description available.'}
                    </div>
                    <dl className="pdt-edit-facts">
                      <div>
                        <dt>Qty</dt>
                        <dd>{formatPlainNumber(editingQbLine.poQty)}</dd>
                      </div>
                      <div>
                        <dt>Rate</dt>
                        <dd>{formatCurrency(editingQbLine.poUnitCost) || '-'}</dd>
                      </div>
                    </dl>
                  </section>
                </div>
              ) : (
                <div className="pdt-edit-description">
                  {editingQbLine.poDescription || 'No QuickBooks description available.'}
                </div>
              )}

              <div className="pdt-edit-grid">
                <label>
                  <span>QB Qty</span>
                  <input
                    disabled={qbLineUpdateState.isSaving}
                    min="0.01"
                    step="0.01"
                    type="number"
                    value={qbLineDraft.qty}
                    onChange={(event) => handleQbLineDraftChange('qty', event.target.value)}
                  />
                </label>

                <label>
                  <span>QB Rate</span>
                  <input
                    disabled={qbLineUpdateState.isSaving}
                    min="0"
                    step="0.01"
                    type="number"
                    value={qbLineDraft.rate}
                    onChange={(event) => handleQbLineDraftChange('rate', event.target.value)}
                  />
                </label>
              </div>

              {qbLineUpdateState.error && (
                <div className="pdt-edit-error">{qbLineUpdateState.error}</div>
              )}

              {qbLineProgress && (
                <div className={`pdt-edit-progress pdt-edit-progress--${qbLineUpdateState.phase}`}>
                  <div className="pdt-edit-progress-icon" />
                  <div>
                    <div className="pdt-edit-progress-title">{qbLineProgress.title}</div>
                    <div className="pdt-edit-progress-message">{qbLineProgress.message}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="pdt-edit-actions">
              <button
                className="pdt-edit-secondary"
                type="button"
                onClick={handleCloseQbLineEditor}
                disabled={qbLineUpdateState.isSaving}
              >
                Cancel
              </button>
              <button
                className="pdt-edit-primary"
                type="button"
                onClick={handleSaveQbLine}
                disabled={qbLineUpdateState.isSaving}
              >
                {qbLineSaveLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
