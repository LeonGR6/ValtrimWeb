import { useNavigate, useParams } from 'react-router-dom';
import PODetailHeader from '../components/po-detail/PODetailHeader.jsx';
import PODetailTable from '../components/po-detail/PODetailTable.jsx';

// ---- MOCK DATA (reemplazar con fetch real) ----
const MOCK_PO = {
  poNumber: '33308',
  vendor: 'Woodgrain Millwork',
  job: 'Magnolia Phase 6',
  phase: 'Lots 39–45',
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
    vendorDescription: 'HTT Entry Unit 2/8 6/8 SC 2PNL Double Bore',
    poUnitCost: 133.18,
    confUnitCost: 133.18,
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
    vendorDescription: 'HTT ENTRY UNIT 3/0 6/8 1-3/4 RH SC 2PNL SQ 20MIN DBL BORE',
    poUnitCost: 133.18,
    confUnitCost: 142.27,
    variance: 9.09,
    reqDate: '06/11/2026',
    vendorShipDate: '06/05/2026',
  },
  {
    status: 'qty-issue',
    aiMatch: 91,
    issueType: 'Quantity',
    poLineNumber: 18,
    poQty: 10,
    confQty: 8,
    poDescription: '2-4 x 6-8 Prefit Jamb Colonial Casing',
    vendorDescription: 'F246SHCOL120CSG Jamb Set 2-4 x 6-8',
    poUnitCost: 44.45,
    confUnitCost: 44.45,
    variance: -88.90,
    reqDate: '06/11/2026',
    vendorShipDate: '06/05/2026',
  },
  {
    status: 'missing',
    aiMatch: 0,
    issueType: 'Missing',
    poLineNumber: 21,
    poQty: 4,
    confQty: null,
    poDescription: '2-6 x 6-8 Prefit Jamb Colonial Casing',
    vendorDescription: null,
    poUnitCost: 45.33,
    confUnitCost: null,
    variance: null,
    reqDate: '06/11/2026',
    vendorShipDate: null,
  },
  {
    status: 'extra',
    aiMatch: null,
    issueType: 'Extra',
    poLineNumber: null,
    poQty: null,
    confQty: 1,
    poDescription: null,
    vendorDescription: 'Freight Charge',
    poUnitCost: null,
    confUnitCost: 650.00,
    variance: 650.00,
    reqDate: null,
    vendorShipDate: '06/05/2026',
  },
];


export default function PODetailPage() {
  const { poId } = useParams();
  const navigate = useNavigate();

  // Aquí conectar: const { data: po, lines } = usePODetail(poId);
  const po = { ...MOCK_PO, poNumber: poId };
  const lines = MOCK_LINES;

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
      <PODetailTable lines={lines} totalResults={28} />

    </div>
  );
}
