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
