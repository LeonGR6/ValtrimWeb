import { useState } from 'react';

import { VENDOR_PDF_UPLOAD_WEBHOOK } from '../../../../services/purchaseOrdersApi';
import '../../../../styles/uploadModal.css';

const getPayload = (responseData) => {
  if (Array.isArray(responseData)) {
    return responseData[0]?.json || responseData[0] || {};
  }

  return responseData?.json || responseData?.data || responseData || {};
};

const getErrorMessage = (payload, fallback) => (
  payload?.user_message ||
  payload?.error_message ||
  payload?.message ||
  fallback
);

const readResponsePayload = async (response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const responseText = await response.text();
  throw new Error(
    response.ok
      ? 'n8n did not return a valid JSON response.'
      : `Upload request failed before reaching n8n (${response.status}). ${responseText || response.statusText}`
  );
};

const createUploadResults = (selectedFiles) => (
  selectedFiles.map((selectedFile, index) => ({
    id: `${index}-${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}`,
    fileName: selectedFile.name,
    status: 'queued',
  }))
);

const getResultLabel = (result) => {
  if (result.status === 'success') return 'OK';
  if (result.status === 'error') return 'Error';
  if (result.status === 'processing') return 'Processing';

  return 'Queued';
};

const getResultMessage = (result) => {
  if (result.status === 'success') {
    const poNumber = result.payload?.po_number || result.payload?.poNumber;
    return poNumber ? `PO ${poNumber}` : 'Saved successfully';
  }

  if (result.status === 'error') {
    return result.error || 'Could not process this PDF.';
  }

  return '';
};

const isPdfFile = (file) => (
  file?.type === 'application/pdf' ||
  String(file?.name || '').toLowerCase().endsWith('.pdf')
);

export default function UploadVendorModal({ onClose, onUploadSuccess }) {
  const [status, setStatus] = useState('idle');
  const [files, setFiles] = useState([]);
  const [savedData, setSavedData] = useState(null);
  const [results, setResults] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const setSelectedFiles = (nextFiles) => {
    const selectedFiles = Array.from(nextFiles || []);
    const pdfFiles = selectedFiles.filter(isPdfFile);

    setFiles(pdfFiles);
    setResults(createUploadResults(pdfFiles));
    setSavedData(null);
    setErrorMessage(
      selectedFiles.length > pdfFiles.length
        ? 'Only PDF files can be uploaded.'
        : ''
    );
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

  const processSingleFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(VENDOR_PDF_UPLOAD_WEBHOOK, {
      method: 'POST',
      body: formData,
    });

    const responseData = await readResponsePayload(response);
    const payload = getPayload(responseData);

    if (!response.ok) {
      throw new Error(getErrorMessage(payload, 'Error processing the PDF in n8n.'));
    }

    if (payload?.success === false || payload?.status === 'FLOW_ERROR') {
      throw new Error(getErrorMessage(payload, 'The workflow failed before saving the purchase order.'));
    }

    return payload;
  };

  const handleProcessFlow = async () => {
    if (files.length === 0) return;

    setStatus('processing');
    setErrorMessage('');
    setSavedData(null);

    const batchResults = createUploadResults(files);
    setResults(batchResults);

    for (let index = 0; index < files.length; index += 1) {
      batchResults[index] = {
        ...batchResults[index],
        status: 'processing',
      };
      setResults([...batchResults]);

      try {
        const payload = await processSingleFile(files[index]);

        batchResults[index] = {
          ...batchResults[index],
          status: 'success',
          payload,
        };
      } catch (error) {
        console.error('Error uploading PDF:', error);

        batchResults[index] = {
          ...batchResults[index],
          status: 'error',
          error: error.message || 'There was an error processing the PDF. Please try again.',
        };
      }

      setResults([...batchResults]);
    }

    const successfulResults = batchResults.filter((result) => result.status === 'success');

    if (successfulResults.length === 0) {
      setErrorMessage('No PDF was processed successfully.');
    }

    setSavedData(
      files.length === 1
        ? successfulResults[0]?.payload || batchResults[0]
        : { isBatch: true, results: batchResults }
    );
    setStatus('complete');
  };

  const handleFinish = async () => {
    await onUploadSuccess?.(savedData);
    onClose();
  };

  const successfulCount = results.filter((result) => result.status === 'success').length;
  const failedCount = results.filter((result) => result.status === 'error').length;
  const processedCount = successfulCount + failedCount;
  const hasSelectedFiles = files.length > 0;
  const isSingleSuccessfulUpload = files.length === 1 && successfulCount === 1;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button
          className="modal-close-btn"
          disabled={status === 'processing'}
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
                accept=".pdf"
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
                {files.map((selectedFile, index) => (
                  <div className="selected-file-item" key={`${index}-${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}`}>
                    {selectedFile.name}
                  </div>
                ))}
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
                  <span className="batch-result-file">{result.fileName}</span>
                  <span className="batch-result-status">{getResultLabel(result)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {status === 'complete' && (
          <div className="modal-step text-center">
            <div className={failedCount > 0 ? 'warning-icon' : 'success-icon'}>
              {failedCount > 0 ? '!' : 'OK'}
            </div>
            <h3>{files.length > 1 ? 'Batch Complete' : successfulCount ? 'Purchase Order Saved' : 'PDF Not Saved'}</h3>
            <p>
              {successfulCount} successful, {failedCount} failed.
              {errorMessage ? ` ${errorMessage}` : ''}
            </p>

            <div className="batch-results batch-results--complete">
              {results.map((result) => (
                <div className={`batch-result-row batch-result-row--${result.status}`} key={result.id}>
                  <div>
                    <span className="batch-result-file">{result.fileName}</span>
                    {getResultMessage(result) && (
                      <span className="batch-result-message">{getResultMessage(result)}</span>
                    )}
                  </div>
                  <span className="batch-result-status">{getResultLabel(result)}</span>
                </div>
              ))}
            </div>

            <div className="modal-actions centered">
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
