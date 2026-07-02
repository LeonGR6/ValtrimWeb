const ERROR_STATUSES = new Set(['ERROR', 'FAILED', 'FAILURE', 'FLOW_ERROR']);
const OK_STATUSES = new Set(['APPROVED', 'AI_APPROVED', 'MATCH', 'MATCHED', 'MATCH_TOTAL']);

const toCount = (value) => {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
};

const getActionableWarnings = (warnings) => (
  Array.isArray(warnings)
    ? warnings.filter((warning) => warning?.type !== 'QB_GROUPED_LINES')
    : []
);

export function getPurchaseOrderIssueCounts(data = {}, row = {}) {
  const discrepancies = Math.max(
    toCount(row.discrepancies_count),
    toCount(data.summary?.discrepancies_count),
    Array.isArray(data.discrepancias) ? data.discrepancias.length : 0
  );

  const warnings = Math.max(
    toCount(row.warnings_count),
    toCount(data.summary?.warnings_count),
    getActionableWarnings(data.warnings).length
  );

  return {
    discrepancies,
    warnings,
    total: discrepancies + warnings,
  };
}

export function getPurchaseOrderIssueCount(data = {}, row = {}) {
  return getPurchaseOrderIssueCounts(data, row).total;
}

export function getPurchaseOrderAiSuggestionCount(data = {}) {
  return Math.max(
    toCount(data.summary?.ai_suggested_matches_count),
    toCount(data.summary?.ai_price_only_suggested_matches_count),
    Array.isArray(data.ai_suggested_matches) ? data.ai_suggested_matches.length : 0,
    Array.isArray(data.ai_differences) ? data.ai_differences.length : 0
  );
}

export function buildPurchaseOrderAlert(data = {}, row = {}) {
  const statuses = [
    data.status,
    data.final_status,
    data.ai_final_status,
    row.match_status,
    row.ai_final_status,
  ]
    .filter(Boolean)
    .map((status) => String(status).toUpperCase());

  if (statuses.some((status) => ERROR_STATUSES.has(status))) {
    return 'Error';
  }

  if (getPurchaseOrderIssueCount(data, row) > 0) {
    return 'Review';
  }

  if (statuses.some((status) => OK_STATUSES.has(status))) {
    return 'OK';
  }

  return 'Pending';
}
