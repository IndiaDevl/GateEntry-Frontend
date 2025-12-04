// src/pages/WeightBridge/CreateWeight.jsx
import React, { useState, useEffect } from 'react';
import { 
  updateMaterialInward, // We'll create this to UPDATE existing record
  fetchMaterialInwardByGateNumber, // Fetch existing weight record
  fetchGateEntryByNumber
} from '../../api';
import './MaterialOutHome.css';

// Helper: ISO timestamp
const nowIso = (d = new Date()) => d.toISOString();

// initial state factory
const createInitialState = () => {
  const todayDateOnly = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return {
    WeightDocNumber: '', // This will be fetched from existing record
    SAP_UUID: '', // Need this to update the record
    FiscalYear: new Date().getFullYear().toString(),
    Indicators: 'I',
    GateEntryNumber: '',
    GateFiscalYear: new Date().getFullYear().toString(),
    GateIndicators: 'I',
    
    // Initialize ALL PO fields to prevent uncontrolled -> controlled warning
    PurchaseOrderNumber: '',
    PurchaseOrderNumber2: '',
    PurchaseOrderNumber3: '',
    PurchaseOrderNumber4: '',
    PurchaseOrderNumber5: '',
    
    SalesDocument: '',
    
    Material: '',
    Material2: '',
    Material3: '',
    Material4: '',
    Material5: '',
    
    MaterialDescription: '',
    MaterialDescription2: '',
    MaterialDescription3: '',
    MaterialDescription4: '',
    MaterialDescription5: '',
    
    TruckNumber: '',
    TruckCapacity: '',
    TareWeight: '', // User will enter this
    GrossWeight: '', // This will come from the original record
    NetWeight: '', // This will be calculated
    DifferenceBT: '',
    
    VendorInvoiceNumber: '',
    VendorInvoiceNumber2: '',
    VendorInvoiceNumber3: '',
    VendorInvoiceNumber4: '',
    VendorInvoiceNumber5: '',
    
    VendorInvoiceWeight: '',
    VendorInvoiceWeight2: '',
    VendorInvoiceWeight3: '',
    VendorInvoiceWeight4: '',
    VendorInvoiceWeight5: '',
    
    BalanceQty: '',
    BalanceQty2: '',
    BalanceQty3: '',
    BalanceQty4: '',
    BalanceQty5: '',
    
    ToleranceWeight: '',
    ActuallyWeight: '',
    
    Vendor: '',
    Vendor2: '',
    Vendor3: '',
    Vendor4: '',
    Vendor5: '',
    
    VendorName: '',
    VendorName2: '',
    VendorName3: '',
    VendorName4: '',
    VendorName5: '',
    
    GateEntryDate: todayDateOnly,
    GateOutDate: todayDateOnly,
    SAP_CreatedDateTime: nowIso(),
  };
};

const getField = (obj, paths) => {
  for (const path of paths) {
    if (obj && obj[path] !== undefined) return obj[path];
  }
  return '';
};

// Add helper to parse SAP OData v2 dates ("/Date(169...) /") or ISO strings
const parseSapDateToISODateOnly = (val) => {
  if (!val) return '';
  // OData v2 "/Date(167xxx)/" or "/Date(167xxx+0530)/"
  if (typeof val === 'string' && val.startsWith('/Date(')) {
    const m = val.match(/\/Date\(([-\d+]+)(?:[+-]\d+)?\)\//);
    if (m) {
      const millis = parseInt(m[1], 10);
      if (!Number.isNaN(millis)) return new Date(millis).toISOString().slice(0, 10);
    }
    return '';
  }
  // If already ISO-like:
  try {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch (e) { /* ignore */ }
  // Fall back to string slice if looks like "2025-11-04T..."
  if (typeof val === 'string' && val.length >= 10) return val.slice(0, 10);
  return '';
};

export default function MaterialInwardOut() {
  const [form, setForm] = useState(createInitialState());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [recordFound, setRecordFound] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => {
      const updated = { ...prev, [name]: type === 'checkbox' ? checked : value };
      
      // Auto-calculate Net Weight when Tare Weight changes
      if (name === 'TareWeight' && updated.GrossWeight) {
        const gross = parseFloat(updated.GrossWeight) || 0;
        const tare = parseFloat(value) || 0;
        updated.NetWeight = (gross - tare).toFixed(3);
      }
      
      return updated;
    });
  };

  const validate = () => {
    const errs = [];
    if (!form.GateEntryNumber) errs.push('Gate Entry Number is required');
    if (!form.WeightDocNumber) errs.push('Weight Document Number not found');
    if (!form.TareWeight) errs.push('Tare Weight is required');
    return errs;
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setError(null);
    setResult(null);
    const v = validate();
    if (v.length) { setError(v.join(' ')); return; }

    if (!recordFound) {
      setError('Please enter a valid Gate Entry Number to load existing record first');
      return;
    }

    setLoading(true);
    try {
      const payload = { ...form };

      // Convert dates
      if (payload.GateEntryDate && payload.GateEntryDate.length === 10) {
        payload.GateEntryDate = `${payload.GateEntryDate}T00:00:00`;
      }
      if (payload.GateOutDate && payload.GateOutDate.length === 10) {
        payload.GateOutDate = `${payload.GateOutDate}T00:00:00`;
      }

      // Calculate Net Weight
      const gross = parseFloat(payload.GrossWeight) || 0;
      const tare = parseFloat(payload.TareWeight) || 0;
      payload.NetWeight = (gross - tare).toFixed(3);

      payload.SAP_CreatedDateTime = nowIso();

      console.debug('Update Weight payload ->', payload);

      // UPDATE existing record using SAP_UUID
      const response = await updateMaterialInward(payload.SAP_UUID, payload);
      setResult('Tare Weight captured successfully! Net Weight calculated.');
      
      // Reset form after success
      setTimeout(() => {
        setForm(createInitialState());
        setRecordFound(false);
      }, 2000);
    } catch (err) {
      console.error('Update weight err', err?.response?.data || err.message);
      const msg = err?.response?.data?.error?.message?.value || err?.response?.data?.error || err.message || 'Unknown error';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  // When Gate Entry Number changes, fetch existing Material Inward record
  const handleGateEntryChange = async (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setRecordFound(false);
    
    if (name === 'GateEntryNumber' && value && value.trim().length >= 5) {
      setLoading(true);
      setError(null);
      try {
        // Use the imported API function instead of local implementation
        const resp = await fetchMaterialInwardByGateNumber(value.trim());
        console.log('[DBG] Material Inward response:', resp?.data);
        
        const entries = resp?.data?.d?.results || resp?.data?.value || [];
        if (!Array.isArray(entries) || entries.length === 0) {
          setError('No Material Inward record found for this Gate Entry Number. Please complete Material Inward first.');
          setLoading(false);
          return;
        }
        
        // Filter for Inward (Indicators = 'I') on client side
        const inwardRecords = entries.filter(e => e.Indicators === 'I');
        
        if (inwardRecords.length === 0) {
          setError('No Inward records found for this Gate Entry Number.');
          setLoading(false);
          return;
        }
        
        // Get the first matching entry
        const inwardRecord = inwardRecords[0];

        // Check if Tare Weight already exists
        if (inwardRecord.TareWeight && parseFloat(inwardRecord.TareWeight) > 0) {
          setError('Tare Weight already captured for this record!');
          setLoading(false);
          return;
        }

        const parsedDate = parseSapDateToISODateOnly(
          inwardRecord.GateEntryDate || inwardRecord.GateInDate || inwardRecord.GateDate
        );

        // Populate form with existing Material Inward data
        setForm(prev => ({
          ...prev,
          SAP_UUID: inwardRecord.SAP_UUID || inwardRecord.UUID, // Important for update
          WeightDocNumber: inwardRecord.WeightDocNumber || '',
          GateEntryNumber: value.trim(),
          GateEntryDate: parsedDate || prev.GateEntryDate,
          TruckNumber: inwardRecord.TruckNumber || '',
          GateFiscalYear: inwardRecord.FiscalYear || inwardRecord.GateFiscalYear || prev.GateFiscalYear,
          FiscalYear: inwardRecord.FiscalYear || prev.FiscalYear,

          // Gross Weight from the original record (READ-ONLY)
          GrossWeight: inwardRecord.GrossWeight || '',
          TruckCapacity: inwardRecord.TruckCapacity || '',
          
          // Keep Tare Weight empty for user to enter
          TareWeight: '',
          NetWeight: '',

          // PO Details
          PurchaseOrderNumber: inwardRecord.PurchaseOrderNumber || '',
          PurchaseOrderNumber2: inwardRecord.PurchaseOrderNumber2 || '',
          PurchaseOrderNumber3: inwardRecord.PurchaseOrderNumber3 || '',
          PurchaseOrderNumber4: inwardRecord.PurchaseOrderNumber4 || '',
          PurchaseOrderNumber5: inwardRecord.PurchaseOrderNumber5 || '',

          Material: inwardRecord.Material || '',
          Material2: inwardRecord.Material2 || '',
          Material3: inwardRecord.Material3 || '',
          Material4: inwardRecord.Material4 || '',
          Material5: inwardRecord.Material5 || '',

          MaterialDescription: inwardRecord.MaterialDescription || '',
          MaterialDescription2: inwardRecord.MaterialDescription2 || '',
          MaterialDescription3: inwardRecord.MaterialDescription3 || '',
          MaterialDescription4: inwardRecord.MaterialDescription4 || '',
          MaterialDescription5: inwardRecord.MaterialDescription5 || '',

          Vendor: inwardRecord.Vendor || '',
          Vendor2: inwardRecord.Vendor2 || '',
          Vendor3: inwardRecord.Vendor3 || '',
          Vendor4: inwardRecord.Vendor4 || '',
          Vendor5: inwardRecord.Vendor5 || '',

          VendorName: inwardRecord.VendorName || '',
          VendorName2: inwardRecord.VendorName2 || '',
          VendorName3: inwardRecord.VendorName3 || '',
          VendorName4: inwardRecord.VendorName4 || '',
          VendorName5: inwardRecord.VendorName5 || '',

          VendorInvoiceNumber: inwardRecord.VendorInvoiceNumber || '',
          VendorInvoiceNumber2: inwardRecord.VendorInvoiceNumber2 || '',
          VendorInvoiceNumber3: inwardRecord.VendorInvoiceNumber3 || '',
          VendorInvoiceNumber4: inwardRecord.VendorInvoiceNumber4 || '',
          VendorInvoiceNumber5: inwardRecord.VendorInvoiceNumber5 || '',

          VendorInvoiceWeight: inwardRecord.VendorInvoiceWeight || '',
          VendorInvoiceWeight2: inwardRecord.VendorInvoiceWeight2 || '',
          VendorInvoiceWeight3: inwardRecord.VendorInvoiceWeight3 || '',
          VendorInvoiceWeight4: inwardRecord.VendorInvoiceWeight4 || '',
          VendorInvoiceWeight5: inwardRecord.VendorInvoiceWeight5 || '',

          BalanceQty: inwardRecord.BalanceQty || '',
          BalanceQty2: inwardRecord.BalanceQty2 || '',
          BalanceQty3: inwardRecord.BalanceQty3 || '',
          BalanceQty4: inwardRecord.BalanceQty4 || '',
          BalanceQty5: inwardRecord.BalanceQty5 || '',

          ToleranceWeight: inwardRecord.ToleranceWeight || '',
          ActuallyWeight: inwardRecord.ActuallyWeight || '',
        }));

        setRecordFound(true);
        console.log('[DBG] Material Inward record loaded successfully');
      } catch (err) {
        console.error('Failed to fetch material inward:', err);
        setError('Could not fetch Material Inward details');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="create-header-container">
      <h2 className="page-title">Material Inward - Tare Weight Capture</h2>
      <p className="page-description">Enter Gate Entry Number to load existing Material Inward record and capture Tare Weight</p>
      
      <form onSubmit={onSubmit} className="create-form">
        <section className="form-section">
          <h3 className="section-title">Weight Document</h3>
          
          <div className="grid-2-cols">
            <div className="form-group">
              <label className="form-label">Weight Doc Number (Existing)</label>
              <input
                type="text"
                name="WeightDocNumber"
                value={form.WeightDocNumber}
                className="form-input"
                readOnly
                style={{ backgroundColor: '#f0f0f0' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Fiscal Year</label>
              <input
                type="text"
                name="FiscalYear"
                value={form.FiscalYear}
                className="form-input"
                readOnly
                style={{ backgroundColor: '#f0f0f0' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Gate Entry Number *</label>
              <input
                type="text"
                name="GateEntryNumber"
                value={form.GateEntryNumber}
                onChange={handleGateEntryChange}
                className="form-input"
                required
                placeholder="Enter to load existing record"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Gate Entry Date</label>
              <input
                type="date"
                name="GateEntryDate"
                value={form.GateEntryDate}
                className="form-input"
                readOnly
                style={{ backgroundColor: '#f0f0f0' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Truck Number</label>
              <input
                type="text"
                name="TruckNumber"
                value={form.TruckNumber}
                className="form-input"
                readOnly
                style={{ backgroundColor: '#f0f0f0' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Gross Weight (Loaded)</label>
              <input
                type="text"
                name="GrossWeight"
                value={form.GrossWeight}
                className="form-input"
                readOnly
                style={{ backgroundColor: '#e8f5e9' }}
                placeholder="From Material Inward"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tare Weight (Empty) *</label>
              <input
                type="text"
                name="TareWeight"
                value={form.TareWeight}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter tare weight"
                required
                disabled={!recordFound}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Net Weight (Calculated)</label>
              <input
                type="text"
                name="NetWeight"
                value={form.NetWeight}
                className="form-input"
                readOnly
                style={{ backgroundColor: '#fff3e0', fontWeight: 'bold' }}
                placeholder="Auto-calculated"
              />
            </div>
          </div>
        </section>

        {recordFound && (
          <section className="form-section">
            <h3 className="section-title">Purchase Order Details (Read-Only)</h3>
            {Array.from({ length: 5 }).map((_, idx) => {
              const suffix = idx === 0 ? "" : String(idx + 1);
              const hasData = form[`PurchaseOrderNumber${suffix}`] || form[`Material${suffix}`];
              
              if (!hasData && idx > 0) return null; // Hide empty entries after first
              
              return (
                <div key={idx} className="po-entry-card" style={{ opacity: 0.7 }}>
                  <h4 className="po-entry-title">PO Entry {idx + 1}</h4>
                  <div className="grid-4-cols">
                    <div className="form-group">
                      <label className="form-label">PO Number</label>
                      <input
                        className="form-input"
                        name={`PurchaseOrderNumber${suffix}`}
                        value={form[`PurchaseOrderNumber${suffix}`]}
                        readOnly
                        style={{ backgroundColor: '#f0f0f0' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Material</label>
                      <input
                        className="form-input"
                        name={`Material${suffix}`}
                        value={form[`Material${suffix}`]}
                        readOnly
                        style={{ backgroundColor: '#f0f0f0' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Material Description</label>
                      <input
                        className="form-input"
                        name={`MaterialDescription${suffix}`}
                        value={form[`MaterialDescription${suffix}`]}
                        readOnly
                        style={{ backgroundColor: '#f0f0f0' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Vendor</label>
                      <input
                        className="form-input"
                        name={`Vendor${suffix}`}
                        value={form[`Vendor${suffix}`]}
                        readOnly
                        style={{ backgroundColor: '#f0f0f0' }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading || !recordFound}>
            {loading ? 'Updating...' : 'Capture Tare Weight & Calculate'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setForm(createInitialState());
              setRecordFound(false);
            }}
          >
            Reset
          </button>
        </div>
      </form>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="success-message">
          <strong>Success:</strong> {result}
        </div>
      )}
    </div>
  );
}
