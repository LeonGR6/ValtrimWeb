import { useLocation, useNavigate, useParams } from 'react-router-dom';
import PODetailHeader from '../components/po-detail/PODetailHeader.jsx';
import PODetailTable from '../components/po-detail/PODetailTable.jsx';

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
  if (!status) return 'Draft';
  if (status === 'APPROVED') return 'Approved';

  return status
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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

const normalizeDetailLine = (line, index, po) => ({
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

  const po = {
    poNumber: order.poNumber || reconciliation.po_number || poId,
    vendor: order.vendor || reconciliation.supplier || reconciliation.vendor_name || '',
    job: order.job || reconciliation.job || '',
    phase: order.phaseLots || reconciliation.phaseLots || '',
    requiredDate: order.requiredDate || reconciliation.required_date || '',
    vendorShipDate: order.vendorShipDate || reconciliation.ship_date || 'PENDING',
    total: order.total || formatCurrency(reconciliation.totalPdf ?? reconciliation.totalQb),
    totalPdf: formatCurrency(reconciliation.totalPdf),
    totalQb: formatCurrency(reconciliation.totalQb),
    status: order.status || formatStatus(reconciliation.ai_final_status || reconciliation.status),
    confirmation: order.confirmation || (reconciliation.ai_final_status === 'APPROVED' ? 'Approved' : 'Pending'),
    aiStatus: formatStatus(reconciliation.ai_final_status),
    aiConfidence: reconciliation.ai_confidence,
    aiSummary: reconciliation.ai_summary,
    aiDecisionReason: reconciliation.ai_decision_reason,
    matchedCount: reconciliation.summary?.matched_lines_count ?? reconciliation.matched_lines?.length ?? 0,
    discrepanciesCount: reconciliation.summary?.discrepancies_count ?? reconciliation.discrepancias?.length ?? 0,
    pdfLinesCount: reconciliation.summary?.pdf_lines_count,
    qbLinesCount: reconciliation.summary?.qb_lines_count_after_filter ?? reconciliation.summary?.qb_lines_count_original,
  };

  const matchedLines = reconciliation.matched_lines || [];
  const discrepancyLines = reconciliation.discrepancias || [];
  const lines = [...matchedLines, ...discrepancyLines].map((line, index) => (
    normalizeDetailLine(line, index, po)
  ));

  return {
    po,
    lines,
    totalResults: lines.length,
  };
};

export default function PODetailPage() {
  const { poId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { po, lines, totalResults } = buildDetailFromOrder(location.state?.order, poId);

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

      <PODetailHeader po={po} />
      <PODetailTable lines={lines} totalResults={totalResults} />
    </div>
  );
}
