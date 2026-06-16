import MatchStatusBadge from './MatchStatusBadge.jsx';
import '../../../../../styles/poDetail.css';

function ActionButton({ status, onApprove, onReview, onManualMatch }) {
  if (status === 'matched') {
    return (
      <button className="pdt-action-btn pdt-action-btn--approve" onClick={onApprove}>
        Approved
      </button>
    );
  }

  if (status === 'missing') {
    return (
      <button className="pdt-action-btn pdt-action-btn--manual" onClick={onManualMatch}>
        Manual Match
      </button>
    );
  }

  return (
    <button className="pdt-action-btn pdt-action-btn--review" onClick={onReview}>
      Review
    </button>
  );
}

function MoneyCell({ value }) {
  if (Array.isArray(value)) {
    const values = value.filter((item) => item !== null && item !== undefined && item !== '');

    if (values.length > 0) {
      return (
        <span>
          {values.map((item) => Number(item).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })).join(', ')}
        </span>
      );
    }
  }

  if (typeof value === 'string' && value.includes(',')) {
    const values = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite);

    if (values.length > 0) {
      return (
        <span>
          {values.map((item) => item.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })).join(', ')}
        </span>
      );
    }
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return <span className="pdt-muted">-</span>;
  }

  return (
    <span>
      {amount.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  );
}

function EmptyCell({ value }) {
  return value ?? <span className="pdt-muted">-</span>;
}

function DescriptionCell({ line, type }) {
  const description = type === 'pdf'
    ? line.vendorDescription?.description
    : line.poDescription;
  const itemId = type === 'pdf' ? line.vendorDescription?.itemId : null;
  const emptyText = type === 'pdf' ? 'No PDF line found' : 'No QB line found';

  return (
    <td className={`pdt-description ${type === 'pdf' ? 'pdt-description--vendor' : ''}`}>
      {itemId && (
        <div className="pdt-description-meta">
          Item ID: {itemId}
        </div>
      )}
      {description ? (
        <div>{description}</div>
      ) : (
        <span className="pdt-no-match">{emptyText}</span>
      )}
      {type === 'pdf' && line.sourceMessage && (
        <div className="pdt-ai-reason">
          <strong>{line.status === 'suggested' ? 'AI reason' : 'Note'}:</strong> {line.sourceMessage}
        </div>
      )}
      {type === 'qb' && line.matchType && (
        <div className="pdt-description-meta">
          {line.matchType.replaceAll('_', ' ').toLowerCase()}
          {line.financialsMatch ? ' - financials match' : ''}
        </div>
      )}
    </td>
  );
}

function VarianceCell({ variance }) {
  if (variance === null || variance === undefined) return <span className="pdt-muted">-</span>;

  const num = parseFloat(variance);
  if (num === 0) return <span className="pdt-variance pdt-variance--zero">$0.00</span>;
  if (num > 0) return <span className="pdt-variance pdt-variance--positive">+${num.toFixed(2)}</span>;
  return <span className="pdt-variance pdt-variance--negative">-${Math.abs(num).toFixed(2)}</span>;
}

export default function PODetailTable({ lines = [], totalResults = 0 }) {
  const visibleLineCount = lines.filter((line) => !line.isSection).length;

  return (
    <div className="pdt-wrapper">
      <div className="pdt-scroll">
        <table className="pdt-table">
          <thead>
            <tr>
              <th>Status</th>
              {/* <th>AI Match</th> */}
              <th>Issue Type</th>
              {/* <th>Item</th> */}
              <th>PDF Line</th>
              <th>QB Line</th>
              <th>PDF Qty</th>
              <th>QB Qty</th>
              <th>PDF Description</th>
              <th>QB Description</th>
              <th>PDF Unit</th>
              <th>QB Rate</th>
              <th>PDF Total</th>
              <th>QB Total</th>
              <th>Variance</th>
              <th>Req. Date</th>
              <th>Vendor Ship Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan="16" className="pdt-empty">
                  No detail lines available yet.
                </td>
              </tr>
            ) : (
              lines.map((line, i) => (
                line.isSection ? (
                  <tr key={line.id ?? i} className="pdt-section-row">
                    <td colSpan="16">
                      <div className="pdt-section-title">{line.label}</div>
                      {line.description && (
                        <div className="pdt-section-description">{line.description}</div>
                      )}
                    </td>
                  </tr>
                ) : (
                <tr key={line.id ?? i} className={`pdt-row pdt-row--${line.status}`}>
                  <td>
                    <MatchStatusBadge status={line.status} />
                  </td>
                  {/* <td>
                    {line.aiMatch != null ? (
                      <span className="pdt-ai-match">{line.aiMatch}%</span>
                    ) : (
                      <span className="pdt-muted">-</span>
                    )}
                  </td> */}
                  <td>
                    <span className="pdt-issue-type">{line.issueType ?? '-'}</span>
                  </td>
                  {/* <td><EmptyCell value={line.itemId} /></td> */}
                  <td><EmptyCell value={line.pdfLineNumber} /></td>
                  <td><EmptyCell value={line.poLineNumber} /></td>
                  <td><EmptyCell value={line.confQty} /></td>
                  <td><EmptyCell value={line.poQty} /></td>
                  <DescriptionCell line={line} type="pdf" />
                  <DescriptionCell line={line} type="qb" />
                  <td><MoneyCell value={line.confUnitCost} /></td>
                  <td><MoneyCell value={line.poUnitCost} /></td>
                  <td><MoneyCell value={line.confTotal} /></td>
                  <td><MoneyCell value={line.poTotal} /></td>
                  <td>
                    <VarianceCell variance={line.variance} />
                  </td>
                  <td>{line.reqDate ?? '-'}</td>
                  <td>{line.vendorShipDate ?? '-'}</td>
                  <td>
                    <ActionButton
                      status={line.status}
                      onApprove={() => console.log('approve', line.poLineNumber)}
                      onReview={() => console.log('review', line.poLineNumber)}
                      onManualMatch={() => console.log('manual match', line.poLineNumber)}
                    />
                  </td>
                </tr>
                )
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pdt-footer">
        <span className="pdt-results-count">
          Showing {visibleLineCount} of {totalResults} results
        </span>
        
      </div>
    </div>
  );
}
