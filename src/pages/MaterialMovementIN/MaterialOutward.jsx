import React, { useState, useEffect } from 'react';
import { 
  fetchNextWeightDocNumber,fetchGateEntryByNumber,fetchSalesOrderByNumber,updateMaterialInward,fetchSalesOrderSuggestions,updateobdMaterialOutward
,createOBDandMaterialOutwardCreate} from '../../api';
import './MaterialINHome';

// Helper: ISO timestamp
const nowIso = (d = new Date()) => d.toISOString();

// Detect document type
const detectDocType = (entry) => {
  return entry?.SalesDocument && String(entry.SalesDocument).trim() !== '' ? 'SD' : 'PO';
};

// initial state factory
const createInitialState = () => {
  const todayDateOnly = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return {
    WeightDocNumber: '',
    FiscalYear: new Date().getFullYear().toString(),
    Indicators: 'O',
    GateEntryNumber: '',
    GateFiscalYear: new Date().getFullYear().toString(),
    GateIndicators: 'O',
    OutboundDelivery: '',

    // SD-first minimal outward fields
    SalesDocument: '',
    Customer: '',
    CustomerName: '',
    Material: '',
    MaterialDescription: '',
    BalanceQty: '',

    TruckNumber: '',
    TruckCapacity: '',
    TransporterCode: '',
    LRGCNumber: '',
    PermitNumber: '',
    Remarks: '',
    TareWeight: '',
    GateEntryDate: todayDateOnly,
    GateOutDate: todayDateOnly,
    SAP_CreatedDateTime: nowIso(),

    // UI state
    _docType: 'PO', // PO | SD
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
  if (typeof val === 'string' && val.startsWith('/Date(')) {
    const m = val.match(/\/Date\(([-\d]+)(?:[+-]\d+)?\)\//);
    if (m) {
      const millis = parseInt(m[1], 10);
      if (!Number.isNaN(millis)) return new Date(millis).toISOString().slice(0, 10);
    }
    return '';
  }
  try {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {}
  if (typeof val === 'string' && val.length >= 10) return val.slice(0, 10);
  return '';
};

const fetchGateEntryDetails = async (gateEntryNumber) => {
  const resp = await fetchGateEntryByNumber(gateEntryNumber);
  console.log('[DBG] Gate entry response:', resp?.data);
  const entries = resp?.data?.d?.results || resp?.data?.value || [];
  if (!Array.isArray(entries) || entries.length === 0) return null;
  return entries[0];
};

export default function MaterialOutward() {
  const [form, setForm] = useState(createInitialState());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const validate = () => {
    const errs = [];
    if (!form.GateEntryNumber) errs.push('GateEntryNumber required');
    if (!form.TruckNumber) errs.push('TruckNumber required');
    // for SD outward, no PO fields required
    return errs;
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setError(null);
    setResult(null);

    const v = validate();
    if (v.length) {
      setError(v.join(', '));
      return;
    }

    setLoading(true);
    try {
      let payload = { ...form };
      // Only generate WeightDocNumber on Save
      if (!form.WeightDocNumber) {
        const year = new Date().getFullYear().toString();
        const resp = await fetchNextWeightDocNumber(year, 3); // 3-series (253xxxxxxx)
        const nextNumber = resp?.data?.next || resp?.data?.value || resp?.data || '';
        setForm(prev => ({ ...prev, WeightDocNumber: String(nextNumber || '') }));
        payload.WeightDocNumber = String(nextNumber || '');
      }
      // normalize dates
      if (payload.GateEntryDate?.length === 10) payload.GateEntryDate = `${payload.GateEntryDate}T00:00:00`;
      if (payload.GateOutDate?.length === 10) payload.GateOutDate = `${payload.GateOutDate}T00:00:00`;
      payload.SAP_CreatedDateTime = nowIso();
      // Remove UI-only fields
      delete payload._docType;

      // Split payload for backend
      const outboundDeliveryPayload = {
        ShippingPoint: "1810", // Use your actual shipping point
        to_DeliveryDocumentItem: {
          results: [
            {
              ReferenceSDDocument: form.SalesDocument,
              ReferenceSDDocumentItem: "10", // or the correct item number
              ActualDeliveryQuantity: form.BalanceQty || "1",
              DeliveryQuantityUnit: "TON"
            }
          ]
        }
      };
      const weightDocumentPayload = {
        WeightDocNumber: payload.WeightDocNumber,
        FiscalYear: payload.FiscalYear,
        Indicators: payload.Indicators,
        GateEntryNumber: payload.GateEntryNumber,
        GateFiscalYear: payload.GateFiscalYear,
        GateIndicators: payload.GateIndicators,
        OutboundDelivery: payload.OutboundDelivery,
        TruckNumber: payload.TruckNumber,
        TransporterCode: payload.TransporterCode,
        LRGCNumber: payload.LRGCNumber,
        PermitNumber: payload.PermitNumber,
        Remarks: payload.Remarks,
        TruckCapacity: payload.TruckCapacity,
        TareWeight: payload.TareWeight,
        GateEntryDate: payload.GateEntryDate,
        GateOutDate: payload.GateOutDate,
        SAP_CreatedDateTime: payload.SAP_CreatedDateTime,
        // Add more Weight Document fields if needed
      };
      const apiPayload = {
        outboundDelivery: outboundDeliveryPayload,
        weightDocument: weightDocumentPayload
      };

      // Call the combined API for Outbound Delivery and Material Outward
      const resp = await createOBDandMaterialOutwardCreate(apiPayload);
      // Expect backend to return { success: true, outboundDeliveryNumber, weightDocNumber, gateEntryNumber } or error
      if (resp?.data?.success) {
        const outboundDeliveryNumber = resp.data.outboundDeliveryNumber || '';
        const weightDocNumber = resp.data.weightDocNumber || '';
        const gateEntryNumber = resp.data.gateEntryNumber || '';

        // Update OutboundDelivery and all SD fields in material document (weight doc)
        if (weightDocNumber && outboundDeliveryNumber) {
          await updateobdMaterialOutward(weightDocNumber, {
            OutboundDelivery: outboundDeliveryNumber,
            SalesDocument: form.SalesDocument,
            Customer: form.Customer,
            CustomerName: form.CustomerName,
            Material: form.Material,
            MaterialDescription: form.MaterialDescription,
            BalanceQty: form.BalanceQty
          });
        }

        setResult(`Material Outward and Outbound Delivery created successfully! Weight Document Number: ${weightDocNumber} | Gate Entry Number: ${gateEntryNumber} | Outbound Delivery: ${outboundDeliveryNumber}`);
      } else {
        // Show backend error message
        const msg = resp?.data?.error || 'Failed to create Outbound Delivery and Material Outward.';
        setError(msg);
      }
    } catch (err) {
      console.error('Create Outward error:', err);
      // SAP error extraction
      const msg = err?.response?.data?.error?.message?.value || err?.response?.data?.error || err.message || 'Unknown error';
      setError(msg); // Show in your error box
    } finally {
      setLoading(false);
    }
  };

  // Helper to clear all PO fields in form
  const clearPOFields = (prev) => {
    const cleared = { ...prev };
    for (let i = 0; i < 5; i++) {
      const s = i === 0 ? '' : String(i + 1);
      [
        'PurchaseOrderNumber',
        'Material',
        'MaterialDescription',
        'Vendor',
        'VendorName',
        'VendorInvoiceNumber',
        'VendorInvoiceWeight',
        'BalanceQty'
      ].forEach(f => { cleared[`${f}${s}`] = ''; });
    }
    return cleared;
  };

  // When GateEntryNumber changes, fetch and map
  const handleGateEntryChange = async (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));

    if (name === 'GateEntryNumber' && value && value.trim().length >= 5) {
      setLoading(true);
      setError(null);
      try {
        const entry = await fetchGateEntryDetails(value.trim());
        if (!entry) return;

        const parsedDate = parseSapDateToISODateOnly(
          entry.GateEntryDate || entry.GateInDate || entry.GateDate
        );
        const docType = detectDocType(entry);

        if (docType === 'SD') {
          // SD: clear PO fields and set SD-only fields
          setForm(prev => {
            const cleared = clearPOFields(prev);
            return {
              ...cleared,
              _docType: 'SD',
              GateEntryNumber: value.trim(), // KEEP user input
              GateEntryDate: parsedDate || prev.GateEntryDate,
              TruckNumber: entry.VehicleNumber || entry.TruckNumber || entry.VehicleNo || '',
              TransporterCode: entry.TransporterCode || '',
              LRGCNumber: entry.LRGCNumber || '',
              PermitNumber: entry.PermitNumber || '',
              Remarks: entry.Remarks || '',
              GateFiscalYear: entry.FiscalYear || prev.GateFiscalYear,

              SalesDocument: entry.SalesDocument || '',
              Customer: entry.Customer || '',
              CustomerName: entry.CustomerName || '',
              Material: entry.Material || '',
              MaterialDescription: entry.MaterialDescription || '',
              BalanceQty: entry.BalanceQty || '',
            };
          });
          // REMOVED: Lines 220-227 - Don't auto-generate GateEntryNumber for SD type
        } else {
          // PO: populate PO fields; if you don’t want PO for outward, you can keep section hidden
          setForm(prev => ({
            ...prev,
            _docType: 'PO',
            GateEntryNumber: value.trim(),
            GateEntryDate: parsedDate || prev.GateEntryDate,
            TruckNumber: entry.VehicleNumber || entry.TruckNumber || entry.VehicleNo || '',
            GateFiscalYear: entry.FiscalYear || prev.GateFiscalYear,

            Material: entry.Material || '',


            MaterialDescription: entry.MaterialDescription || '',

            BalanceQty: entry.BalanceQty || '',
            BalanceQty2: entry.BalanceQty2 || '',
            BalanceQty3: entry.BalanceQty3 || '',
            BalanceQty4: entry.BalanceQty4 || '',
            BalanceQty5: entry.BalanceQty5 || '',
          }));
        }
      } catch (err) {
        console.error('Failed to fetch gate entry details:', err);
        setError('Could not fetch gate entry details');
      } finally {
        setLoading(false);
      }
    }
  };

  const isSD = form._docType === 'SD';

  return (
    <div className="create-header-container">
      <h2 className="page-title">Material Movement Outward</h2>

      <form onSubmit={onSubmit} className="create-form">
        <section className="form-section">
          <h3 className="section-title">Header</h3>

          <div className="grid-2-cols">
            <div className="form-group">
              <label className="form-label">Weight Doc Number</label>
              <input type="text" name="WeightDocNumber" value={form.WeightDocNumber} className="form-input" readOnly placeholder="Will be generated on Save" />
            </div>

            <div className="form-group">
              <label className="form-label">FiscalYear</label>
              <input type="text" name="FiscalYear" value={form.FiscalYear} onChange={handleChange} className="form-input" required />
            </div>

            <div className="form-group">
              <label className="form-label">Gate Entry Number</label>
              <input type="text" name="GateEntryNumber" value={form.GateEntryNumber} onChange={handleGateEntryChange} className="form-input" required />
            </div>

            <div className="form-group">
              <label className="form-label">Gate Entry Date</label>
              <input type="date" name="GateEntryDate" value={form.GateEntryDate} onChange={handleChange} className="form-input" required />
            </div>

            <div className="form-group">
              <label className="form-label">Vehicle Number</label>
              <input type="text" name="Vehicle Number" value={form.TruckNumber} onChange={handleChange} className="form-input" />
            </div>

            <div className="form-group">
              <label className="form-label">Transporter</label>
              <input type="text" name="Transporter" value={form.TransporterCode} onChange={handleChange} className="form-input" />
            </div>

            <div className="form-group">
              <label className="form-label">LRGC Number</label>
              <input type="text" name="LRGCNumber" value={form.LRGCNumber} onChange={handleChange} className="form-input" placeholder="LRGC12345"  />
            </div>
            <div className="form-group">
              <label className="form-label">Permit Number</label>
              <input type="text" name="PermitNumber" value={form.PermitNumber} onChange={handleChange} className="form-input" placeholder="PERMIT67890"/>
            </div>

            <div className="form-group">
              <label className="form-label">Remarks</label>
              <input type="text" name="Remarks" value={form.Remarks} onChange={handleChange} className="form-input" placeholder="Remarks here"/>
            </div>

            <div className="form-group">
              <label className="form-label">Truck Capacity</label>
              <input type="text" name="TruckCapacity" value={form.TruckCapacity} onChange={handleChange} className="form-input" placeholder="50.000" required />
            </div>

            <div className="form-group">
              <label className="form-label">Tare Weight</label>
              <input type="text" name="TareWeight" value={form.TareWeight} onChange={handleChange} className="form-input" placeholder="30.000" required />
            </div>
          </div>
        </section>

        {/* SD section (shown when entry has SalesDocument) */}
    
          <section className="form-section">
            <h3 className="section-title">Sales Document Details</h3>
            <div className="grid-4-cols">
              <div className="form-group">
                <label className="form-label">Sales Document</label>
                <input className="form-input" name="SalesDocument" value={form.SalesDocument} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Customer</label>
                <input className="form-input" name="Customer" value={form.Customer} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Customer Name</label>
                <input className="form-input" name="CustomerName" value={form.CustomerName} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Material</label>
                <input className="form-input" name="Material" value={form.Material} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Material Description</label>
                <input className="form-input" name="MaterialDescription" value={form.MaterialDescription} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Balance Quantity</label>
                <input className="form-input" name="BalanceQty" value={form.BalanceQty ?? ''} onChange={handleChange} placeholder="0.000" />
              </div>
            </div>
          </section>
    

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Material Outward'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setForm(createInitialState())}>
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
      {error && (
  <div className="error-message">
    <strong>Error:</strong> {typeof error === 'string' ? error : JSON.stringify(error)}
  </div>
)}
    </div>
  );
}
