const ALERT_CONFIG = {
  Error: {
    icon: '\u00d7',
    description: 'The comparison could not be completed.',
  },
  OK: {
    icon: '\u2713',
    description: 'The PDF and QuickBooks comparison is clear.',
  },
  Pending: {
    icon: '\u25b7',
    description: 'Waiting for a definitive comparison result.',
  },
  Review: {
    icon: '!',
    description: 'Issues require human review.',
  },
};

export default function AlertBadge({ alert, issues, aiSuggestions = 0 }) {
  const config = ALERT_CONFIG[alert] || ALERT_CONFIG.Pending;
  const issueCount = Number(issues) || 0;
  const suggestionCount = Number(aiSuggestions) || 0;
  const label = alert === 'Review' && issueCount > 0
    ? `Review ${String.fromCharCode(183)} ${issueCount}`
    : alert || 'Pending';
  const description = alert === 'Review' && issueCount > 0
    ? `${issueCount} issue${issueCount === 1 ? '' : 's'} require review.`
    : config.description;
  const suggestionDescription = `${suggestionCount} AI suggestion${suggestionCount === 1 ? '' : 's'} available. These do not count as issues.`;

  return (
    <div className="order-alert-group">
      <span
        className={`order-alert-badge order-alert-badge--${String(alert || 'Pending').toLowerCase()}`}
        title={description}
        aria-label={`${label}. ${description}`}
      >
        <span className="order-alert-badge__icon" aria-hidden="true">{config.icon}</span>
        <span>{label}</span>
      </span>

      {suggestionCount > 0 && (
        <span
          className="order-ai-suggestion-badge"
          title={suggestionDescription}
          aria-label={suggestionDescription}
        >
          AI {String.fromCharCode(183)} {suggestionCount}
        </span>
      )}
    </div>
  );
}
