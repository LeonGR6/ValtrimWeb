const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const QB_LINE_UPDATE_WEBHOOK = '/webhook/update-qb-po-line';
export const VENDOR_PDF_UPLOAD_WEBHOOK = '/webhook/upload-pdf-vendor';

const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const formatCurrency = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return '$0.00';
  }

  return amount.toLocaleString('en-US', { 
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatDisplayDate = (value) => {
  if (!value) return '';

  const raw = String(value).trim();

  const normalizeYear = (yearValue) => {
    const year = Number(yearValue);

    if (!Number.isFinite(year)) return null;
    if (year < 100) return year >= 70 ? 1900 + year : 2000 + year;

    return year;
  };

  const formatParts = (monthValue, dayValue, yearValue) => {
    const month = Number(monthValue);
    const day = Number(dayValue);
    const year = normalizeYear(yearValue);

    if (!month || !day || !year) return raw;

    return `${month}/${day}/${year}`;
  };

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (isoMatch) {
    return formatParts(isoMatch[2], isoMatch[3], isoMatch[1]);
  }

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);

  if (slashMatch) {
    return formatParts(slashMatch[1], slashMatch[2], slashMatch[3]);
  }

  const dashMatch = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/);

  if (dashMatch) {
    return formatParts(dashMatch[1], dashMatch[2], dashMatch[3]);
  }

  return raw;
};

export const formatWorkflowStatus = (status) => {
  if (!status) return 'Draft';

  const normalized = String(status).toUpperCase();

  if (normalized === 'PENDING') {
    return 'Pending';
  }

  if (normalized === 'APPROVED' || normalized === 'AI_APPROVED' || normalized === 'MATCH_TOTAL') {
    return 'Approved';
  }

  if (normalized === 'REVIEW' || normalized === 'MISMATCH') {
    return 'Needs Review';
  }

  if (normalized === 'REJECTED') {
    return 'Rejected';
  }

  return String(status)
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getJsonObject = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const getIssueCount = (data, row) => (
  row.discrepancies_count ??
  data.summary?.discrepancies_count ??
  data.discrepancias?.length ??
  data.ai_differences?.length ??
  0
);

const buildAlert = (data, row) => {
  const status = data.ai_final_status || row.ai_final_status || data.final_status || row.match_status;

  if (status === 'APPROVED' || status === 'AI_APPROVED' || row.match_status === 'MATCH_TOTAL') {
    return 'OK';
  }

  if (Number(getIssueCount(data, row)) > 0) {
    return 'Review';
  }

  return 'New';
};

export const normalizePurchaseOrderRow = (row) => {
  const latestJson = getJsonObject(row.latest_json || row.comparison_json);
  const workflowStatus = row.workflow_status ?? latestJson.workflow_status ?? 'PENDING';
  const matchStatus = row.match_status ?? latestJson.final_status ?? latestJson.status;
  const aiFinalStatus = row.ai_final_status ?? latestJson.ai_final_status;
  const reconciliation = {
    ...latestJson,
    po_number: row.po_number ?? latestJson.po_number,
    supplier: row.supplier ?? latestJson.supplier,
    job: row.job ?? latestJson.job,
    phaseLots: row.phase_lots ?? latestJson.phaseLots ?? latestJson.phase_lots,
    ack_date: row.order_date ?? latestJson.order_date,
    required_date: row.required_date ?? latestJson.required_date,
    ship_date: row.ship_date ?? latestJson.ship_date,
    totalPdf: row.total_pdf ?? latestJson.totalPdf ?? latestJson.total_pdf,
    totalQb: row.total_qb ?? latestJson.totalQb ?? latestJson.total_qb,
    workflow_status: workflowStatus,
    final_status: matchStatus,
    match_status: matchStatus,
    ai_final_status: aiFinalStatus,
    ai_confidence: row.ai_confidence ?? latestJson.ai_confidence,
  };

  return {
    id: row.id ?? row.po_number,
    alert: buildAlert(reconciliation, row),
    status: formatWorkflowStatus(workflowStatus),
    workflowStatus: formatWorkflowStatus(workflowStatus),
    workflowStatusRaw: workflowStatus,
    matchStatus: formatWorkflowStatus(matchStatus),
    matchStatusRaw: matchStatus,
    aiStatus: formatWorkflowStatus(aiFinalStatus),
    aiStatusRaw: aiFinalStatus,
    poNumber: row.po_number ?? '',
    job: row.job ?? '',
    phaseLots: row.phase_lots ?? '',
    vendor: row.supplier ?? '',
    requiredDate: formatDisplayDate(row.required_date),
    vendorShipDate: formatDisplayDate(row.ship_date) || 'PENDING',
    ackDate: formatDisplayDate(row.order_date) || 'PENDING',
    total: formatCurrency(row.total_pdf ?? row.total_qb),
    issues: String(getIssueCount(reconciliation, row)),
    confirmation: formatWorkflowStatus(workflowStatus),
    reconciliation,
    dbRow: row,
  };
};

const requestSupabase = async (path, options = {}) => {
  if (!hasSupabaseConfig) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Supabase request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

export const fetchPurchaseOrders = async () => {
  const rows = await requestSupabase('purchase_orders?select=*&order=updated_at.desc');
  return rows.map(normalizePurchaseOrderRow);
};

export const fetchPurchaseOrderByPoNumber = async (poNumber) => {
  const filter = encodeURIComponent(String(poNumber));
  const rows = await requestSupabase(`purchase_orders?select=*&po_number=eq.${filter}&limit=1`);

  return rows[0] ? normalizePurchaseOrderRow(rows[0]) : null;
};

export const updatePurchaseOrderWorkflowStatus = async (poNumber, workflowStatus) => {
  const filter = encodeURIComponent(String(poNumber));
  const rows = await requestSupabase(`purchase_orders?po_number=eq.${filter}&select=*`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      workflow_status: workflowStatus,
      updated_at: new Date().toISOString(),
    }),
  });

  return rows[0] ? normalizePurchaseOrderRow(rows[0]) : null;
};

const readWebhookResponse = async (response, fallbackError) => {
  const contentType = response.headers.get('content-type') || '';
  const responseData = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const details = typeof responseData === 'string'
      ? responseData
      : responseData?.user_message || responseData?.error_message || responseData?.message;

    throw new Error(details || fallbackError || `Webhook request failed with ${response.status}`);
  }

  return responseData;
};

export const updateQuickBooksPurchaseOrderLine = async ({
  poNumber,
  qbLineNumber,
  currentQty,
  currentRate,
  nextQty,
  nextRate,
  qbDescription,
}) => {
  const response = await fetch(QB_LINE_UPDATE_WEBHOOK, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      po_number: String(poNumber),
      qb_line: qbLineNumber,
      current_qty: currentQty,
      current_rate: currentRate,
      next_qty: nextQty,
      next_rate: nextRate,
      qb_description: qbDescription,
    }),
  });

  return readWebhookResponse(response, 'Could not update the QuickBooks purchase order line.');
};

export const reconcilePurchaseOrderWithCurrentPdf = async (poNumber) => {
  const currentPdf = await fetchCurrentPurchaseOrderPdf(poNumber);
  const pdfResponse = await fetch(currentPdf.signedUrl);

  if (!pdfResponse.ok) {
    throw new Error(`Could not download the current PDF (${pdfResponse.status}).`);
  }

  const blob = await pdfResponse.blob();
  const fileName = currentPdf.original_filename || currentPdf.file_name || `${poNumber}.pdf`;
  const file = new File([blob], fileName, {
    type: blob.type || currentPdf.mime_type || 'application/pdf',
  });
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(VENDOR_PDF_UPLOAD_WEBHOOK, {
    method: 'POST',
    body: formData,
  });

  const payload = await readWebhookResponse(
    response,
    'Could not reconcile the purchase order after updating QuickBooks.'
  );

  if (payload?.success === false || payload?.status === 'FLOW_ERROR') {
    throw new Error(
      payload?.user_message ||
      payload?.error_message ||
      payload?.message ||
      'The reconciliation workflow failed after updating QuickBooks.'
    );
  }

  return payload;
};

const deleteStorageObjects = async (bucket, paths) => {
  const cleanBucket = String(bucket || '').replace(/^\/+|\/+$/g, '');
  const cleanPaths = [...new Set(paths.map((path) => normalizeStoragePath(cleanBucket, path)).filter(Boolean))];

  if (!cleanBucket || cleanPaths.length === 0) {
    return null;
  }

  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${cleanBucket}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: cleanPaths }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Could not delete PDF files (${response.status}).`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

export const deletePurchaseOrder = async (poNumber) => {
  const filter = encodeURIComponent(String(poNumber));
  const fileRows = await requestSupabase(`purchase_order_files?select=*&po_number=eq.${filter}`);
  const filesByBucket = (fileRows || []).reduce((groups, file) => {
    if (!file.bucket || !file.storage_path) {
      return groups;
    }

    const bucket = String(file.bucket);
    groups[bucket] = groups[bucket] || [];
    groups[bucket].push(file.storage_path);
    return groups;
  }, {});

  for (const [bucket, paths] of Object.entries(filesByBucket)) {
    await deleteStorageObjects(bucket, paths);
  }

  await requestSupabase(`purchase_order_files?po_number=eq.${filter}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  });

  const deletedRows = await requestSupabase(`purchase_orders?po_number=eq.${filter}&select=*`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=representation',
    },
  });

  return Array.isArray(deletedRows) ? deletedRows.map(normalizePurchaseOrderRow) : [];
};

const encodeStoragePath = (path) => (
  String(path)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
);

const normalizeStoragePath = (bucket, path) => {
  const cleanBucket = String(bucket || '').replace(/^\/+|\/+$/g, '');
  let cleanPath = String(path || '').replace(/^\/+/g, '');

  if (cleanBucket && cleanPath.startsWith(`${cleanBucket}/`)) {
    cleanPath = cleanPath.slice(cleanBucket.length + 1);
  }

  return cleanPath;
};

const buildSignedUrl = (signedURL) => {
  if (!signedURL) return '';
  if (signedURL.startsWith('http')) return signedURL;
  if (signedURL.startsWith('/storage/v1/')) return `${SUPABASE_URL}${signedURL}`;
  if (signedURL.startsWith('/object/')) return `${SUPABASE_URL}/storage/v1${signedURL}`;

  return `${SUPABASE_URL}/storage/v1/${signedURL.replace(/^\/+/, '')}`;
};

const signStorageObject = async (bucket, storagePath) => {
  const cleanPath = normalizeStoragePath(bucket, storagePath);
  const encodedPath = encodeStoragePath(cleanPath);
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${encodedPath}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: 3600 }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Could not create signed PDF URL (${response.status}).`);
  }

  const data = await response.json();
  const signedURL = data.signedURL || data.signedUrl;

  if (!signedURL) {
    throw new Error('Supabase did not return a signed PDF URL.');
  }

  return buildSignedUrl(signedURL);
};

const listCurrentPdfFromStorage = async (bucket, poNumber) => {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      limit: 100,
      offset: 0,
      prefix: `${poNumber}/`,
      sortBy: {
        column: 'updated_at',
        order: 'desc',
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Could not list PDF files (${response.status}).`);
  }

  const files = await response.json();
  const pdf = files.find((file) => String(file.name || '').toLowerCase().endsWith('.pdf')) || files[0];

  if (!pdf?.name) {
    throw new Error('No PDF object was found in Supabase Storage for this purchase order.');
  }

  return `${poNumber}/${pdf.name}`;
};

export const fetchCurrentPurchaseOrderPdf = async (poNumber) => {
  const filter = encodeURIComponent(String(poNumber));
  const files = await requestSupabase(
    `purchase_order_files?select=*&po_number=eq.${filter}&is_current=eq.true&order=uploaded_at.desc&limit=1`
  );
  const file = files[0];

  if (!file?.bucket || !file?.storage_path) {
    throw new Error('No current PDF was found for this purchase order.');
  }

  let signedUrl;
  let storagePath = normalizeStoragePath(file.bucket, file.storage_path);
  let signError;

  try {
    signedUrl = await signStorageObject(file.bucket, storagePath);
  } catch (error) {
    signError = error;
    console.warn('Stored PDF path was not found. Falling back to storage list.', error);
    try {
      storagePath = await listCurrentPdfFromStorage(file.bucket, poNumber);
      signedUrl = await signStorageObject(file.bucket, storagePath);
    } catch (listError) {
      throw new Error(
        `Could not open the current PDF. Bucket: ${file.bucket}. Path: ${normalizeStoragePath(file.bucket, file.storage_path)}. ` +
        `Storage error: ${signError?.message || listError.message}`,
        { cause: listError }
      );
    }
  }

  return {
    ...file,
    storage_path: storagePath,
    signedUrl,
  };
};
