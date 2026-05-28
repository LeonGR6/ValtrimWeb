// PODetailHeader.jsx

import '../../../../../styles/poDetail.css';

export default function PODetailHeader({ po }) {
  // po = { poNumber, vendor, job, phase, requiredDate, vendorShipDate, total, status, confirmation }

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
          {po.confirmation === 'RECEIVED' ? (
            <span className="pdh-confirmation pdh-confirmation--received">✓ Confirmation Received</span>
          ) : (
            <span className="pdh-confirmation pdh-confirmation--pending">⏳ Awaiting Confirmation</span>
          )}
        </div>
      </div>

      {/* Metadata Cards */}
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
          <span className="pdh-card-value">{po.requiredDate ?? '—'}</span>
        </div>
        <div className="pdh-card">
          <span className="pdh-card-label">Vendor Ship Date</span>
          <span className="pdh-card-value">{po.vendorShipDate ?? '—'}</span>
        </div>
        <div className="pdh-card pdh-card--highlight">
          <span className="pdh-card-label">Total</span>
          <span className="pdh-card-value pdh-total">{po.total}</span>
        </div>
      </div>

    </div>
  );
}
