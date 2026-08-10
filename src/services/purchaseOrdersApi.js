import { assertSupabaseConfig, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabaseClient.js';
import { isPurchaseOrderReadOnlyUser } from '../auth/permissions.js';
import {
  buildPurchaseOrderAlert,
  getPurchaseOrderAiSuggestionCount,
  getPurchaseOrderIssueCounts,
} from './purchaseOrderAlert.js';

const N8N_WEBHOOK_BASE_URL = (
  import.meta.env.VITE_N8N_WEBHOOK_BASE_URL || 'https://n8n.valtrim.cloud'
).replace(/\/+$/, '');

const getWebhookUrl = (configuredUrl, path) => {
  if (typeof configuredUrl === 'string' && configuredUrl.trim()) {
    return configuredUrl.trim();
  }

  return `${N8N_WEBHOOK_BASE_URL}${path}`;
};

const QB_LINE_UPDATE_WEBHOOK = getWebhookUrl(
  import.meta.env.VITE_QB_LINE_UPDATE_WEBHOOK,
  '/webhook/update-qb-po-line'
);
export const VENDOR_PDF_UPLOAD_WEBHOOK = getWebhookUrl(
  import.meta.env.VITE_VENDOR_PDF_UPLOAD_WEBHOOK,
  '/webhook/upload-pdf-vendor'
);
const VENDOR_ISSUES_EMAIL_WEBHOOK = getWebhookUrl(
  import.meta.env.VITE_VENDOR_ISSUES_EMAIL_WEBHOOK,
  '/webhook/send-vendor-issues-email'
);

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

export const formatDisplayDateTime = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

export const formatWorkflowStatus = (status) => {
  if (!status) return 'Draft';

  const normalized = String(status).toUpperCase();

  if (normalized === 'DRAFT') {
    return 'Draft';
  }

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

const getSupabaseSession = async () => {
  const client = assertSupabaseConfig();
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session || null;
};

const getSupabaseSessionToken = async () => {
  const session = await getSupabaseSession();
  return session?.access_token || null;
};

export const assertCanModifyPurchaseOrders = async () => {
  const session = await getSupabaseSession();

  if (!session?.access_token) {
    throw new Error('Your session has expired. Sign in again before continuing.');
  }

  if (isPurchaseOrderReadOnlyUser(session.user)) {
    const permissionError = new Error('Your account has read-only access to purchase orders.');
    permissionError.name = 'PurchaseOrderPermissionError';
    throw permissionError;
  }

  return session;
};

export const getWebhookAuthHeaders = async ({ hasJsonBody = false } = {}) => {
  const session = await assertCanModifyPurchaseOrders();

  return {
    Authorization: `Bearer ${session.access_token}`,
    ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
  };
};

const getSupabaseHeaders = async ({ hasBody = false, useSession = true } = {}) => {
  const sessionToken = useSession ? await getSupabaseSessionToken() : null;
  const bearerToken = sessionToken || SUPABASE_ANON_KEY;

  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${bearerToken}`,
    Accept: 'application/json',
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
  };
};

const fetchSupabaseStorage = async (url, options = {}, { hasBody = false } = {}) => {
  return fetch(url, {
    ...options,
    headers: {
      ...(await getSupabaseHeaders({ hasBody })),
      ...(options.headers || {}),
    },
  });
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
  const issueCounts = getPurchaseOrderIssueCounts(reconciliation, row);

  return {
    id: row.id ?? row.po_number,
    alert: buildPurchaseOrderAlert(reconciliation, row),
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
    updatedAt: formatDisplayDateTime(row.updated_at),
    updatedAtRaw: row.updated_at ?? '',
    note: row.internal_note ?? '',
    noteUpdatedAt: formatDisplayDateTime(row.note_updated_at),
    noteUpdatedAtRaw: row.note_updated_at ?? '',
    vendorEmailSentAt: formatDisplayDateTime(row.vendor_email_sent_at),
    vendorEmailSentAtRaw: row.vendor_email_sent_at ?? '',
    total: formatCurrency(row.total_pdf ?? row.total_qb),
    issues: String(issueCounts.total),
    issueCounts,
    aiSuggestions: getPurchaseOrderAiSuggestionCount(reconciliation),
    confirmation: formatWorkflowStatus(workflowStatus),
    reconciliation,
    dbRow: row,
  };
};

const requestSupabase = async (path, options = {}) => {
  if (!hasSupabaseConfig) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
  }

  const method = String(options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD'].includes(method)) {
    await assertCanModifyPurchaseOrders();
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    cache: 'no-store',
    ...options,
    headers: {
      ...(await getSupabaseHeaders({ hasBody: Boolean(options.body) })),
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

export const updatePurchaseOrderNote = async (poNumber, note) => {
  const filter = encodeURIComponent(String(poNumber));
  const now = new Date().toISOString();
  const normalizedNote = String(note ?? '').trim();
  const rows = await requestSupabase(`purchase_orders?po_number=eq.${filter}&select=*`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      internal_note: normalizedNote || null,
      note_updated_at: now,
      updated_at: now,
    }),
  });

  if (!rows[0]) {
    throw new Error(`Could not save the note for PO ${poNumber}.`);
  }

  return normalizePurchaseOrderRow(rows[0]);
};

export const updatePurchaseOrderVendorEmailSentAt = async (poNumber, sentAt) => {
  const filter = encodeURIComponent(String(poNumber));
  const normalizedSentAt = new Date(sentAt).toISOString();
  const rows = await requestSupabase(`purchase_orders?po_number=eq.${filter}&select=*`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      vendor_email_sent_at: normalizedSentAt,
      updated_at: normalizedSentAt,
    }),
  });

  if (!rows[0]) {
    throw new Error(`Could not save the vendor email timestamp for PO ${poNumber}.`);
  }

  return normalizePurchaseOrderRow(rows[0]);
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

const isNonBlockingPersistenceWarning = (payload) => (
  payload?.success === false &&
  payload?.status !== 'FLOW_ERROR' &&
  payload?.persistence?.database?.ok === true &&
  payload?.data
);

export const updateQuickBooksPurchaseOrderLine = async ({
  action = 'update',
  poNumber,
  qbLineNumber,
  pdfLineNumber,
  pdfItemId,
  currentQty,
  currentRate,
  nextQty,
  nextRate,
  qbDescription,
  nextDescription,
}) => {
  const response = await fetch(QB_LINE_UPDATE_WEBHOOK, {
    method: 'POST',
    headers: {
      ...(await getWebhookAuthHeaders({ hasJsonBody: true })),
      Accept: 'application/json',
    },
    body: JSON.stringify({
      action,
      po_number: String(poNumber),
      qb_line: qbLineNumber,
      pdf_line: pdfLineNumber,
      pdf_item_id: pdfItemId,
      current_qty: currentQty,
      current_rate: currentRate,
      next_qty: nextQty,
      next_rate: nextRate,
      qb_description: qbDescription,
      next_description: nextDescription,
    }),
  });

  return readWebhookResponse(response, 'Could not save the QuickBooks purchase order line.');
};

export const sendVendorIssuesEmail = async (payload) => {
  const response = await fetch(VENDOR_ISSUES_EMAIL_WEBHOOK, {
    method: 'POST',
    headers: {
      ...(await getWebhookAuthHeaders({ hasJsonBody: true })),
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return readWebhookResponse(response, 'Could not send the selected vendor issues.');
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
  formData.append('force_reconcile', 'true');
  formData.append('forceReconcile', 'true');

  const forcedUploadUrl = new URL(
    VENDOR_PDF_UPLOAD_WEBHOOK,
    globalThis.location?.origin || 'http://localhost'
  );
  forcedUploadUrl.searchParams.set('force_reconcile', 'true');

  const response = await fetch(forcedUploadUrl.toString(), {
    method: 'POST',
    headers: {
      ...(await getWebhookAuthHeaders()),
      Accept: 'application/json',
    },
    body: formData,
  });

  const payload = await readWebhookResponse(
    response,
    'Could not reconcile the purchase order after updating QuickBooks.'
  );

  if (payload?.status === 'PO_ALREADY_EXISTS') {
    throw new Error('The purchase order already exists response was returned instead of running a forced reconciliation.');
  }

  if (payload?.success === false || payload?.status === 'FLOW_ERROR') {
    if (isNonBlockingPersistenceWarning(payload)) {
      return {
        ...payload,
        success: true,
        persistence_warning: payload.persistence?.sheets?.error || 'Reconciliation saved, but Google Sheets was not updated.',
      };
    }

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

  const response = await fetchSupabaseStorage(`${SUPABASE_URL}/storage/v1/object/${cleanBucket}`, {
    method: 'DELETE',
    body: JSON.stringify({ prefixes: cleanPaths }),
  }, { hasBody: true });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Could not delete PDF files (${response.status}).`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

export const deletePurchaseOrder = async (poNumber) => {
  await assertCanModifyPurchaseOrders();
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
  const response = await fetchSupabaseStorage(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${encodedPath}`, {
    method: 'POST',
    body: JSON.stringify({ expiresIn: 3600 }),
  }, { hasBody: true });

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
  const response = await fetchSupabaseStorage(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    body: JSON.stringify({
      limit: 100,
      offset: 0,
      prefix: `${poNumber}/`,
      sortBy: {
        column: 'updated_at',
        order: 'desc',
      },
    }),
  }, { hasBody: true });

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
      const storageError = [
        signError?.message ? `stored path: ${signError.message}` : '',
        listError?.message ? `fallback lookup: ${listError.message}` : '',
      ].filter(Boolean).join(' | ');

      throw new Error(
        `Could not open the current PDF. Bucket: ${file.bucket}. Path: ${normalizeStoragePath(file.bucket, file.storage_path)}. ` +
        `Storage error: ${storageError || 'Unknown storage error'}`,
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
