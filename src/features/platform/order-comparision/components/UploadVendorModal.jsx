import { useState } from 'react';

import '../../../../styles/uploadModal.css';

const getPayload = (responseData) => {
  if (Array.isArray(responseData)) {
    return responseData[0]?.json || responseData[0] || {};
  }

  return responseData?.qbData || responseData?.json || responseData || {};
};

const formatCurrency = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return '$0.00';
  }

  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const normalizeStatus = (data) => {
  if (data.ai_final_status === 'APPROVED' || data.verified === true) {
    return 'Approved';
  }

  if (data.status === 'MISMATCH') {
    return 'Needs Review';
  }

  if (!data.status) {
    return 'Draft';
  }

  return data.status
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getIssueCount = (data) => {
  // if (data.ai_final_status === 'APPROVED' || data.verified === true) {
  //   return '0';
  // }

  return String(
    data.summary?.discrepancies_count ??
    data.discrepancias?.length ??
    data.ai_differences?.length ??
    0
  );
};

const buildAlert = (data) => {
  if (data.ai_final_status === 'APPROVED' || data.verified === true) {
    return 'OK';
  }

  if (data.status === 'MISMATCH' || Number(getIssueCount(data)) > 0) {
    return 'Review';
  }

  return 'New';
};

const normalizeOrder = (responseData) => {
  const data = getPayload(responseData);
  const poNumber = data.po_number || data.poNumber || '';

  return {
    id: poNumber || `${Date.now()}`,
    alert: buildAlert(data),
    status: normalizeStatus(data),
    poNumber,
    job: data.job || '',
    phaseLots: data.phaseLots || data.phase_lots || '',
    vendor: data.supplier || data.vendor_name || data.vendor || '',
    requiredDate: data.required_date || data.requiredDate || '',
    vendorShipDate: data.ship_date || data.vendorShipDate || 'PENDING',
    total: formatCurrency(data.totalPdf ?? data.totalQb ?? data.total),
    issues: getIssueCount(data),
    confirmation: data.ai_final_status === 'APPROVED' ? 'Approved' : 'Pending',
    reconciliation: data,
  };
};

export default function UploadVendorModal({ onClose, onUploadSuccess }) {
  const [status, setStatus] = useState('idle');
  const [file, setFile] = useState(null);
  const [extractedData, setExtractedData] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleProcessFlow = async () => {
  if (!file) return;

  setStatus('processing');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/webhook-test/upload-pdf-vendor', {
      method: 'POST',
      body: formData,
    });

    let dataFromN8n = null;

    try {
      dataFromN8n = await response.json();
    } catch (jsonError) {
      throw new Error('n8n no regresó una respuesta JSON válida');
    }

    console.log('Respuesta de n8n:', dataFromN8n);

    // Error HTTP real, por ejemplo 500, 404, etc.
    if (!response.ok) {
      const message =
        dataFromN8n?.user_message ||
        dataFromN8n?.error_message ||
        'Error al procesar el archivo en n8n';

      throw new Error(message);
    }

    // Error controlado del workflow
    // Ejemplo: AI Normalize Supplier PDF1 falló
    if (dataFromN8n?.success === false || dataFromN8n?.status === 'FLOW_ERROR') {
      console.error('Error controlado del flujo:', dataFromN8n);

      setExtractedData(dataFromN8n);
      setStatus('error');

      const errorMessage =
        dataFromN8n.user_message ||
        dataFromN8n.error_message ||
        'Falló una etapa del flujo.';

      alert(errorMessage);

      return;
    }

    // Flujo completado correctamente
    setExtractedData(dataFromN8n);

    // Puedes decidir el estado visual según final_status
    if (
      dataFromN8n.final_status === 'MATCH_TOTAL' ||
      dataFromN8n.final_status === 'AI_APPROVED'
    ) {
      setStatus('success');
    } else if (
      dataFromN8n.final_status === 'REVIEW' ||
      dataFromN8n.final_status === 'MISMATCH' ||
      dataFromN8n.final_status === 'REJECTED'
    ) {
      setStatus('review');
    } else {
      setStatus('success');
    }

  } catch (error) {
    console.error('Error subiendo el PDF:', error);

    setStatus('error');

    alert(
      error.message ||
      'Hubo un error al procesar el PDF. Por favor intenta de nuevo.'
    );
  }
};

  const handleFinish = () => {
    if (!extractedData) return;

    onUploadSuccess(normalizeOrder(extractedData));
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
            <p>Extracting vendor data and running match validations with AI.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="modal-step text-center">
            <div className="success-icon">OK</div>
            <h3>Analysis Complete!</h3>
            <p>The vendor data was extracted and validated successfully.</p>

            <div className="modal-actions centered">
              <button className="btn-primary" onClick={handleFinish}>
                View in Comparison Table
              </button>
            </div>
          </div>
        )}

        {status === 'review' && (
          <div className="modal-step text-center">
            <div className="review-icon">!</div>
            <h3>Review Required</h3>
            <p>The document was processed but some discrepancies were found. Please review the extracted data.</p>

            <div className="modal-actions centered">
              <button className="btn-primary" onClick={handleFinish}>
                Review Extracted Data
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="modal-step text-center">
            <div className="error-icon">!</div>
            <h3>Error Processing PDF</h3>
            <p>An error occurred while processing the PDF. Please try again.</p>

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
