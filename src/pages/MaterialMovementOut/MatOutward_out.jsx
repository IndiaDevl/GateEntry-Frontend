// src/pages/WeightBridge/MaterialOutwardTareCapture.jsx
import React, { useState, useEffect } from 'react';
import { 
  updateMaterialInward, // We'll create this to UPDATE existing record
  fetchMaterialOutwardByGateNumber, // Fetch existing weight record
  createGoodsIssue,
  updateOutboundDelivery,
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
    Indicators: 'O', // OUTWARD indicator
    GateEntryNumber: '',
    GateFiscalYear: new Date().getFullYear().toString(),
    GateIndicators: 'O',
    
    // SD Fields (instead of PO)
    SalesDocument: '',
    Customer: '',
    CustomerName: '',
    Material: '',
    MaterialDescription: '',
    
    TruckNumber: '',
    TruckCapacity: '',
    TareWeight: '', // User will enter this
    GrossWeight: '', // From original outward record
    NetWeight: '', // Calculated
    DifferenceBT: '',
    
    ToleranceWeight: '',
    ActuallyWeight: '',
    
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

export default function MaterialOutwardTareCapture() {
  const [form, setForm] = useState(createInitialState());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [recordFound, setRecordFound] = useState(false);


  const validate = () => {
    const errs = [];
    if (!form.GateEntryNumber) errs.push('Gate Entry Number is required');
    if (!form.WeightDocNumber) errs.push('Weight Document Number not found');
    // Only require Tare Weight once record has been loaded
    if (recordFound && !form.TareWeight) errs.push('Tare Weight is required');
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
        setLoading(false);
      }, 2000);
    } catch (err) {
      console.error('Update weight err', err?.response?.data || err.message);
      const msg = err?.response?.data?.error?.message?.value || err?.response?.data?.error || err.message || 'Unknown error';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => {
      const updated = { ...prev, [name]: type === 'checkbox' ? checked : value };

      // Always recalculate Net Weight if either GrossWeight or TareWeight changes
      if (name === 'TareWeight' || name === 'GrossWeight') {
        const gross = parseFloat(name === 'GrossWeight' ? value : updated.GrossWeight) || 0;
        const tare = parseFloat(name === 'TareWeight' ? value : updated.TareWeight) || 0;
        updated.NetWeight = (gross - tare).toFixed(3);
      }

      return updated;
    });
  };
  // When Gate Entry Number changes, fetch existing Material Outward record
  const handleGateEntryChange = async (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setRecordFound(false);
    
    if (name === 'GateEntryNumber' && value && value.trim().length >= 5) {
      setLoading(true);
      setError(null);
      try {
        // Fetch outward records (Indicators='O')
        const resp = await fetchMaterialOutwardByGateNumber(value.trim());
        console.log('[DBG] Material Outward response:', resp?.data);
        
        const entries = resp?.data?.d?.results || resp?.data?.value || [];
        if (!Array.isArray(entries) || entries.length === 0) {
          setError('No Material Outward record found for this Gate Entry Number. Please complete Material Outward first.');
          setLoading(false);
          return;
        }
        
        // Filter for Outward (Indicators = 'O')
        const outwardRecords = entries.filter(e => e.Indicators === 'O');
        
        if (outwardRecords.length === 0) {
          setError('No Outward records found for this Gate Entry Number.');
          setLoading(false);
          return;
        }
        
        // Get the first matching entry
        const outwardRecord = outwardRecords[0];
        console.log('Fetched outwardRecord:', outwardRecord);

        const parsedDate = parseSapDateToISODateOnly(
          outwardRecord.GateEntryDate || outwardRecord.GateOutDate || outwardRecord.GateDate
        );

        // Populate form with existing Material Outward data
        setForm(prev => ({
          ...prev,
          SAP_UUID: outwardRecord.SAP_UUID || outwardRecord.UUID,
          WeightDocNumber: outwardRecord.WeightDocNumber || '',
          GateEntryNumber: value.trim(),
          GateEntryDate: parsedDate || prev.GateEntryDate,
          TruckNumber: outwardRecord.TruckNumber || '',
          GateFiscalYear: outwardRecord.FiscalYear || outwardRecord.GateFiscalYear || prev.GateFiscalYear,
          FiscalYear: outwardRecord.FiscalYear || prev.FiscalYear,

          // Gross Weight from the original record (READ-ONLY)
          GrossWeight: outwardRecord.GrossWeight || '',
          TruckCapacity: outwardRecord.TruckCapacity || '',
          
          // Keep Tare Weight empty for user to enter
          TareWeight: outwardRecord.TareWeight || '',
          NetWeight: '',
          

          // SD Details
          SalesDocument: outwardRecord.SalesDocument || '',
          Customer: outwardRecord.Customer || '',
          CustomerName: outwardRecord.CustomerName || '',
          Material: outwardRecord.Material || '',
          MaterialDescription: outwardRecord.MaterialDescription || '',

          ToleranceWeight: outwardRecord.ToleranceWeight || '',
          ActuallyWeight: outwardRecord.ActuallyWeight || '',
          OutboundDelivery: outwardRecord.OutboundDelivery,
        }));

        setRecordFound(true);
        console.log('[DBG] Material Outward record loaded successfully');
      } catch (err) {
        console.error('Failed to fetch material outward:', err);
        setError('Could not fetch Material Outward details');
      } finally {
        setLoading(false);
      }
    }
  };
  
  // const handleGoodsIssue = async () => {
  //   setError(null);
  //   setResult(null);
  //   setLoading(true);
  //   try {
  //     // Use OutboundDelivery from form state
  //     const deliveryDoc = form.OutboundDelivery;
  //     console.log('Outbound Delivery:', form.OutboundDelivery);
  //     if (!deliveryDoc) {
  //       setError('No Outbound Delivery number found.');
  //       setLoading(false);
  //       return;
  //     }
  //     const response = await createGoodsIssue({
  //       DeliveryDocument: deliveryDoc
  //       // Add more fields if needed
  //     });
  //     setResult('Goods Issue created successfully!');
  //   } catch (err) {
  //     setError(
  //       err?.response?.data?.error?.message?.value ||
  //       err?.response?.data?.error ||
  //       err.message ||
  //       'Failed to create Goods Issue'
  //     );
  //   } finally {
  //     setLoading(false);
  //   }
  // };

const handleGoodsIssue = async () => {
  setError(null);
  setResult(null);
  setLoading(true);
  try {
    // Use OutboundDelivery from form state
    const deliveryDoc = form.OutboundDelivery;
    const netWeight = form.NetWeight;
    const itemNumber = "10"; // Replace with actual item number if available

    if (!deliveryDoc) {
      setError('No Outbound Delivery number found.');
      setLoading(false);
      return;
    }
    if (!netWeight) {
      setError('Net Weight is required to update Outbound Delivery.');
      setLoading(false);
      return;
    }

    // 1. Update Outbound Delivery item with Net Weight
    await updateOutboundDelivery(deliveryDoc, itemNumber, {
      ActualDeliveryQuantity: netWeight,
      // ActualDeliveryQtyUnit: 'EA', // Add unit if required by SAP
    });

    // 2. Create Goods Issue and Billing Document
    await createGoodsIssue({
      DeliveryDocument: deliveryDoc
    });

    setResult('Outbound Delivery updated and Goods Issue + Billing Document created successfully!');
  } catch (err) {
    setError(
      err?.response?.data?.error?.message?.value ||
      err?.response?.data?.error ||
      err.message ||
      'Failed to update Outbound Delivery or create Goods Issue'
    );
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="create-header-container">
      <h2 className="page-title">Material Outward - Tare Weight Capture</h2>
      <p className="page-description">Enter Gate Entry Number to load existing Material Outward record and capture Tare Weight</p>
      
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
                onChange={handleChange}
                className="form-input"
                placeholder="Enter Gross weight"
                required
                disabled={!recordFound}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tare Weight (Loaded)</label>
              <input
                type="text"
                name="TareWeight"
                value={form.TareWeight}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter Tare Weight"
                disabled={!recordFound}
                // Remove readOnly & green background
                style={{
                  backgroundColor: recordFound ? '#ffffff' : '#f0f0f0'
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Net Weight</label>
              <input
                type="text"
                name="NetWeight"
                value={form.NetWeight}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter Net Weight"
                disabled={!recordFound}
                // Remove readOnly & green background
                style={{
                  backgroundColor: recordFound ? '#ffffff' : '#f0f0f0'
                }}
              />
            </div>

            {/* <div className="form-group">
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
            </div> */}
          </div>
        </section>

        {recordFound && (
          <section className="form-section">
            <h3 className="section-title">Sales Document Details (Read-Only)</h3>
            <div className="sd-entry-card" style={{ opacity: 0.7 }}>
              <div className="grid-4-cols">
                <div className="form-group">
                  <label className="form-label">Sales Document</label>
                  <input
                    className="form-input"
                    name="SalesDocument"
                    value={form.SalesDocument}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Customer</label>
                  <input
                    className="form-input"
                    name="Customer"
                    value={form.Customer}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <input
                    className="form-input"
                    name="CustomerName"
                    value={form.CustomerName}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Material</label>
                  <input
                    className="form-input"
                    name="Material"
                    value={form.Material}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Material Description</label>
                  <input
                    className="form-input"
                    name="MaterialDescription"
                    value={form.MaterialDescription}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>
              </div>
            </div>
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

      {recordFound && (
        <div className="form-actions" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-success"
            onClick={handleGoodsIssue}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Create Goods Issue'}
          </button>
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {typeof error === 'object' ? JSON.stringify(error) : error}
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
