// Version 6: Fixed mandatory labels, auto-fill, and inward time
import React, { useState, useEffect } from "react";
import { createHeader, fetchNextGateNumber, fetchInitialRegistrations, fetchTruckRegistrations } from "../../api";
import { useLocation } from "react-router-dom";
//import "./CreateHeader.css";

export default function Outward() {
  const currentDate = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear().toString();

  // Helper: Format current time into SAP duration string e.g. PT16H42M16S
  const formatTimeToSapDuration = (date = new Date()) => {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `PT${hh}H${mm}M${ss}S`;
  };

  // Helper: Full ISO timestamp (UTC) for SAP_CreatedDateTime
  const nowIso = (date = new Date()) => date.toISOString();

  // Create initial state function to avoid reference issues
  const createInitialHeaderState = () => ({
    // Header fields
    GateEntryNumber: "",
    GateEntryDate: currentDate,
    Indicators: "T",
    VehicleNumber: "",
    Remarks: "",
    SAP_Description: "",
    FiscalYear: currentYear,

    // Time fields
    InwardTime: "",
    OutwardTime: "",
    SAP_CreatedDateTime: new Date().toISOString(),

    // Single SD entry fields
    SalesDocument: "",
    Material: "",
    MaterialDescription: "",
    Vendor: "",
    BalanceQty: "",
    VendorITP: "",
    MaterialITP: "",
    MaterialGrade: "",
    Plant: "",
    TareWeight: "",
    GrossWeight: "",
    NetWeight: ""
  });

  const [header, setHeader] = useState(createInitialHeaderState());
  const [series, setSeries] = useState("5");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  
  // State for lookup suggestions
  const [lookupSuggestions, setLookupSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Special handling for numeric fields to allow decimals
    if (name.includes('BalanceQty')) {
      // Allow numbers, decimal point, and empty string
      if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
        setHeader(prev => ({ ...prev, [name]: value }));
      }
    } else {
      setHeader(prev => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value
      }));
    }
  };

  // Auto-lookup Initial Registration when Sales Document or Vehicle Number changes
  useEffect(() => {
    const lookupInitialReg = async () => {
      // Only lookup if we have at least 3 characters in either field
      const sdSearch = header.SalesDocument.trim();
      const vehSearch = header.VehicleNumber.trim();
      
      if (sdSearch.length < 3 && vehSearch.length < 3) {
        setLookupSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setLookupLoading(true);
      try {
        // Search by either Sales Document or Vehicle Number
        const searchTerm = sdSearch.length >= 3 ? sdSearch : vehSearch;
        const { data } = await fetchInitialRegistrations({ 
          search: searchTerm, 
          top: 10 
        });
        const results = data?.d?.results || [];
        // Filter to only show Success status registrations and exact vehicle number match (case-insensitive, trimmed)
        const vehicleInput = vehSearch.trim().toLowerCase();
        const filtered = results.filter(r => {
          if (r.Status !== "Success") return false;
          if (!vehicleInput) return true;
          return (r.VehicleNumber || "").trim().toLowerCase() === vehicleInput;
        });
        setLookupSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
      } catch (err) {
        console.error('Initial Registration lookup failed:', err);
        setLookupSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLookupLoading(false);
      }
    };

    // Debounce the lookup
    const timeoutId = setTimeout(lookupInitialReg, 500);
    return () => clearTimeout(timeoutId);
  }, [header.SalesDocument, header.VehicleNumber]);

  // Function to apply selected Initial Registration data
  const applyInitialRegData = (regData) => {
    console.log('[DEBUG] Applying Initial Registration data:', regData);
    setHeader(prev => ({
      ...prev,
      SalesDocument: regData.SalesDocument || prev.SalesDocument,
      VendorITP: regData.Vendor || prev.Vendor,
      MaterialITP: regData.Material || prev.Material,
      MaterialDescription: regData.MaterialDescription || prev.MaterialDescription,
      MaterialGrade: regData.MaterialGrade || prev.MaterialGrade,
      VehicleNumber: regData.VehicleNumber || prev.VehicleNumber,
  //    BalanceQty: regData.ExpectedQty || prev.BalanceQty,
      Remarks: regData.SAP_Description || prev.Remarks,
      TareWeight: regData.TareWeight || prev.TareWeight,
    }));
    setShowSuggestions(false);
  };

  // Only update FiscalYear when GateEntryDate changes
  useEffect(() => {
    if (header.GateEntryDate) {
      const year = header.GateEntryDate.slice(0, 4);
      setHeader(prev => ({ ...prev, FiscalYear: year }));
    }
  }, [header.GateEntryDate, series, currentYear]);

  // detect mode from URL path (inward / outward)
  const location = useLocation();
  const pathTail = location.pathname.split("/").pop();
  const mode = pathTail === "inward" ? "inward" : (pathTail === "outward" ? "outward" : "default");

  // Set times based on mode
  useEffect(() => {
    const hh = String(new Date().getHours()).padStart(2, "0");
    const mm = String(new Date().getMinutes()).padStart(2, "0");
    const ss = String(new Date().getSeconds()).padStart(2, "0");
    const currentTime = `${hh}:${mm}:${ss}`;

    if (mode === "inward") {
      setHeader(h => ({ 
        ...h, 
        InwardTime: currentTime, 
        OutwardTime: "" 
      }));
    }
    if (mode === "outward") {
      setHeader(h => ({ 
        ...h, 
        InwardTime: currentTime,
        OutwardTime: currentTime
      }));
    }
  }, [mode]);

  // Add data transformation before sending to API
  const transformDataForAPI = (data) => {
    const transformed = { ...data };

    const normalizeDecimalString = (val) => {
      if (val === '' || val === null || val === undefined) return null;
      const s = String(val).trim().replace(/,/g, '');
      const normalized = s.replace(/\s+/g, '').replace(',', '.');
      if (/^-?\d+(\.\d+)?$/.test(normalized)) {
        return normalized;
      }
      return null;
    };

    for (let i = 1; i <= 5; i++) {
      const suffix = i === 1 ? "" : String(i);
      const qtyField = `BalanceQty${suffix}`;
      transformed[qtyField] = normalizeDecimalString(transformed[qtyField]);
    }

    return transformed;
  };

  // helper: convert "HH:mm:ss" or Date() -> "PT#H#M#S"
  const hhmmssToSapDuration = (val) => {
    if (!val) return null;
    if (typeof val === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(val)) {
      const [h, m, s] = val.split(':').map(v => parseInt(v, 10));
      return `PT${h}H${m}M${s}S`;
    }
    if (val instanceof Date) {
      return formatTimeToSapDuration(val);
    }
    return String(val);
  };

  // helper: extract readable message from SAP / axios error
  const extractErrorMessage = (err) => {
    const resp = err?.response?.data;
    if (!resp) return err?.message || String(err);
    if (resp.error?.message?.value) return resp.error.message.value;
    if (resp.error?.message) return typeof resp.error.message === 'string' ? resp.error.message : JSON.stringify(resp.error.message);
    if (resp.message) return typeof resp.message === 'string' ? resp.message : JSON.stringify(resp.message);
    return JSON.stringify(resp);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    // Validate required fields
    if (!header.VehicleNumber) {
      setError("Vehicle Number is required");
      setLoading(false);
      return;
    }

    if (!/^\d*\.?\d*$/.test(header.BalanceQty)) {
      setError("Balance Quantity must be a valid number");
      setLoading(false);
      return;
    }

    try {
      let updatedHeader = { ...header };

      // Generate GateEntryNumber only if missing
      if (!updatedHeader.GateEntryNumber) {
        const year = updatedHeader.GateEntryDate ? updatedHeader.GateEntryDate.slice(0, 4) : currentYear;
        try {
          const resp = await fetchNextGateNumber(year, series);
          updatedHeader.GateEntryNumber = resp?.data?.next || `${year}${series === '5' ? '5' : 'IT'}0000001`;
        } catch (err) {
          const yearShort = updatedHeader.GateEntryDate ? updatedHeader.GateEntryDate.slice(2, 4) : currentYear.slice(2, 4);
          const seriesPrefix = series === '5' ? '5' : 'IT';
          updatedHeader.GateEntryNumber = `${yearShort}${seriesPrefix}0000001`;
        }
        setHeader(updatedHeader); // Update state so UI reflects new number
      }

      const payload = transformDataForAPI({
        ...updatedHeader,
        GateEntryDate: `${updatedHeader.GateEntryDate}T00:00:00`,
        InwardTime: hhmmssToSapDuration(updatedHeader.InwardTime),
        OutwardTime: hhmmssToSapDuration(updatedHeader.OutwardTime),
        SAP_CreatedDateTime: nowIso()
      });

      console.log('[DEBUG] Submitting payload:', payload);

      const response = await createHeader(payload);
      
      const createdGateNumber = response.data?.d?.GateEntryNumber || 
                                response.data?.GateEntryNumber || 
                                updatedHeader.GateEntryNumber;
      
      setResult({
        success: true,
        gateNumber: createdGateNumber,
        vehicle: updatedHeader.VehicleNumber,
        date: updatedHeader.GateEntryDate,
        salesDoc: updatedHeader.SalesDocument
      });
      // Don't auto-reset - let user see the success message
    } catch (err) {
      const msg = extractErrorMessage(err);
      setError(msg);
      console.error('Submit error:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setHeader(createInitialHeaderState());
    setError(null);
    setResult(null);
    setLookupSuggestions([]);
    setShowSuggestions(false);
  };

  // Prevent Enter key from submitting the form
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  return (
    <div className="create-header-container">
      <h2 className="page-title">
        {mode === "inward" ? "Create Gate Entry (Inward)" : 
         mode === "outward" ? "Create Gate Entry (Outward)" : 
         "Empty Truck Internal Transfer Posting (ITP)"}
      </h2>

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        <section className="form-section">
          <h3 className="section-title">Details</h3>
          <div className="grid-3-cols">
            <div className="form-group">
              <label className="form-label required">TransferPosting Number</label>
              <input
                className="form-input"
                name="Internal TransferPostingNumber"
                value={header.GateEntryNumber}
                readOnly
                required
                style={{ background: '#f0f0f0' }}
                placeholder="Will be generated on Save"
              />
            </div>

            <div className="form-group">
              <label className="form-label required">TransferPosting Date</label>
              <input
                className="form-input"
                name="TransferPostingDate"
                type="date"
                value={header.GateEntryDate}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Series</label>
              <select className="form-select" value={series} onChange={(e) => setSeries(e.target.value)}>
                <option value="1">SD Series</option>
              </select>
            </div>

            <div className="form-group lookup-field" style={{ position: 'relative' }}>
              <label className="form-label required">Vehicle Number</label>
              <input
                className="form-input"
                name="VehicleNumber"
                value={header.VehicleNumber}
                onChange={handleChange}
                placeholder="Enter vehicle number..."
                required
              />
              {lookupLoading && <small className="lookup-hint">Searching...</small>}
              {showSuggestions && lookupSuggestions.length > 0 && (
                <div className="lookup-suggestions" style={{ position: 'absolute', zIndex: 10, background: '#fff', width: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                  <div className="suggestions-header">
                    <strong>Found {lookupSuggestions.length} registered entries:</strong>
                    <button
                      type="button"
                      className="close-suggestions"
                      onClick={() => setShowSuggestions(false)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="suggestions-list">
                    {lookupSuggestions.map((reg, idx) => (
                      <div
                        key={reg.SAP_UUID || idx}
                        className="suggestion-item"
                        onClick={() => applyInitialRegData(reg)}
                        style={{ cursor: 'pointer', padding: 8 }}
                      >
                        <div className="suggestion-main">
                          <strong>SD: {reg.SalesDocument}</strong>
                          <span className="suggestion-vehicle">{reg.VehicleNumber}</span>
                        </div>
                        <div className="suggestion-details">
                          <span>Transporter: {reg.Transporter || '-'}</span>
                          <span>Expected Qty: {reg.ExpectedQty || '-'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>


            {/* <div className="form-group">
              <label className="form-label">Driver Name</label>
              <input
                className="form-input"
                name="DriverName"
                value={header.DriverName}
                onChange={handleChange}
              />
            </div> */}


            <div className="form-group">
              <label className="form-label">Inward Time (auto)</label>
              <input
                className="form-input"
                name="InwardTime"
                value={header.InwardTime}
                readOnly
              />
            </div>

            {/* <div className="form-group">
              <label className="form-label">Outward Time (auto)</label>
              <input
                className="form-input"
                name="OutwardTime"
                value={header.OutwardTime}
                readOnly
              />
            </div> */}

            <div className="form-group full-width">
              <label className="form-label">Remarks</label>
              <textarea
                className="form-textarea"
                name="Remarks"
                value={header.Remarks}
                onChange={handleChange}
                rows={2}
              />
            </div>
            
            <div className="form-group full-width">
              <label className="form-label">WB Remarks</label>
              <textarea
                className="form-textarea"
                name="WBRemarks"
                value={header.SAP_Description}
                onChange={handleChange}
                rows={2}
              />
            </div>
          </div>
        </section>

        <section className="form-section">
          <h3 className="section-title">Internal Transfer Posting Details</h3>

          <div className="sd-entry-card">
            <div className="grid-2-cols">
              {/* <div className="form-group lookup-field">
                <label className="form-label required">Sales Document Number</label>
                <input
                  className="form-input"
                  name="SalesDocument"
                  value={header.SalesDocument}
                  onChange={handleChange}
                  placeholder="Start typing to search..."
                  required
                />
                {lookupLoading && <small className="lookup-hint">Searching...</small>}
              </div> */}

              <div className="form-group">
                <label className="form-label required">Vendor</label>
                <input
                  className="form-input"
                  name="Vendor"
                  value={header.VendorITP}
                  onChange={handleChange}
                  placeholder="Enter Vendor code"
                
                />
              </div>

              <div className="form-group">
                <label className="form-label required">Material</label>
                <input
                  className="form-input"
                  name="Material"
                  value={header.MaterialITP}
                  onChange={handleChange}
                  placeholder="Enter material code"
                  
                />
              </div>

              <div className="form-group">
                <label className="form-label">Material Description</label>
                <input
                  className="form-input"
                  name="MaterialDescription"
                  value={header.MaterialDescription}
                  onChange={handleChange}
                  placeholder="Material description"
                />
              </div>
            <div className="form-group">
                <label className="form-label">Material Grade</label>
                <input
                  className="form-input"
                  name="MaterialGrade"
                  value={header.MaterialGrade}
                  onChange={handleChange}
                  placeholder="Material description"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Plant</label>
             <input
               className="form-input"
                name="Plant"
               value={header.Plant}
               onChange={handleChange}
               placeholder="Plant details"
              />
              </div>
              {/* <div className="form-group">
                <label className="form-label required">Balance Qty</label>
                <input
                  className="form-input"
                  name="BalanceQty"
                  value={header.BalanceQty}
                  onChange={handleChange}
                  placeholder="Balance Qty"
                  
                />
              </div> */}
              <div className="form-group">
                <label className="form-label required">Tare Weight</label>
                <input
                  className="form-input"
                  name="TareWeight"
                  value={header.TareWeight}
                  onChange={handleChange}
                  placeholder="Tare Weight"
                  required
                />
              </div>
            </div>
          </div>
        </section>

        <div className="form-actions">
          <button
            type="submit"
            disabled={loading}
            className={`btn btn-primary ${loading ? 'disabled' : ''}`}
          >
            {loading ? "Creating..." : 
             mode === "inward" ? "Create Inward Entry" : 
             mode === "outward" ? "Create Outward Entry" : 
             " Create Internal TransferPosting Entry"}
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="btn btn-secondary"
          >
            Reset Form
          </button>
        </div>
      </form>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && result.success && (
        <div className="success-message">
          <div className="success-header">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <h3>Internal TransferPosting Entry Created Successfully!</h3>
          </div>
          <div className="success-content">
            <p><strong>Internal TransferPosting Entry Number:</strong> {result.gateNumber}</p>
            <p><strong>Date:</strong> {result.date}</p>
            <p><strong>Vehicle:</strong> {result.vehicle}</p>
          </div>
        </div>
      )}
    </div>
  );
}
