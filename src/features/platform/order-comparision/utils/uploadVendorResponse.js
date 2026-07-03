const getPayload = (responseData) => {
  const payload = Array.isArray(responseData) ? responseData[0] : responseData;
  const jsonPayload = payload?.json || payload || {};
  const isObjectPayload = typeof jsonPayload === 'object' && jsonPayload !== null;
  const hasWorkflowMetadata = isObjectPayload && (
    'success' in jsonPayload ||
    'status' in jsonPayload ||
    'persistence' in jsonPayload
  );

  return isObjectPayload && !hasWorkflowMetadata && jsonPayload.data && typeof jsonPayload.data === 'object'
    ? jsonPayload.data
    : jsonPayload;
};

const getErrorMessage = (payload, fallback) => (
  payload?.user_message ||
  payload?.error_message ||
  payload?.message ||
  fallback
);

const getPersistenceWarning = (payload) => (
  payload?.persistence_warning ||
  payload?.persistence?.sheets?.error ||
  payload?.user_message ||
  payload?.error_message ||
  payload?.message ||
  'The purchase order was saved, but a secondary persistence step could not be completed.'
);

const isNonBlockingPersistenceWarning = (payload) => (
  payload?.success === false &&
  payload?.status !== 'FLOW_ERROR' &&
  payload?.persistence?.database?.ok === true &&
  Boolean(payload?.data)
);

export const resolveUploadPayload = (responseData, responseOk = true) => {
  const payload = getPayload(responseData);

  if (isNonBlockingPersistenceWarning(payload)) {
    return {
      ...payload,
      success: true,
      persistence_warning: getPersistenceWarning(payload),
    };
  }

  if (!responseOk) {
    throw new Error(getErrorMessage(payload, 'Error processing the PDF in n8n.'));
  }

  if (payload?.success === false || payload?.status === 'FLOW_ERROR') {
    throw new Error(getErrorMessage(payload, 'The workflow failed before saving the purchase order.'));
  }

  return payload;
};

export const findPoNumber = (value, seen = new Set(), allowPrimitive = true) => {
  if (!value || typeof value !== 'object') {
    const primitivePoNumber = allowPrimitive ? String(value ?? '').trim() : '';
    return primitivePoNumber || null;
  }

  if (seen.has(value)) return null;

  seen.add(value);

  const directPoNumber = (
    value.po_number ??
    value.poNumber ??
    value.purchase_order_number ??
    value.purchaseOrderNumber
  );

  if (directPoNumber != null && String(directPoNumber).trim()) {
    return String(directPoNumber).trim();
  }

  for (const nestedValue of Object.values(value)) {
    const poNumber = findPoNumber(nestedValue, seen, false);

    if (poNumber) return poNumber;
  }

  return null;
};

const addCandidate = (candidates, value) => {
  const candidate = String(value || '').trim();

  if (!candidate || candidates.includes(candidate)) return;

  candidates.push(candidate);
};

export const getPoNumberCandidatesFromFileName = (fileName) => {
  const baseName = String(fileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_]+/g, ' ')
    .trim();
  const candidates = [];

  addCandidate(candidates, baseName);
  addCandidate(candidates, baseName.replace(/^po[\s#-]+/i, ''));

  const tokenMatches = baseName.match(/[a-z]+[\s-]*\d+[a-z0-9-]*|\d{3,}[a-z0-9-]*/gi) || [];

  tokenMatches.forEach((match) => {
    addCandidate(candidates, match);
    addCandidate(candidates, match.replace(/\s+/g, '-'));
    addCandidate(candidates, match.replace(/[\s-]+/g, ''));
  });

  const numericMatches = baseName.match(/\d{3,}/g) || [];
  numericMatches.forEach((match) => addCandidate(candidates, match));

  return candidates;
};

export const wasPurchaseOrderRecentlyUpdated = (purchaseOrder, startedAt, windowMs = 5 * 60 * 1000) => {
  if (!purchaseOrder) return false;

  const timestamp =
    purchaseOrder?.dbRow?.updated_at ||
    purchaseOrder?.dbRow?.created_at ||
    purchaseOrder?.updated_at ||
    purchaseOrder?.created_at;
  const updatedAt = Date.parse(timestamp);
  const referenceTime = Number(startedAt);

  if (!Number.isFinite(updatedAt) || !Number.isFinite(referenceTime)) {
    return true;
  }

  return updatedAt >= referenceTime - windowMs;
};

export const buildRecoveredUploadPayload = (purchaseOrder, originalError) => {
  const poNumber = purchaseOrder?.poNumber || purchaseOrder?.po_number || purchaseOrder?.dbRow?.po_number;
  const warning =
    'The purchase order was saved in the database, but Google Sheets was not updated or could not be confirmed because the webhook response failed.';

  return {
    success: true,
    status: 'PERSISTENCE_WARNING',
    recovered_from_webhook_error: true,
    original_error: originalError?.message || String(originalError || ''),
    persistence_warning: warning,
    persistence: {
      database: { ok: true, error: null },
      sheets: { ok: false, error: warning },
    },
    data: {
      po_number: poNumber,
      reconciliation: purchaseOrder?.reconciliation,
      db_row: purchaseOrder?.dbRow,
    },
  };
};
