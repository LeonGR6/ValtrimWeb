import MatchStatusBadge from './MatchStatusBadge.jsx';
import '../../../../../styles/poDetail.css';

const parseMoneyValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const sanitizedValue = String(value).replace(/[^0-9.-]/g, '');
  const amount = Number(sanitizedValue);

  return Number.isFinite(amount) ? amount : null;
};

const formatMoney = (value) => {
  const amount = parseMoneyValue(value);

  if (amount === null) {
    return null;
  }

  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const getBulkProgressLabel = (bulkUpdateState) => {
  if (!bulkUpdateState?.isSaving && bulkUpdateState?.phase !== 'success') {
    return '';
  }

  if (bulkUpdateState.phase === 'saving-qb') {
    const completed = Number(bulkUpdateState.completed || 0);
    const total = Number(bulkUpdateState.total || 0);
    const nextIndex = Math.min(completed + 1, total);
    const lineLabel = bulkUpdateState.currentLine ? ` - QB line ${bulkUpdateState.currentLine}` : '';

    return `Updating ${nextIndex} of ${total}${lineLabel}`;
  }

  if (bulkUpdateState.phase === 'reconciling') {
    return 'Reconciling once';
  }

  if (bulkUpdateState.phase === 'refreshing') {
    return 'Refreshing PO';
  }

  if (bulkUpdateState.phase === 'success') {
    return 'PO updated';
  }

  return '';
};

function ActionButton({ disabled = false, line, onEditQuickBooksLine }) {
  if (!line.poLineNumber || !onEditQuickBooksLine) {
    return <span className="pdt-muted">-</span>;
  }

  return (
    <button
      className="pdt-action-btn pdt-action-btn--manual"
      disabled={disabled}
      type="button"
      onClick={() => onEditQuickBooksLine(line)}
    >
      Edit QB
    </button>
  );
}

function MoneyCell({ value }) {
  if (Array.isArray(value)) {
    const values = value.filter((item) => item !== null && item !== undefined && item !== '');

    if (values.length > 0) {
      return (
        <span>
          {values.map(formatMoney).filter(Boolean).join(', ')}
        </span>
      );
    }
  }

  if (typeof value === 'string' && value.includes(',')) {
    const values = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map(parseMoneyValue)
      .filter((item) => item !== null);

    if (values.length > 0) {
      return (
        <span>
          {values.map(formatMoney).filter(Boolean).join(', ')}
        </span>
      );
    }
  }

  const amount = parseMoneyValue(value);

  if (amount === null) {
    return <span className="pdt-muted">-</span>;
  }

  return (
    <span>
      {formatMoney(amount)}
    </span>
  );
}

function BulkSelectionCell({
  bulkApplicableLineIdSet,
  disabled,
  hasBulkSelection,
  line,
  onToggleBulkLine,
  selectedBulkLineIdSet,
}) {
  if (!hasBulkSelection) {
    return null;
  }

  const isEligible = bulkApplicableLineIdSet.has(line.id);

  if (!isEligible) {
    return (
      <td className="pdt-select-cell">
        <span className="pdt-muted">-</span>
      </td>
    );
  }

  return (
    <td className="pdt-select-cell">
      <input
        aria-label={`Select QB line ${line.poLineNumber} for rate update`}
        checked={selectedBulkLineIdSet.has(line.id)}
        className="pdt-select-checkbox"
        disabled={disabled}
        type="checkbox"
        onChange={() => onToggleBulkLine(line.id)}
      />
    </td>
  );
}

function EmptyCell({ value }) {
  return value ?? <span className="pdt-muted">-</span>;
}

const splitGroupedDescription = (value, expectedCount) => {
  if (expectedCount < 2) {
    return [];
  }

  const descriptions = String(value || '')
    .split(' / ')
    .map((item) => item.trim())
    .filter(Boolean);

  return descriptions.length === expectedCount ? descriptions : [];
};

const splitGroupedMeta = (value) => {
  if (value === null || value === undefined || value === '') {
    return [];
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

function GroupedPdfDescription({ line, description }) {
  const lineNumbers = splitGroupedMeta(line.pdfLineNumber);
  const quantities = splitGroupedMeta(line.confQty);
  const itemIds = splitGroupedMeta(line.vendorDescription?.itemId);
  const expectedGroupCount = Math.max(lineNumbers.length, quantities.length, itemIds.length);
  const descriptions = splitGroupedDescription(description, expectedGroupCount);

  if (descriptions.length < 2) {
    return <div>{description}</div>;
  }

  return (
    <div className="pdt-grouped-description">
      {descriptions.map((itemDescription, index) => {
        const lineNumber = lineNumbers[index];
        const quantity = quantities[index];
        const itemId = itemIds[index];

        return (
          <div className="pdt-grouped-item" key={`${line.id ?? 'group'}-${index}`}>
            <div className="pdt-grouped-item-header">
              <span>PDF Item {index + 1}</span>
              {lineNumber && <span>Line {lineNumber}</span>}
              {quantity && <span>Qty {quantity}</span>}
              {itemId && <span>{itemId}</span>}
            </div>
            <div>{itemDescription}</div>
          </div>
        );
      })}
    </div>
  );
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
        type === 'pdf' ? (
          <GroupedPdfDescription line={line} description={description} />
        ) : (
          <div>{description}</div>
        )
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

export default function PODetailTable({
  bulkApplicableLineIds = [],
  bulkSelectionDisabled = false,
  bulkUpdateState = null,
  lines = [],
  onApplyBulkRateFixes,
  onClearBulkSelection,
  onEditQuickBooksLine,
  onToggleAllBulkLines,
  onToggleBulkLine,
  selectedBulkLineIds = [],
  totalResults = 0,
}) {
  const visibleLineCount = lines.filter((line) => !line.isSection).length;
  const bulkApplicableLineIdSet = new Set(bulkApplicableLineIds);
  const selectedBulkLineIdSet = new Set(selectedBulkLineIds);
  const selectedBulkCount = selectedBulkLineIds.filter((lineId) => bulkApplicableLineIdSet.has(lineId)).length;
  const hasBulkSelection = bulkApplicableLineIds.length > 0 && Boolean(onToggleBulkLine);
  const isAllBulkSelected = hasBulkSelection && selectedBulkCount === bulkApplicableLineIds.length;
  const columnCount = hasBulkSelection ? 17 : 16;
  const bulkProgressLabel = getBulkProgressLabel(bulkUpdateState);

  return (
    <div className="pdt-wrapper">
      {hasBulkSelection && (
        <div className="pdt-bulk-toolbar">
          <div className="pdt-bulk-summary">
            <strong>{selectedBulkCount} selected</strong>
            <span>{bulkApplicableLineIds.length} price-only AI fixes</span>
          </div>

          {bulkProgressLabel && (
            <div className={`pdt-bulk-progress pdt-bulk-progress--${bulkUpdateState.phase}`}>
              <span className="pdt-bulk-progress-icon" />
              <span>{bulkProgressLabel}</span>
            </div>
          )}

          {bulkUpdateState?.error && (
            <div className="pdt-bulk-error">{bulkUpdateState.error}</div>
          )}

          <div className="pdt-bulk-actions">
            <button
              className="pdt-bulk-btn pdt-bulk-btn--secondary"
              disabled={bulkSelectionDisabled}
              type="button"
              onClick={onToggleAllBulkLines}
            >
              {isAllBulkSelected ? 'Clear all' : 'Select all'}
            </button>
            <button
              className="pdt-bulk-btn pdt-bulk-btn--secondary"
              disabled={bulkSelectionDisabled || selectedBulkCount === 0}
              type="button"
              onClick={onClearBulkSelection}
            >
              Clear
            </button>
            <button
              className="pdt-bulk-btn pdt-bulk-btn--primary"
              disabled={bulkSelectionDisabled || selectedBulkCount === 0}
              type="button"
              onClick={onApplyBulkRateFixes}
            >
              Apply selected rates
            </button>
          </div>
        </div>
      )}

      <div className="pdt-scroll">
        <table className="pdt-table">
          <thead>
            <tr>
              {hasBulkSelection && <th className="pdt-select-header">Fix</th>}
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
                <td colSpan={columnCount} className="pdt-empty">
                  No detail lines available yet.
                </td>
              </tr>
            ) : (
              lines.map((line, i) => {
                if (line.isSection) {
                  return (
                    <tr key={line.id ?? i} className="pdt-section-row">
                      <td colSpan={columnCount}>
                        <div className="pdt-section-title">{line.label}</div>
                        {line.description && (
                          <div className="pdt-section-description">{line.description}</div>
                        )}
                      </td>
                    </tr>
                  );
                }

                const isBulkSelected = selectedBulkLineIdSet.has(line.id);

                return (
                  <tr key={line.id ?? i} className={`pdt-row pdt-row--${line.status}${isBulkSelected ? ' pdt-row--bulk-selected' : ''}`}>
                    <BulkSelectionCell
                      bulkApplicableLineIdSet={bulkApplicableLineIdSet}
                      disabled={bulkSelectionDisabled}
                      hasBulkSelection={hasBulkSelection}
                      line={line}
                      onToggleBulkLine={onToggleBulkLine}
                      selectedBulkLineIdSet={selectedBulkLineIdSet}
                    />
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
                        disabled={bulkSelectionDisabled}
                        line={line}
                        onEditQuickBooksLine={onEditQuickBooksLine}
                      />
                    </td>
                  </tr>
                );
              })
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
