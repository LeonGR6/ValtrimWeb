import '../../../../../styles/poDetail.css';

const NOTE_MAX_LENGTH = 2000;

export default function PONotesPanel({
  isSaving = false,
  onChange,
  onClear,
  onReset,
  onSave,
  persistedValue = '',
  saveState = {},
  updatedAt = '',
  value = '',
}) {
  const hasUnsavedChanges = value !== persistedValue;
  const charactersRemaining = NOTE_MAX_LENGTH - value.length;
  const status = (() => {
    if (isSaving) return { className: 'pon-state--saving', label: 'Saving' };
    if (saveState.error) return { className: 'pon-state--error', label: 'Error' };
    if (hasUnsavedChanges) return { className: 'pon-state--dirty', label: 'Unsaved' };
    if (saveState.phase === 'saved') return { className: 'pon-state--saved', label: 'Saved' };
    if (persistedValue.trim()) return { className: 'pon-state--saved', label: 'Saved' };

    return { className: 'pon-state--empty', label: 'No note' };
  })();

  return (
    <section className={`po-notes-panel${hasUnsavedChanges ? ' po-notes-panel--dirty' : ''}`}>
      <div className="pon-header">
        <div>
          <span className="pon-eyebrow">Internal Notes</span>
          <h3>PO note</h3>
        </div>
        <span className={`pon-state ${status.className}`}>
          <span className="pon-state-dot" />
          {status.label}
        </span>
      </div>

      <textarea
        aria-label="Internal purchase order note"
        className="pon-textarea"
        disabled={isSaving}
        maxLength={NOTE_MAX_LENGTH}
        placeholder="Add delivery, or review context for this PO."
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />

      <div className="pon-footer">
        <div className="pon-meta">
          <span>{updatedAt ? `Last note edit ${updatedAt}` : 'No note edits yet'}</span>
          <span className={charactersRemaining <= 120 ? 'pon-count pon-count--warning' : 'pon-count'}>
            {value.length}/{NOTE_MAX_LENGTH}
          </span>
        </div>

        <div className="pon-actions">
          <button
            className="pon-btn pon-btn--secondary"
            disabled={isSaving || value.length === 0}
            type="button"
            onClick={onClear}
          >
            Clear
          </button>
          <button
            className="pon-btn pon-btn--secondary"
            disabled={isSaving || !hasUnsavedChanges}
            type="button"
            onClick={onReset}
          >
            Reset
          </button>
          <button
            className="pon-btn pon-btn--primary"
            disabled={isSaving || !hasUnsavedChanges}
            type="button"
            onClick={onSave}
          >
            {isSaving ? 'Saving...' : 'Save note'}
          </button>
        </div>
      </div>

      {saveState.error && (
        <div className="pon-error">{saveState.error}</div>
      )}
    </section>
  );
}
