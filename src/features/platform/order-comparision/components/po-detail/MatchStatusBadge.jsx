// Statuses: matched | suggested | price-issue | qty-issue | qty-price-issue | description-issue | missing-qb | missing-pdf | review

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
  'qty-price-issue': {
    label: 'Qty + Price',
    icon: '!',
    className: 'msb--qty-price-issue',
  },
  'description-issue': {
    label: 'Description',
    icon: '!',
    className: 'msb--description-issue',
  },
  'missing-qb': {
    label: 'Missing QB',
    icon: '!',
    className: 'msb--missing-qb',
  },
  'missing-pdf': {
    label: 'Missing PDF',
    icon: '+',
    className: 'msb--missing-pdf',
  },
  missing: {
    label: 'Missing',
    icon: '!',
    className: 'msb--missing-qb',
  },
  extra: {
    label: 'Extra',
    icon: '+',
    className: 'msb--missing-pdf',
  },
  review: {
    label: 'Review',
    icon: '?',
    className: 'msb--review',
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
