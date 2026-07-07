import { useEffect, useRef, useState } from 'react';

import {
  fetchPurchaseOrderByPoNumber,
  getWebhookAuthHeaders,
  VENDOR_PDF_UPLOAD_WEBHOOK,
} from '../../../../services/purchaseOrdersApi';
import {
  buildRecoveredUploadPayload,
  findPoNumber,
  getPoNumberCandidatesFromFileName,
  resolveUploadPayload,
  wasPurchaseOrderRecentlyUpdated,
} from '../utils/uploadVendorResponse';
import {
  formatFileSize,
  getFailedUploadIds,
  getFileIdentity,
  mergeSelectedPdfFiles,
} from '../utils/selectedUploadFiles';
import '../../../../styles/uploadModal.css';

const RECOVERY_LOOKUP_ATTEMPTS = 3;
const RECOVERY_LOOKUP_DELAY_MS = 800;

const wait = (delayMs) => new Promise((resolve) => {
  window.setTimeout(resolve, delayMs);
});

const parseResponseTextJson = (responseText) => {
  try {
    return { ok: true, value: JSON.parse(responseText) };
  } catch {
    return { ok: false, value: null };
  }
};

const createUploadResponseError = (response, responseText) => {
  const message = response.ok
    ? 'n8n did not return a valid JSON response.'
    : `Upload response failed (${response.status}). ${responseText || response.statusText}`;
  const error = new Error(message);

  error.isUploadResponseError = true;
  error.responseStatus = response.status;
  error.responseText = responseText;

  return error;
};

const readResponsePayload = async (response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (error) {
      const uploadError = createUploadResponseError(response, 'Invalid JSON response.');
      uploadError.cause = error;
      throw uploadError;
    }
  }

  const responseText = await response.text();
  const parsedResponse = parseResponseTextJson(responseText);

  if (parsedResponse.ok) {
    return parsedResponse.value;
  }

  throw createUploadResponseError(response, responseText);
};

const isRecoverableUploadError = (error) => {
  const responseStatus = Number(error?.responseStatus);
  const errorText = `${error?.message || ''} ${error?.responseText || ''}`;

  return (
    (Number.isFinite(responseStatus) && responseStatus >= 500) ||
    /ROUTER_EXTERNAL_TARGET_ERROR|Failed to fetch|NetworkError|Load failed/i.test(errorText)
  );
};

const recoverPersistedUpload = async (file, startedAt, originalError) => {
  if (!isRecoverableUploadError(originalError)) return null;

  const candidates = getPoNumberCandidatesFromFileName(file?.name);

  if (candidates.length === 0) return null;

  for (let attempt = 0; attempt < RECOVERY_LOOKUP_ATTEMPTS; attempt += 1) {
    for (const candidate of candidates) {
      try {
        const purchaseOrder = await fetchPurchaseOrderByPoNumber(candidate);

        if (purchaseOrder && wasPurchaseOrderRecentlyUpdated(purchaseOrder, startedAt)) {
          return buildRecoveredUploadPayload(purchaseOrder, originalError);
        }
      } catch (lookupError) {
        console.warn(`Could not verify recovered PO ${candidate}.`, lookupError);
      }
    }

    if (attempt < RECOVERY_LOOKUP_ATTEMPTS - 1) {
      await wait(RECOVERY_LOOKUP_DELAY_MS);
    }
  }

  return null;
};

const createUploadResults = (selectedFiles) => (
  selectedFiles.map((selectedFile) => ({
    fileSize: formatFileSize(selectedFile.size),
    id: getFileIdentity(selectedFile),
    fileName: selectedFile.name,
    status: 'queued',
  }))
);

const getResultLabel = (result) => {
  if (result.status === 'success' && result.warning) return 'Warning';
  if (result.status === 'success') return 'OK';
  if (result.status === 'skipped') return 'Kept';
  if (result.status === 'waiting') return 'Decision';
  if (result.status === 'error') return 'Error';
  if (result.status === 'processing') return 'Processing';
  if (result.status === 'canceled') return 'Canceled';

  return 'Queued';
};

const isExistingPoDecisionPayload = (payload) => (
  payload?.status === 'PO_ALREADY_EXISTS' ||
  (payload?.needs_user_decision === true && Boolean(findPoNumber(payload)))
);

const getResultMessage = (result) => {
  if (result.status === 'success') {
    const poNumber = findPoNumber(result.payload);
    return poNumber ? `PO ${poNumber}` : 'Saved successfully';
  }

  if (result.status === 'skipped') {
    const poNumber = findPoNumber(result.payload);
    return poNumber ? `PO ${poNumber} kept unchanged` : 'Existing record kept unchanged';
  }

  if (result.status === 'waiting') {
    return 'Waiting for your decision.';
  }

  if (result.status === 'error') {
    return result.error || 'Could not process this PDF.';
  }

  if (result.status === 'canceled') {
    return 'This PDF was not completed.';
  }

  return '';
};

export default function UploadVendorModal({ onClose, onUploadSuccess }) {
  const [status, setStatus] = useState('idle');
  const [files, setFiles] = useState([]);
  const [savedData, setSavedData] = useState(null);
  const [results, setResults] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [duplicateDecision, setDuplicateDecision] = useState(null);
  const activeUploadController = useRef(null);
  const cancelRequested = useRef(false);
  const duplicateDecisionResolver = useRef(null);

  useEffect(() => () => {
    cancelRequested.current = true;
    activeUploadController.current?.abort();
    duplicateDecisionResolver.current?.('cancel');
    duplicateDecisionResolver.current = null;
  }, []);

  const setSelectedFiles = (nextFiles) => {
    const selection = mergeSelectedPdfFiles(files, nextFiles);
    const messages = [];

    if (selection.rejectedCount > 0) {
      messages.push('Only PDF files can be uploaded.');
    }

    if (selection.duplicateCount > 0) {
      messages.push(
        `${selection.duplicateCount} duplicate PDF${selection.duplicateCount === 1 ? ' was' : 's were'} already selected.`
      );
    }

    if (selection.oversizedFiles.length > 0) {
      const names = selection.oversizedFiles.map((file) => file.name).join(', ');
      messages.push(
        `${selection.oversizedFiles.length} PDF${selection.oversizedFiles.length === 1 ? '' : 's'} exceeded the 10 MB limit and ${selection.oversizedFiles.length === 1 ? 'was' : 'were'} not added: ${names}.`
      );
    }

    setFiles(selection.files);
    setResults(createUploadResults(selection.files));
    setSavedData(null);
    setErrorMessage(messages.join(' '));
    setDuplicateDecision(null);
  };

  const handleRemoveFile = (fileId) => {
    setFiles((currentFiles) => currentFiles.filter((file) => getFileIdentity(file) !== fileId));
    setResults((currentResults) => currentResults.filter((result) => result.id !== fileId));
    setSavedData(null);
  };

  const handleFileChange = (event) => {
    setSelectedFiles(event.target.files);
    event.target.value = '';
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (status === 'idle') {
      setIsDragging(true);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';

    if (status === 'idle') {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const nextTarget = event.relatedTarget;

    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (status !== 'idle') return;

    setSelectedFiles(event.dataTransfer.files);
  };

  const processSingleFile = async (file, signal, { forceReconcile = false } = {}) => {
    const formData = new FormData();
    const startedAt = Date.now();
    formData.append('file', file);

    if (forceReconcile) {
      formData.append('force_reconcile', 'true');
    }

    try {
      const response = await fetch(VENDOR_PDF_UPLOAD_WEBHOOK, {
        method: 'POST',
        headers: {
          ...(await getWebhookAuthHeaders()),
          Accept: 'application/json',
        },
        body: formData,
        signal,
      });

      const responseData = await readResponsePayload(response);
      return resolveUploadPayload(responseData, response.ok);
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw error;
      }

      const recoveredPayload = await recoverPersistedUpload(file, startedAt, error);

      if (recoveredPayload) {
        return recoveredPayload;
      }

      throw error;
    }
  };

  const requestExistingPoDecision = (decisionContext) => new Promise((resolve) => {
    duplicateDecisionResolver.current = resolve;
    setDuplicateDecision(decisionContext);
    setStatus('duplicateDecision');
  });

  const handleDuplicateDecision = (decision) => {
    const resolve = duplicateDecisionResolver.current;

    duplicateDecisionResolver.current = null;
    setDuplicateDecision(null);
    resolve?.(decision);
  };

  const handleProcessFlow = async ({ retryFailedOnly = false } = {}) => {
    if (files.length === 0) return;

    const failedIds = new Set(getFailedUploadIds(results));
    const uploadIds = retryFailedOnly
      ? files.map(getFileIdentity).filter((id) => failedIds.has(id))
      : files.map(getFileIdentity);

    if (uploadIds.length === 0) return;

    setStatus('processing');
    setErrorMessage('');
    setSavedData(null);
    setIsCanceling(false);
    setDuplicateDecision(null);
    cancelRequested.current = false;

    const existingResults = retryFailedOnly ? results : createUploadResults(files);
    const batchResults = existingResults.map((result) => (
      uploadIds.includes(result.id)
        ? { ...result, error: '', status: 'queued', warning: '' }
        : result
    ));
    setResults([...batchResults]);

    for (const fileId of uploadIds) {
      if (cancelRequested.current) break;

      const index = batchResults.findIndex((result) => result.id === fileId);
      const file = files.find((candidate) => getFileIdentity(candidate) === fileId);
      if (index === -1 || !file) continue;

      batchResults[index] = {
        ...batchResults[index],
        status: 'processing',
      };
      setResults([...batchResults]);

      const controller = new AbortController();
      activeUploadController.current = controller;

      try {
        let payload = await processSingleFile(file, controller.signal);

        if (isExistingPoDecisionPayload(payload)) {
          batchResults[index] = {
            ...batchResults[index],
            status: 'waiting',
            payload,
          };
          setResults([...batchResults]);

          const decision = await requestExistingPoDecision({
            fileName: file.name,
            fileSize: formatFileSize(file.size),
            payload,
          });

          if (decision === 'cancel') {
            cancelRequested.current = true;
            batchResults[index] = {
              ...batchResults[index],
              status: 'canceled',
            };
            setResults([...batchResults]);
            break;
          }

          if (decision === 'keep') {
            setStatus('processing');
            batchResults[index] = {
              ...batchResults[index],
              status: 'skipped',
              payload,
            };
            setResults([...batchResults]);
            continue;
          }

          setStatus('processing');
          batchResults[index] = {
            ...batchResults[index],
            status: 'processing',
            warning: '',
          };
          setResults([...batchResults]);
          payload = await processSingleFile(file, controller.signal, { forceReconcile: true });
        }

        batchResults[index] = {
          ...batchResults[index],
          status: 'success',
          payload,
          warning: payload.persistence_warning || '',
        };
      } catch (error) {
        if (error.name === 'AbortError' || cancelRequested.current) {
          batchResults[index] = {
            ...batchResults[index],
            status: 'canceled',
          };
        } else {
          console.error('Error uploading PDF:', error);
          batchResults[index] = {
            ...batchResults[index],
            status: 'error',
            error: error.message || 'There was an error processing the PDF. Please try again.',
          };
        }
      } finally {
        activeUploadController.current = null;
      }

      setResults([...batchResults]);
      if (cancelRequested.current) break;
    }

    if (cancelRequested.current) {
      uploadIds.forEach((fileId) => {
        const index = batchResults.findIndex((result) => result.id === fileId);
        if (index !== -1 && batchResults[index].status === 'queued') {
          batchResults[index] = { ...batchResults[index], status: 'canceled' };
        }
      });
      setResults([...batchResults]);
    }

    const successfulResults = batchResults.filter((result) => result.status === 'success');
    const skippedResults = batchResults.filter((result) => result.status === 'skipped');

    if (cancelRequested.current) {
      setErrorMessage('Processing was canceled. PDFs that had not started were not sent.');
    } else if (successfulResults.length === 0 && skippedResults.length === 0) {
      setErrorMessage('No PDF was processed successfully.');
    }

    setSavedData(
      files.length === 1
        ? successfulResults[0]?.payload || skippedResults[0]?.payload || batchResults[0]
        : { isBatch: true, results: batchResults }
    );
    setIsCanceling(false);
    setStatus('complete');
  };

  const handleCancelProcessing = () => {
    cancelRequested.current = true;
    setIsCanceling(true);
    activeUploadController.current?.abort();
  };

  const handleRetryFailed = () => {
    handleProcessFlow({ retryFailedOnly: true });
  };

  const handleFinish = async () => {
    await onUploadSuccess?.(savedData);
    onClose();
  };

  const successfulCount = results.filter((result) => result.status === 'success').length;
  const failedCount = results.filter((result) => result.status === 'error').length;
  const canceledCount = results.filter((result) => result.status === 'canceled').length;
  const skippedCount = results.filter((result) => result.status === 'skipped').length;
  const warningCount = results.filter((result) => result.status === 'success' && result.warning).length;
  const processedCount = successfulCount + failedCount + canceledCount + skippedCount;
  const hasSelectedFiles = files.length > 0;
  const isSingleSuccessfulUpload = files.length === 1 && successfulCount === 1;
  const duplicatePoNumber = findPoNumber(duplicateDecision?.payload);
  const duplicateExisting = duplicateDecision?.payload?.existing || {};

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button
          className="modal-close-btn"
          disabled={status === 'processing' || status === 'duplicateDecision'}
          onClick={onClose}
        >
          &times;
        </button>

        {status === 'idle' && (
          <div className="modal-step">
            <h3>Upload Vendor PDFs</h3>
            <p>Select one or more procurement or vendor documents to process and compare.</p>

            {errorMessage && (
              <div className="upload-error-message" role="alert">
                {errorMessage}
              </div>
            )}

            <div
              className={`file-dropzone${isDragging ? ' is-dragging' : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                id="pdf-upload"
                onChange={handleFileChange}
              />
              <label htmlFor="pdf-upload">
                {hasSelectedFiles
                  ? `${files.length} PDF${files.length === 1 ? '' : 's'} selected`
                  : 'Drag and drop your PDFs here, or click to browse'}
              </label>
            </div>

            {hasSelectedFiles && (
              <div className="selected-file-list" aria-label="Selected PDFs">
                {files.map((selectedFile) => {
                  const fileId = getFileIdentity(selectedFile);
                  return (
                    <div className="selected-file-item" key={fileId}>
                      <div className="selected-file-info">
                        <span>{selectedFile.name}</span>
                        <small>{formatFileSize(selectedFile.size)}</small>
                      </div>
                      <button
                        className="selected-file-remove"
                        type="button"
                        aria-label={`Remove ${selectedFile.name}`}
                        onClick={() => handleRemoveFile(fileId)}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="btn-primary"
                disabled={!hasSelectedFiles}
                onClick={handleProcessFlow}
              >
                Process {files.length > 1 ? 'Documents' : 'Document'}
              </button>
            </div>
          </div>
        )}

        {status === 'duplicateDecision' && duplicateDecision && (
          <div className="modal-step">
            <div className="warning-icon duplicate-decision-icon">!</div>
            <h3>PO Already Exists</h3>
            <p>
              {duplicateDecision.fileName} matches PO {duplicatePoNumber || 'already saved'}.
              Choose whether to keep the current record or reconcile the PDF again.
            </p>

            <div className="duplicate-decision-card">
              <div>
                <span>PO Number</span>
                <strong>{duplicatePoNumber || duplicateExisting.po_number || 'Existing PO'}</strong>
              </div>
              {duplicateExisting.supplier && (
                <div>
                  <span>Vendor</span>
                  <strong>{duplicateExisting.supplier}</strong>
                </div>
              )}
              {duplicateExisting.job && (
                <div>
                  <span>Job</span>
                  <strong>{duplicateExisting.job}</strong>
                </div>
              )}
              {duplicateExisting.workflow_status && (
                <div>
                  <span>Status</span>
                  <strong>{duplicateExisting.workflow_status}</strong>
                </div>
              )}
            </div>

            <div className="modal-actions duplicate-decision-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => handleDuplicateDecision('cancel')}
              >
                Cancel batch
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => handleDuplicateDecision('keep')}
              >
                Keep existing
              </button>
              <button
                className="btn-primary"
                type="button"
                onClick={() => handleDuplicateDecision('reconcile')}
              >
                Reconcile again
              </button>
            </div>
          </div>
        )}

        {status === 'processing' && (
          <div className="modal-step text-center">
            <div className="spinner"></div>
            <h3>Processing PDFs...</h3>
            <p>
              {processedCount + 1 <= files.length
                ? `Processing ${processedCount + 1} of ${files.length}.`
                : 'Finishing the batch.'}
            </p>

            <div className="batch-results" aria-live="polite">
              {results.map((result) => (
                <div className={`batch-result-row batch-result-row--${result.status}`} key={result.id}>
                  <div>
                    <span className="batch-result-file">{result.fileName}</span>
                    <span className="batch-result-size">{result.fileSize}</span>
                  </div>
                  <span className="batch-result-status">{getResultLabel(result)}</span>
                </div>
              ))}
            </div>
            <div className="modal-actions centered">
              <button
                className="btn-secondary btn-cancel-upload"
                type="button"
                disabled={isCanceling}
                onClick={handleCancelProcessing}
              >
                {isCanceling ? 'Canceling...' : 'Cancel pending uploads'}
              </button>
            </div>
          </div>
        )}

        {status === 'complete' && (
          <div className="modal-step text-center">
            <div className={failedCount > 0 || warningCount > 0 || skippedCount > 0 ? 'warning-icon' : 'success-icon'}>
              {failedCount > 0 || warningCount > 0 || skippedCount > 0 ? '!' : 'OK'}
            </div>
            <h3>
              {files.length > 1
                ? 'Batch Complete'
                : successfulCount
                  ? 'Purchase Order Saved'
                  : skippedCount
                    ? 'Existing PO Kept'
                    : 'PDF Not Saved'}
            </h3>
            <p>
              {successfulCount} successful, {failedCount} failed.
              {skippedCount > 0 ? ` ${skippedCount} kept unchanged.` : ''}
              {canceledCount > 0 ? ` ${canceledCount} canceled.` : ''}
              {warningCount > 0 ? ` ${warningCount} saved with a warning.` : ''}
              {errorMessage ? ` ${errorMessage}` : ''}
            </p>

            <div className="batch-results batch-results--complete">
              {results.map((result) => (
                <div
                  className={`batch-result-row batch-result-row--${result.warning ? 'warning' : result.status}`}
                  key={result.id}
                >
                  <div>
                    <span className="batch-result-file">{result.fileName}</span>
                    <span className="batch-result-size">{result.fileSize}</span>
                    {getResultMessage(result) && (
                      <span className="batch-result-message">{getResultMessage(result)}</span>
                    )}
                    {result.warning && (
                      <span className="batch-result-warning" role="status">{result.warning}</span>
                    )}
                  </div>
                  <span className="batch-result-status">{getResultLabel(result)}</span>
                </div>
              ))}
            </div>

            <div className="modal-actions centered">
              {failedCount > 0 && (
                <button className="btn-secondary" type="button" onClick={handleRetryFailed}>
                  Retry failed ({failedCount})
                </button>
              )}
              {successfulCount === 0 && (
                <button className="btn-secondary" onClick={onClose}>Close</button>
              )}
              {successfulCount > 0 && (
                <button className="btn-primary" onClick={handleFinish}>
                  {isSingleSuccessfulUpload ? 'Open PO Detail' : 'Refresh Table'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
