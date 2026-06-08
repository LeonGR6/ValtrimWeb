import '../../../../../styles/poDetail.css';

export default function PODetailHeader({ po }) {
  const isConfirmed = ['RECEIVED', 'Approved'].includes(po.confirmation);
  const confidence = po.aiConfidence != null ? `${Math.round(Number(po.aiConfidence) * 1)}%` : null;

  return (
    <div className="po-detail-header">
      <div className="pdh-top">
        <div className="pdh-title-group">
          <span className="pdh-eyebrow">Purchase Order</span>
          <h2 className="pdh-po-number">PO #{po.poNumber}</h2>
        </div>
        <div className="pdh-status-group">
          <span className={`status-badge status-${po.status?.toLowerCase().replace(/\s+/g, '-')}`}>
            {po.status}
          </span>
          {isConfirmed ? (
            <span className="pdh-confirmation pdh-confirmation--received">Confirmation Approved</span>
          ) : (
            <span className="pdh-confirmation pdh-confirmation--pending">Awaiting Confirmation</span>
          )}
        </div>
      </div>

      <div className="pdh-cards">
        <div className="pdh-card">
          <span className="pdh-card-label">Vendor</span>
          <span className="pdh-card-value">{po.vendor}</span>
        </div>
        <div className="pdh-card">
          <span className="pdh-card-label">Job</span>
          <span className="pdh-card-value">{po.job}</span>
        </div>
        <div className="pdh-card">
          <span className="pdh-card-label">Phase / Lots</span>
          <span className="pdh-card-value">{po.phase}</span>
        </div>
        <div className="pdh-card">
          <span className="pdh-card-label">Required Date</span>
          <span className="pdh-card-value">{po.requiredDate ?? '-'}</span>
        </div>
        <div className="pdh-card">
          <span className="pdh-card-label">Vendor Ship Date</span>
          <span className="pdh-card-value">{po.vendorShipDate ?? '-'}</span>
        </div>
        {po.totalPdf && (
          <div className="pdh-card pdh-card--highlight">
            <span className="pdh-card-label">PDF Total</span>
            <span className="pdh-card-value pdh-total">{po.totalPdf}</span>
          </div>
        )}
        {po.totalQb && (
          <div className="pdh-card pdh-card--highlight">
            <span className="pdh-card-label">QB Total</span>
            <span className="pdh-card-value pdh-total">{po.totalQb}</span>
          </div>
        )}
        {po.aiStatus && (
          <div className="pdh-card">
            <span className="pdh-card-label">AI Status</span>
            <span className="pdh-card-value">{po.aiStatus}</span>
          </div>
        )}
        {confidence && (
          <div className="pdh-card">
            <span className="pdh-card-label">AI Confidence</span>
            <span className="pdh-card-value">{confidence}</span>
          </div>
        )}
        {po.matchedCount != null && (
          <div className="pdh-card">
            <span className="pdh-card-label">Matched Lines</span>
            <span className="pdh-card-value">{po.matchedCount}</span>
          </div>
        )}
        {po.discrepanciesCount != null && (
          <div className="pdh-card">
            <span className="pdh-card-label">Discrepancies</span>
            <span className="pdh-card-value">{po.discrepanciesCount}</span>
          </div>
        )}
        {po.pdfLinesCount != null && (
          <div className="pdh-card">
            <span className="pdh-card-label">PDF Lines</span>
            <span className="pdh-card-value">{po.pdfLinesCount}</span>
          </div>
        )}
        {po.qbLinesCount != null && (
          <div className="pdh-card">
            <span className="pdh-card-label">QB Lines</span>
            <span className="pdh-card-value">{po.qbLinesCount}</span>
          </div>
        )}
      </div>

      {(po.aiSummary || po.aiDecisionReason) && (
        <div className="pdh-ai-note">
          {po.aiSummary && <p>{po.aiSummary}</p>}
          {po.aiDecisionReason && <p>{po.aiDecisionReason}</p>}
        </div>
      )}
    </div>
  );
}
