import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import PODetailHeader from '../components/po-detail/PODetailHeader.jsx';
import PODetailTable from '../components/po-detail/PODetailTable.jsx';
import {
  fetchCurrentPurchaseOrderPdf,
  fetchPurchaseOrderByPoNumber,
  formatDisplayDate,
  formatWorkflowStatus,
  reconcilePurchaseOrderWithCurrentPdf,
  updateQuickBooksPurchaseOrderLine,
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

const hasSameLineRefs = (sourceRefs, matchedRefs) => (
  sourceRefs.length > 0 && sourceRefs.every((lineRef) => matchedRefs.includes(normalizeLineRef(lineRef)))
);

const isActionableWarning = (warning) => warning?.type !== 'QB_GROUPED_LINES';

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

  return lookup.get(lineNumber) ?? lookup.get(String(lineNumber)) ?? lookup.get(Number(lineNumber));
};

const normalizeSuggestedPdfLine = (line, lineLookup) => {
  if (line && typeof line === 'object') {
    const lookupLine = getLookupLine(lineLookup.pdf, line.line);

    return {
      ...lookupLine,
      pdf_line: lookupLine?.pdf_line ?? line.line ?? null,
      pdf_item_id: lookupLine?.pdf_item_id ?? line.item_id ?? null,
      pdf_description: lookupLine?.pdf_description ?? line.description ?? null,
      pdf_qty: lookupLine?.pdf_qty ?? line.qty ?? null,
      pdf_unit_price: lookupLine?.pdf_unit_price ?? line.unit_price ?? null,
      pdf_extd_price: lookupLine?.pdf_extd_price ?? line.extd_price ?? null,
    };
  }

  return getLookupLine(lineLookup.pdf, line);
};

const normalizeSuggestedQbLine = (line, lineLookup) => {
  if (line && typeof line === 'object') {
    const lookupLine = getLookupLine(lineLookup.qb, line.qb_line_num ?? line.line);

    return {
      ...lookupLine,
      qb_line: lookupLine?.qb_line ?? line.qb_line_num ?? line.line ?? null,
      qb_description: lookupLine?.qb_description ?? line.qb_description ?? line.description ?? null,
      qb_qty: lookupLine?.qb_qty ?? line.qb_qty ?? line.qty ?? null,
      qb_rate: lookupLine?.qb_rate ?? line.qb_rate ?? line.rate ?? null,
      qb_amount: lookupLine?.qb_amount ?? line.qb_amount ?? line.amount ?? null,
    };
  }

  return getLookupLine(lineLookup.qb, line);
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
  const pdfLines = (match.pdf_lines || [])
    .map((line) => normalizeSuggestedPdfLine(line, lineLookup))
    .filter(Boolean);
  const qbLines = (match.qb_lines || [])
    .map((line) => normalizeSuggestedQbLine(line, lineLookup))
    .filter(Boolean);
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
    sourcePdfLineNumbers: pdfLineNumbers,
    sourceQbLineNumbers: qbLineNumbers,
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
  const lineLookup = [...matchedLines, ...discrepancyLines].reduce((lookup, line) => {
    if (line.pdf_line != null) lookup.pdf.set(line.pdf_line, line);
    if (line.qb_line != null) lookup.qb.set(line.qb_line, line);

    return lookup;
  }, { pdf: new Map(), qb: new Map() });
  const suggestedLines = po.aiSuggestedMatches.map((match, index) => (
    buildSuggestedLine(match, index, po, lineLookup)
  ));
  const normalizedMatchedLines = matchedLines.map((line, index) => normalizeDetailLine(line, `matched-${index}`, po));
  const aiMatchedLines = suggestedLines.filter((line) => (
    line.status === 'matched' && !isSuggestedAlreadyMatched(line, normalizedMatchedLines)
  ));
  const reviewSuggestedLines = suggestedLines.filter((line) => line.status !== 'matched');
  const aiMatchedPdfLineNumbers = new Set(aiMatchedLines.flatMap((line) => (
    line.sourcePdfLineNumbers.map(String)
  )));
  const aiMatchedQbLineNumbers = new Set(aiMatchedLines.flatMap((line) => (
    line.sourceQbLineNumbers.map(String)
  )));
  const unresolvedDiscrepancyLines = discrepancyLines.filter((line) => {
    if (line.type === 'LINE_NOT_FOUND_IN_QB' && aiMatchedPdfLineNumbers.has(String(line.pdf_line))) {
      return false;
    }

    if (line.type === 'LINE_NOT_FOUND_IN_PDF' && aiMatchedQbLineNumbers.has(String(line.qb_line))) {
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
    po,
    lines,
    totalResults,
  };
};

export default function PODetailPage() {
  const { poId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [order, setOrder] = useState(location.state?.order || null);
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
  const [pdfViewer, setPdfViewer] = useState({
    error: '',
    fileName: '',
    isLoading: false,
    isOpen: false,
    url: '',
  });

  useEffect(() => {
    let ignore = false;

    if (location.state?.order) {
      return () => {
        ignore = true;
      };
    }

    const loadOrder = async () => {
      setIsLoading(true);
      setLoadError('');

      try {
        const purchaseOrder = await fetchPurchaseOrderByPoNumber(poId);

        if (!ignore) {
          setOrder(purchaseOrder);
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
  }, [location.state, poId]);

  const { po, lines, totalResults } = buildDetailFromOrder(order, poId);

  const handleWorkflowStatusChange = async (nextStatus) => {
    setIsUpdatingStatus(true);
    setStatusUpdateError('');

    try {
      const updatedOrder = await updatePurchaseOrderWorkflowStatus(poId, nextStatus);

      if (updatedOrder) {
        setOrder(updatedOrder);
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
    setEditingQbLine(line);
    setQbLineDraft({
      qty: line.poQty ?? '',
      rate: line.poUnitCost ?? '',
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

  const handleSaveQbLine = async () => {
    if (!editingQbLine) return;

    const nextQty = Number(qbLineDraft.qty);
    const nextRate = Number(qbLineDraft.rate);

    if (!Number.isFinite(nextQty) || nextQty <= 0 || !Number.isFinite(nextRate) || nextRate < 0) {
      setQbLineUpdateState({
        error: 'Enter a valid quantity and unit rate before saving.',
        isSaving: false,
        phase: 'idle',
      });
      return;
    }

    setQbLineUpdateState({
      error: '',
      isSaving: true,
      phase: 'saving-qb',
    });

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

      setQbLineUpdateState({
        error: '',
        isSaving: true,
        phase: 'reconciling',
      });

      try {
        await reconcilePurchaseOrderWithCurrentPdf(poId);
      } catch (error) {
        throw new Error(
          `QuickBooks was updated, but reconciliation failed: ${error.message || 'Could not rerun the comparison.'}`
        );
      }

      setQbLineUpdateState({
        error: '',
        isSaving: true,
        phase: 'refreshing',
      });

      const updatedOrder = await fetchPurchaseOrderByPoNumber(poId);

      if (updatedOrder) {
        setOrder(updatedOrder);
      }

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
      setQbLineUpdateState({
        error: error.message || 'Could not update the QuickBooks line.',
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
          <PODetailTable
            lines={lines}
            totalResults={totalResults}
            onEditQuickBooksLine={handleEditQbLine}
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
              <div className="pdt-edit-description">
                {editingQbLine.poDescription || 'No QuickBooks description available.'}
              </div>

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
