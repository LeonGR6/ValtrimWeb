import '../../../../../styles/poDetail.css';

const WORKFLOW_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'NEEDS_REVIEW', label: 'Needs Review' },
];

function formatWarningTitle(warning) {
  if (warning.description) return warning.description;
  if (warning.type) return warning.type.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  return 'Warning';
}

function formatWarningDetail(warning) {
  const parts = [];

  if (warning.message) parts.push(warning.message);
  if (warning.diff != null) parts.push(`Difference: ${warning.diff}`);
  if (warning.value_pdf != null) parts.push(`PDF: ${warning.value_pdf}`);
  if (warning.value_qb != null) parts.push(`QB: ${warning.value_qb}`);

  return parts.join(' · ');
}

function formatCurrencyDisplay(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const amount = typeof value === 'number'
    ? value
    : Number(String(value).replace(/[^0-9.-]/g, ''));

  if (!Number.isFinite(amount)) {
    return value;
  }

  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function PODetailHeader({
  po,
  workflowStatusValue = 'PENDING',
  isUpdatingStatus = false,
  onViewPdf,
  onWorkflowStatusChange,
}) {
  const isConfirmed = po.confirmation === 'Approved';
  const confidence = po.aiConfidence != null ? `${Math.round(Number(po.aiConfidence))}%` : null;
  const workflowStatusClass = po.status?.toLowerCase().replace(/\s+/g, '-');
  const totalPdf = formatCurrencyDisplay(po.totalPdf);
  const totalQb = formatCurrencyDisplay(po.totalQb);

  const handleStatusChange = (event) => {
    onWorkflowStatusChange?.(event.target.value);
  };

  return (
    <div className="po-detail-header">
      <div className="pdh-top">
        <div className="pdh-title-group">
          <span className="pdh-eyebrow">Purchase Order</span>
          <h2 className="pdh-po-number">PO #{po.poNumber}</h2>
        </div>
        <div className="pdh-status-group">
          <label className={`pdh-status-select-wrap status-badge status-${workflowStatusClass}`}>
            <span>STATUS:</span>
            <select
              className="pdh-status-select"
              value={workflowStatusValue}
              disabled={isUpdatingStatus}
              onChange={handleStatusChange}
            >
              {WORKFLOW_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {isConfirmed ? (
            <span className="pdh-confirmation pdh-confirmation--received">Approved for Workflow</span>
          ) : (
            <span className="pdh-confirmation pdh-confirmation--pending">Pending Human Review</span>
          )}
          <button className="pdh-pdf-button" type="button" onClick={onViewPdf}>
            View PDF
          </button>
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
        {totalPdf && (
          <div className="pdh-card pdh-card--highlight">
            <span className="pdh-card-label">PDF Total</span>
            <span className="pdh-card-value pdh-total">{totalPdf}</span>
          </div>
        )}
        {totalQb && (
          <div className="pdh-card pdh-card--highlight">
            <span className="pdh-card-label">QB Total</span>
            <span className="pdh-card-value pdh-total">{totalQb}</span>
          </div>
        )}
        {po.matchStatus && (
          <div className="pdh-card">
            <span className="pdh-card-label">Match Status</span>
            <span className="pdh-card-value">{po.matchStatus}</span>
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
        {po.suggestedMatchesCount > 0 && (
          <div className="pdh-card pdh-card--ai">
            <span className="pdh-card-label">AI Suggestions</span>
            <span className="pdh-card-value">{po.suggestedMatchesCount}</span>
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
        {po.warningsCount > 0 && (
          <div className="pdh-card">
            <span className="pdh-card-label">Warnings</span>
            <span className="pdh-card-value">{po.warningsCount}</span>
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
          <div className="pdh-ai-note-header">
            <span>AI Summary</span>
            {confidence && <strong>{confidence} confidence</strong>}
          </div>
          {po.aiSummary && <p>{po.aiSummary}</p>}
          {po.aiDecisionReason && (
            <details className="pdh-ai-details">
              <summary>Decision reason</summary>
              <p>{po.aiDecisionReason}</p>
            </details>
          )}
        </div>
      )}

      {po.warnings?.length > 0 && (
        <div className="pdh-warning-note">
          <div className="pdh-warning-note-header">
            <span>Warnings</span>
            <strong>{po.warnings.length}</strong>
          </div>
          <div className="pdh-warning-list">
            {po.warnings.map((warning, index) => (
              <div className="pdh-warning-item" key={`${warning.type ?? 'warning'}-${index}`}>
                <strong>{formatWarningTitle(warning)}</strong>
                {formatWarningDetail(warning) && (
                  <p>{formatWarningDetail(warning)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
