// Statuses: matched | suggested | price-issue | qty-issue | missing | extra

const MATCH_STATUS_CONFIG = {
  matched: {
    label: 'Matched',
    icon: 'OK',
    className: 'msb--matched',
  },
  suggested: {
    label: 'AI Suggested',
    icon: 'AI',
    className: 'msb--suggested',
  },
  'price-issue': {
    label: 'Price Issue',
    icon: '!',
    className: 'msb--price-issue',
  },
  'qty-issue': {
    label: 'Qty Issue',
    icon: '!',
    className: 'msb--qty-issue',
  },
  missing: {
    label: 'Missing',
    icon: '!',
    className: 'msb--missing',
  },
  extra: {
    label: 'Extra',
    icon: '+',
    className: 'msb--extra',
  },
};

export default function MatchStatusBadge({ status }) {
  const config = MATCH_STATUS_CONFIG[status] ?? {
    label: status,
    icon: '?',
    className: '',
  };

  return (
    <span className={`match-status-badge ${config.className}`}>
      <span className="msb-icon">{config.icon}</span>
      {config.label}
    </span>
  );
}
