import { useState } from 'react';

import '../../../../styles/uploadModal.css';

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

    // 1. Preparamos el archivo en un FormData
    const formData = new FormData();
    formData.append('file', file);

    try {

      const N8N_WEBHOOK_URL = '/webhook-test/upload-pdf-vendor';
      
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        body: formData,

      });

      if (!response.ok) {
        throw new Error('Error al procesar el archivo en n8n');
      }

      // 3. n8n debe retornar el JSON con los datos extraídos
      const dataFromN8n = await response.json();
      console.log("Datos extraídos de n8n:", dataFromN8n);
      
      // Guardamos la respuesta en el estado para usarla al finalizar
      setExtractedData(dataFromN8n);
      setStatus('success');

    } catch (error) {
      console.error("Error subiendo el PDF:", error);
      setStatus('idle');
      alert('Hubo un error al procesar el PDF. Por favor intenta de nuevo.');
    }
  };

  const handleFinish = () => {
    if (!extractedData) return;

    const qb = extractedData?.qbData || {};

const newOrder = {
  // Usamos el PO Number de QB como ID, o un fallback por si no viene
  id: qb.qb_po_number || Date.now().toString(), 
  
  alert: "⚠️", 
  status: "DRAFT",
  
  // Mapeo exacto de las propiedades que espera tu MainTable
  poNumber: qb.qb_po_number || '',
  job: qb.qb_job_name || '',
  phaseLots: qb.qb_phase_lots || '',
  vendor: qb.qb_vendor_name || '',
  requiredDate: qb.qb_required_date || '',
  
  vendorShipDate: extractedData?.pdfData?.vendor_ship_date || "PENDING", 
  
  total: qb.qb_total ? `$${Number(qb.qb_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : "$0.00",
  
  issues: "None", 
  confirmation: "PENDING"
};
    
    
    onUploadSuccess(newOrder);
    onClose(); // Cerramos el modal
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
                {file ? `📄 ${file.name}` : "Drag and drop your PDF here, or click to browse"}
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
            <div className="success-icon">✓</div>
            <h3>Analysis Complete!</h3>
            <p>The vendor data was extracted and validated successfully.</p>
            
            <div className="modal-actions centered">
              <button className="btn-primary" onClick={handleFinish}>
                View in Comparison Table
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}