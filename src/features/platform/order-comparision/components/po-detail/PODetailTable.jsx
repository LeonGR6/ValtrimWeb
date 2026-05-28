// Columnas: Status | AI Match | Issue Type | PO Line # | PO Qty | Conf. Qty |
//           PO Description | Vendor Description | PO Unit Cost | Conf. Unit Cost |
//           Variance | Req. Date | Vendor Ship Date | Action

import { useState } from 'react';
import MatchStatusBadge from './MatchStatusBadge.jsx';
import '../../../../../styles/poDetail.css';

function ActionButton({ status, onApprove, onReview, onManualMatch }) {
  if (status === 'matched') {
    return (
      <button className="pdt-action-btn pdt-action-btn--approve" onClick={onApprove}>
        Approved <span className="pdt-chevron">▾</span>
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
      Review <span className="pdt-chevron">▾</span>
    </button>
  );
}

// Variance cell: green if > 0, red if < 0, neutral if 0 or null
function VarianceCell({ variance }) {
  if (variance === null || variance === undefined) return <span className="pdt-muted">—</span>;

  const num = parseFloat(variance);
  if (num === 0) return <span className="pdt-variance pdt-variance--zero">${num.toFixed(2)}</span>;
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
              <th>PO Line #</th>
              <th>PO Qty</th>
              <th>Conf. Qty</th>
              <th>PO Description</th>
              <th>Vendor Description</th>
              <th>PO Unit Cost</th>
              <th>Conf. Unit Cost</th>
              <th>Variance</th>
              <th>Req. Date</th>
              <th>Vendor Ship Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className={`pdt-row pdt-row--${line.status}`}>
                <td>
                  <MatchStatusBadge status={line.status} />
                </td>
                {/* <td>
                  {line.aiMatch != null ? (
                    <span className="pdt-ai-match">{line.aiMatch}%</span>
                  ) : (
                    <span className="pdt-muted">—</span>
                  )}
                </td> */}
                <td>
                  <span className="pdt-issue-type">{line.issueType ?? '—'}</span>
                </td>
                <td>{line.poLineNumber ?? '—'}</td>
                <td>{line.poQty ?? '—'}</td>
                <td>{line.confQty ?? '—'}</td>
                <td className="pdt-description">{line.poDescription}</td>
                <td className="pdt-description pdt-description--vendor">
                  {line.vendorDescription ?? (
                    <span className="pdt-no-match">No matching line found in confirmation</span>
                  )}
                </td>
                <td>{line.poUnitCost != null ? `$${line.poUnitCost}` : '—'}</td>
                <td>{line.confUnitCost != null ? `$${line.confUnitCost}` : '—'}</td>
                <td>
                  <VarianceCell variance={line.variance} />
                </td>
                <td>{line.reqDate ?? '—'}</td>
                <td>{line.vendorShipDate ?? '—'}</td>
                <td>
                  <ActionButton
                    status={line.status}
                    onApprove={() => console.log('approve', line.poLineNumber)}
                    onReview={() => console.log('review', line.poLineNumber)}
                    onManualMatch={() => console.log('manual match', line.poLineNumber)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer with pagination */}
      <div className="pdt-footer">
        <span className="pdt-results-count">
          Showing {lines.length} of {totalResults} results
        </span>
        <div className="pdt-pagination">
          <button
            className="pdt-page-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            ‹
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
          {totalPages > 6 && <span className="pdt-page-ellipsis">…</span>}
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
            onClick={() => setCurrentPage(p => p + 1)}
          >
            ›
          </button>
        </div>
      </div>

    </div>
  );
}
