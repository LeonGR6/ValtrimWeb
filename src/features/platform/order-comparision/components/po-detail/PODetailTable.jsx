import { useState } from 'react';
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

function VarianceCell({ variance }) {
  if (variance === null || variance === undefined) return <span className="pdt-muted">-</span>;

  const num = parseFloat(variance);
  if (num === 0) return <span className="pdt-variance pdt-variance--zero">$0.00</span>;
  if (num > 0) return <span className="pdt-variance pdt-variance--positive">+${num.toFixed(2)}</span>;
  return <span className="pdt-variance pdt-variance--negative">-${Math.abs(num).toFixed(2)}</span>;
}

export default function PODetailTable({ lines = [], totalResults = 0 }) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(totalResults / 5) || 1;

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
                <td colSpan="18" className="pdt-empty">
                  No detail lines available yet.
                </td>
              </tr>
            ) : (
              lines.map((line, i) => (
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
                  <td className="pdt-description pdt-description--vendor">
                    {line.vendorDescription?.itemId ? (
                      <>
                        <strong>Item ID:</strong> {line.vendorDescription.itemId}
                        <br />
                        <strong>Description:</strong> {line.vendorDescription.description}
                      </>
                    ) : (
                      line.vendorDescription?.description
                    )}
                  </td>
                  <td className="pdt-description">
                    {line.poDescription ?? (
                      <span className="pdt-no-match">No QB line found</span>
                    )}
                  </td>
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
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pdt-footer">
        <span className="pdt-results-count">
          Showing {lines.length} of {totalResults} results
        </span>
        <div className="pdt-pagination">
          <button
            className="pdt-page-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((page) => page - 1)}
          >
            Prev
          </button>
          {[...Array(Math.min(totalPages, 6))].map((_, i) => (
            <button
              key={i}
              className={`pdt-page-btn ${currentPage === i + 1 ? 'pdt-page-btn--active' : ''}`}
              onClick={() => setCurrentPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          {totalPages > 6 && <span className="pdt-page-ellipsis">...</span>}
          {totalPages > 6 && (
            <button
              className={`pdt-page-btn ${currentPage === totalPages ? 'pdt-page-btn--active' : ''}`}
              onClick={() => setCurrentPage(totalPages)}
            >
              {totalPages}
            </button>
          )}
          <button
            className="pdt-page-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((page) => page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
