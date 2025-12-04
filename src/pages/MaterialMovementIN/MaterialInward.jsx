// src/pages/WeightBridge/CreateWeight.jsx
import React, { useState, useEffect } from 'react';
import { 
  createMaterialInward, 
  fetchNextWeightDocNumber,
  fetchGateEntryByNumber  
} from '../../api';
import './MaterialINHome.css';

// Helper: ISO timestamp
const nowIso = (d = new Date()) => d.toISOString();

// initial state factory
const createInitialState = () => {
  const todayDateOnly = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Get current time in HH:mm:ss format
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  
  return {
    WeightDocNumber: '',
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
    TareWeight: '',
    GrossWeight: '',
    NetWeght: '',
    DifferenceBT: '',
    
    VendorInvoiceNumber: '',
    VendorInvoiceNumber2: '',
    VendorInvoiceNumber3: '',
    VendorInvoiceNumber4: '',
    VendorInvoiceNumber5: '',
    
    VendorInvoiceDate: '',
    VendorInvoiceDate2: '',
    VendorInvoiceDate3: '',
    VendorInvoiceDate4: '',
    VendorInvoiceDate5: '',

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
    
    Customer: '',
    CustomerName: '',
    
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
    
    // Auto-populate with current time
    InwardTime: currentTime,
    OutwardTime: currentTime,
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

const fetchGateEntryDetails = async (gateEntryNumber) => {
  try {
    const resp = await fetchGateEntryByNumber(gateEntryNumber);
    console.log('[DBG] Gate entry response:', resp?.data);
    
    // Handle OData v2 response structure
    const entries = resp?.data?.d?.results || resp?.data?.value || [];
    if (!Array.isArray(entries) || entries.length === 0) {
      console.log('No gate entry found for number:', gateEntryNumber);
      return null;
    }
    
    // Return the first (and should be only) matching entry
    return entries[0];
  } catch (err) {
    console.error('Error fetching gate entry:', err);
    throw err;
  }
};

export default function MaterialInward() {
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
    if (!form.GateEntryNumber) errs.push('GateEntryNumber is required (link gate entry).');
    if (!form.TruckNumber) errs.push('TruckNumber is required.');
    // add more checks as you want
    return errs;
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setError(null);
    setResult(null);
    const v = validate();
    if (v.length) { setError(v.join(' ')); return; }

    setLoading(true);
    try {
      let payload = { ...form };
      // Only generate WeightDocNumber on Save
      if (!form.WeightDocNumber) {
        const year = new Date().getFullYear().toString();
        const resp = await fetchNextWeightDocNumber(year, 4); // code=4 for 251 series (Inward)
        const nextNumber = resp?.data?.next || resp?.data?.value || resp?.data || '';
        setForm(prev => ({ ...prev, WeightDocNumber: String(nextNumber || '') }));
        payload.WeightDocNumber = String(nextNumber || '');
      }

      // Convert date fields to SAP datetime format (YYYY-MM-DDTHH:mm:ss)
      if (payload.GateEntryDate && payload.GateEntryDate.length === 10) {
        payload.GateEntryDate = `${payload.GateEntryDate}T00:00:00`;
      }
      if (payload.GateOutDate && payload.GateOutDate.length === 10) {
        payload.GateOutDate = `${payload.GateOutDate}T00:00:00`;
      }

      // Handle VendorInvoiceDate fields (1 through 5)
      for (let i = 1; i <= 5; i++) {
        const suffix = i === 1 ? '' : String(i);
        const dateField = `VendorInvoiceDate${suffix}`;
        
        if (payload[dateField]) {
          // If it's a date string (YYYY-MM-DD), convert to datetime
          if (payload[dateField].length === 10) {
            payload[dateField] = `${payload[dateField]}T00:00:00`;
          }
        } else {
          // Remove empty date fields
          delete payload[dateField];
        }
      }

      // Remove or set InwardTime and OutwardTime to null if not needed
      delete payload.InwardTime;
      delete payload.OutwardTime;

      payload.SAP_CreatedDateTime = nowIso();

      Object.keys(payload).forEach(key => {
        if (payload[key] === '' || payload[key] === null || payload[key] === undefined) {
          delete payload[key];
        }
      });

      console.debug('Weight payload ->', payload);

      const response = await createMaterialInward(payload);
      setResult({
        message: 'Material Inward created successfully',
        gateNumber: form.GateEntryNumber,
        weightDocNumber: form.WeightDocNumber,
        date: form.GateEntryDate,
        vehicle: form.TruckNumber
      });

      setTimeout(() => {
        setForm(createInitialState());
        setResult(null);
      }, 3000);
    } catch (err) {
      console.error('create weight err', err?.response?.data || err.message);
      const resp = err?.response?.data;
      let msg = err?.message || 'Unknown error';
      if (resp) {
        if (typeof resp.error === 'string') {
          msg = resp.error;
        } else if (resp.error?.message?.value) {
          msg = resp.error.message.value;
        } else if (resp.error?.message && typeof resp.error.message === 'string') {
          msg = resp.error.message;
        } else if (resp.message && typeof resp.message === 'string') {
          msg = resp.message;
        } else if (typeof resp.error === 'object') {  
          msg = JSON.stringify(resp.error);
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };



  // Extract fetch logic to reusable function
  const fetchNextWeightNumber = async () => {
    try {
      const year = new Date().getFullYear().toString();
      const response = await fetchNextWeightDocNumber(year, 4); // code=1 for 251 series (Inward)
      const nextNumber = response?.data?.next || response?.data?.value || response?.data || '';
      
      if (nextNumber) {
        setForm(prev => ({
          ...prev,
          WeightDocNumber: String(nextNumber),
          FiscalYear: year
        }));
        console.log('[INFO] Fetched next WeightDocNumber:', nextNumber);
      } else {
        console.warn('[WARN] No WeightDocNumber returned from API');
        setError('Could not fetch next weight document number');
      }
    } catch (err) {
      console.error('Error fetching next weight doc number:', err);
      setError('Could not fetch next weight document number');
    }
  };

  // Add this new function inside component
  const handleGateEntryChange = async (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    
    if (name === 'GateEntryNumber' && value && value.length >= 5) {
      setLoading(true);
      setError(null);
      try {
        const gateEntry = await fetchGateEntryDetails(value);
        if (!gateEntry) {
          console.log('No gate entry found for:', value);
          setLoading(false);
          return;
        }

        // Convert SAP date to yyyy-MM-dd for <input type="date">
        const parsedDate = parseSapDateToISODateOnly(gateEntry.GateEntryDate || gateEntry.GateInDate || gateEntry.GateDate);

        // Map gate entry fields to form (map nested/alternate properties as available)
        setForm(prev => ({
          ...prev,
          GateEntryDate: parsedDate || prev.GateEntryDate,
          TruckNumber: gateEntry.VehicleNumber || gateEntry.TruckNumber || gateEntry.VehicleNo || '',
          GateFiscalYear: gateEntry.FiscalYear || prev.GateFiscalYear,

          // PO lines (fill suffix 1..5)
          PurchaseOrderNumber: gateEntry.PurchaseOrderNumber || '',
          PurchaseOrderNumber2: gateEntry.PurchaseOrderNumber2 || '',
          PurchaseOrderNumber3: gateEntry.PurchaseOrderNumber3 || '',
          PurchaseOrderNumber4: gateEntry.PurchaseOrderNumber4 || '',
          PurchaseOrderNumber5: gateEntry.PurchaseOrderNumber5 || '',

          Material: gateEntry.Material || '',
          Material2: gateEntry.Material2 || '',
          Material3: gateEntry.Material3 || '',
          Material4: gateEntry.Material4 || '',
          Material5: gateEntry.Material5 || '',

          MaterialDescription: gateEntry.MaterialDescription || '',
          MaterialDescription2: gateEntry.MaterialDescription2 || '',
          MaterialDescription3: gateEntry.MaterialDescription3 || '',
          MaterialDescription4: gateEntry.MaterialDescription4 || '',
          MaterialDescription5: gateEntry.MaterialDescription5 || '',

          Vendor: gateEntry.Vendor || '',
          Vendor2: gateEntry.Vendor2 || '',
          Vendor3: gateEntry.Vendor3 || '',
          Vendor4: gateEntry.Vendor4 || '',
          Vendor5: gateEntry.Vendor5 || '',

          VendorName: gateEntry.VendorName || '',
          VendorName2: gateEntry.VendorName2 || '',
          VendorName3: gateEntry.VendorName3 || '',
          VendorName4: gateEntry.VendorName4 || '',
          VendorName5: gateEntry.VendorName5 || '',

          VendorInvoiceNumber: gateEntry.VendorInvoiceNumber || '',
          VendorInvoiceNumber2: gateEntry.VendorInvoiceNumber2 || '',
          VendorInvoiceNumber3: gateEntry.VendorInvoiceNumber3 || '',
          VendorInvoiceNumber4: gateEntry.VendorInvoiceNumber4 || '',
          VendorInvoiceNumber5: gateEntry.VendorInvoiceNumber5 || '',

          VendorInvoiceDate: parseSapDateToISODateOnly(gateEntry.VendorInvoiceDate) || '',
          VendorInvoiceDate2: parseSapDateToISODateOnly(gateEntry.VendorInvoiceDate2) || '',
          VendorInvoiceDate3: parseSapDateToISODateOnly(gateEntry.VendorInvoiceDate3) || '',
          VendorInvoiceDate4: parseSapDateToISODateOnly(gateEntry.VendorInvoiceDate4) || '',
          VendorInvoiceDate5: parseSapDateToISODateOnly(gateEntry.VendorInvoiceDate5) || '',

          VendorInvoiceWeight: gateEntry.VendorInvoiceWeight || '',
          VendorInvoiceWeight2: gateEntry.VendorInvoiceWeight2 || '',
          VendorInvoiceWeight3: gateEntry.VendorInvoiceWeight3 || '',
          VendorInvoiceWeight4: gateEntry.VendorInvoiceWeight4 || '',
          VendorInvoiceWeight5: gateEntry.VendorInvoiceWeight5 || '',

          BalanceQty: gateEntry.BalanceQty || '',
          BalanceQty2: gateEntry.BalanceQty2 || '',
          BalanceQty3: gateEntry.BalanceQty3 || '',
          BalanceQty4: gateEntry.BalanceQty4 || '',
          BalanceQty5: gateEntry.BalanceQty5 || '',
        }));

        console.log('[DBG] Form updated with gate entry details');
      } catch (err) {
        console.error('Failed to fetch gate entry details:', err);
        setError('Could not fetch gate entry details');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="create-header-container">
      <h2 className="page-title">Material Movement Inward</h2>
      
      <form onSubmit={onSubmit} className="create-form">
        <section className="form-section">
          <h3 className="section-title">Material Details</h3>
          
          <div className="grid-2-cols">
            <div className="form-group">
              <label className="form-label">Weight Doc Number</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  name="WeightDocNumber"
                  value={form.WeightDocNumber}
                  className="form-input"
                  readOnly
                  style={{ flex: 1 }}
                  placeholder="WeightBridge Number"
                />
                {/* <button
                  type="button"
                  onClick={fetchNextWeightNumber}
                  className="btn btn-secondary"
                  style={{ padding: '0 16px' }}
                  title="Refresh weight number"
                > 
              
                </button> */}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">FiscalYear</label>
              <input
                type="text"
                name="FiscalYear"
                value={form.FiscalYear}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Gate Entry Number</label>
              <input
                type="text"
                name="GateEntryNumber"
                value={form.GateEntryNumber}
                onChange={handleGateEntryChange} // Change this line
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Gate Entry Date</label>
              <input
                type="date"
                name="GateEntryDate"
                value={form.GateEntryDate}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Truck Number</label>
              <input
                type="text"
                name="TruckNumber"
                value={form.TruckNumber}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Truck Capacity</label>
              <input
                type="text"
                name="TruckCapacity"
                value={form.TruckCapacity}
                onChange={handleChange}
                className="form-input"
                placeholder="50.000"
                required
              />
            </div>

            {/* <div className="form-group">
              <label className="form-label">Tare Weight</label>
              <input
                type="text"
                name="TareWeight"
                value={form.TareWeight}
                onChange={handleChange}
                className="form-input"
                placeholder="30.000"
                required
              />
            </div> */}

            <div className="form-group">
              <label className="form-label">Gross Weight</label>
              <input
                type="text"
                name="GrossWeight"
                value={form.GrossWeight}
                onChange={handleChange}
                className="form-input"
                placeholder="60.000"
                required
              />
            </div>

            {/* <div className="form-group">
              <label className="form-label">Net Weight</label>
              <input
                type="text"
                name="NetWeght"
                value={form.NetWeght}
                onChange={handleChange}
                className="form-input"
                placeholder="30.000"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Difference BT</label>
              <input
                type="text"
                name="DifferenceBT"
                value={form.DifferenceBT}
                onChange={handleChange}
                className="form-input"
                placeholder="30.000"
                required
              />
            </div> */}

            {/* <div className="form-group">
              <label className="form-label">Vendor Invoice Number</label>
              <input
                type="text"
                name="VendorInvoiceNumber"
                value={form.VendorInvoiceNumber}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Vendor Invoice Weight</label>
              <input
                type="text"
                name="VendorInvoiceWeight"
                value={form.VendorInvoiceWeight}
                onChange={handleChange}
                className="form-input"
                placeholder="32.000"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Balance Qty</label>
              <input
                type="text"
                name="BalanceQty"
                value={form.BalanceQty}
                onChange={handleChange}
                className="form-input"
                placeholder="25.000"
                required
              />
            </div> */}

            {/* <div className="form-group">
              <label className="form-label">Tolerance Weight</label>
              <input
                type="text"
                name="ToleranceWeight"
                value={form.ToleranceWeight}
                onChange={handleChange}
                className="form-input"
                placeholder="20.000"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Actually Weight</label>
              <input
                type="text"
                name="ActuallyWeight"
                value={form.ActuallyWeight}
                onChange={handleChange}
                className="form-input"
                placeholder="30.000"
                required
              />
            </div> */}

            {/* <div className="form-group">
              <label className="form-label">Vendor</label>
              <input
                type="text"
                name="Vendor"
                value={form.Vendor}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Vendor Name</label>
              <input
                type="text"
                name="VendorName"
                value={form.VendorName}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div> */}

            <div className="form-group">
              <label className="form-label">Inward Time (HH:mm:ss)</label>
              <input
                type="text"
                name="InwardTime"
                value={form.InwardTime}
                onChange={handleChange}
                className="form-input"
                placeholder="15:02:25"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Outward Time (HH:mm:ss)</label>
              <input
                type="text"
                name="OutwardTime"
                value={form.OutwardTime}
                onChange={handleChange}
                className="form-input"
                placeholder="22:30:45"
                required
              />
            </div>

          </div>
        </section>

        {/* Purchase Order Details - 5 lines like CreateHeader */}
        <section className="form-section">
          <h3 className="section-title">Purchase Order Details</h3>
          {Array.from({ length: 5 }).map((_, idx) => {
            const suffix = idx === 0 ? "" : String(idx + 1);
            return (
              <div key={idx} className="po-entry-card">
                <h4 className="po-entry-title">PO Entry {idx + 1}</h4>
                <div className="grid-4-cols">
                  <div className="form-group">
                    <label className="form-label">PO Number</label>
                    <input
                      className="form-input"
                      name={`PurchaseOrderNumber${suffix}`}
                      value={form[`PurchaseOrderNumber${suffix}`]}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Material</label>
                    <input
                      className="form-input"
                      name={`Material${suffix}`}
                      value={form[`Material${suffix}`]}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Material Description</label>
                    <input
                      className="form-input"
                      name={`MaterialDescription${suffix}`}
                      value={form[`MaterialDescription${suffix}`]}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor</label>
                    <input
                      className="form-input"
                      name={`Vendor${suffix}`}
                      value={form[`Vendor${suffix}`]}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Name</label>
                    <input
                      className="form-input"
                      name={`VendorName${suffix}`}
                      value={form[`VendorName${suffix}`]}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Invoice No</label>
                    <input
                      className="form-input"
                      name={`VendorInvoiceNumber${suffix}`}
                      value={form[`VendorInvoiceNumber${suffix}`]}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Invoice Date</label>
                    <input
                      type="date"
                      className="form-input"
                      name={`VendorInvoiceDate${suffix}`}
                      value={form[`VendorInvoiceDate${suffix}`]}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Invoice Weight</label>
                    <input
                      className="form-input"
                      name={`VendorInvoiceWeight${suffix}`}
                      value={form[`VendorInvoiceWeight${suffix}`]}
                      onChange={handleChange}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Balance Quantity</label>
                    <input
                      className="form-input"
                      name={`BalanceQty${suffix}`}
                      value={form[`BalanceQty${suffix}`]}
                      onChange={handleChange}
                      placeholder="0.000"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Material Description (existing) */}
        {/* <section className="form-section">
          <div className="grid-2-cols">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Material Description</label>
              <input
                type="text"
                name="MaterialDescription"
                value={form.MaterialDescription}
                onChange={handleChange}
                className="form-input"
                style={{ width: '100%' }}
                required
              />
            </div>
          </div>
        </section> */}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Material Inward'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setForm(createInitialState())}
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
          <strong>Success:</strong> {result.message}
            <p><strong>Gate Entry Number:</strong> {result.gateNumber}</p>
            <p><strong>Weight Doc Number:</strong> {result.weightDocNumber}</p>
            <p><strong>Date:</strong> {result.date}</p>
            <p><strong>Vehicle:</strong> {result.vehicle}</p>
        </div>
      )}
    </div>
  );
}
