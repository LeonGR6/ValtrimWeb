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

export default function UploadVendorModal({ onClose, onUploadSuccess }) {
  const [status, setStatus] = useState('idle');
  const [file, setFile] = useState(null);
  const [savedData, setSavedData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const handleProcessFlow = async () => {
    if (!file) return;

    setStatus('processing');
    setErrorMessage('');
    setSavedData(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
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
        setSavedData(payload);
        setErrorMessage(getErrorMessage(payload, 'The workflow failed before saving the purchase order.'));
        setStatus('error');
        return;
      }

      setSavedData(payload);
      setStatus('success');
    } catch (error) {
      console.error('Error uploading PDF:', error);
      setErrorMessage(error.message || 'There was an error processing the PDF. Please try again.');
      setStatus('error');
    }
  };

  const handleFinish = async () => {
    await onUploadSuccess(savedData);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close-btn" onClick={onClose}>&times;</button>

        {status === 'idle' && (
          <div className="modal-step">
            <h3>Upload Vendor PDF</h3>
            <p>Select the procurement or vendor document to process and compare.</p>

            <div className="file-dropzone">
              <input
                type="file"
                accept=".pdf"
                id="pdf-upload"
                onChange={handleFileChange}
              />
              <label htmlFor="pdf-upload">
                {file ? `File selected: ${file.name}` : 'Drag and drop your PDF here, or click to browse'}
              </label>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="btn-primary"
                disabled={!file}
                onClick={handleProcessFlow}
              >
                Process Document
              </button>
            </div>
          </div>
        )}

        {status === 'processing' && (
          <div className="modal-step text-center">
            <div className="spinner"></div>
            <h3>Processing PDF...</h3>
            <p>Saving the PDF and purchase order data.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="modal-step text-center">
            <div className="success-icon">OK</div>
            <h3>Purchase Order Saved</h3>
            <p>The PDF and purchase order data were saved successfully.</p>

            <div className="modal-actions centered">
              <button className="btn-primary" onClick={handleFinish}>
                View in Comparison Table
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="modal-step text-center">
            <div className="error-icon">!</div>
            <h3>Error Processing PDF</h3>
            <p>{errorMessage || 'An error occurred while processing the PDF. Please try again.'}</p>

            <div className="modal-actions centered">
              <button className="btn-secondary" onClick={onClose}>Close</button>
              <button className="btn-primary" onClick={handleProcessFlow}>
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
