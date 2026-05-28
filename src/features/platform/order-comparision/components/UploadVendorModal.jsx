import { useState } from 'react';

import '../../../../styles/uploadModal.css';

export default function UploadVendorModal({ onClose, onUploadSuccess }) {
  const [status, setStatus] = useState('idle'); 
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleProcessFlow = () => {
    if (!file) return;

    setStatus('processing');

    // Simulation of processing time and AI extraction
    setTimeout(() => {
      setStatus('success');
    }, 3000); // 3 seconds to simulate processing
  };

  const handleFinish = () => {
    // Here you would normally handle the extracted data and update the main table.
    const mockNewOrder = {
      requestNumber: "80000902",
      description: "Vendor Extracted Materials",
      createdAt: new Date().toLocaleDateString(),
      items: 12,
      amount: "$1,850.00",
      supplier: "New Vendor Corp",
      department: "Procurement",
      requester: "Alex Manager",
      status: "DRAFT"
    };
    
    onUploadSuccess(mockNewOrder);
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