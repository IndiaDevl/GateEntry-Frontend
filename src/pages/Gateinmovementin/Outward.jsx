// Version 6: Fixed mandatory labels, auto-fill, and inward time
import React, { useState, useEffect } from "react";
import { createHeader, fetchNextGateNumber, fetchInitialRegistrations, fetchSalesOrderSuggestions } from "../../api";
import { useLocation } from "react-router-dom";
import "./CreateHeader.css";

export default function Outward() {
  const currentDate = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear().toString();

  // Helper: Transform header data for API submission
  const transformDataForAPI = (header) => {
    // You can customize this function as needed for your API
    // For now, just return the header object as-is
    return { ...header };
  };

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
    Indicators: "O",
    VehicleNumber: "",
    TransporterName: "",
    DriverName: "",
    DriverPhoneNumber: "",
    PermitNumber: "",
    EWayBill: false,
    Division: "",
    Remarks: "",
    FiscalYear: currentYear,
    RegistrationNumber: "",

    // Time fields
    InwardTime: "",
    OutwardTime: "",
    SAP_CreatedDateTime: new Date().toISOString(),

    // Single SD entry fields
    SalesDocument: "",
    Material: "",
    MaterialDescription: "",
    Customer: "",
    CustomerName: "",
    BalanceQty: ""
  });

  const [header, setHeader] = useState(createInitialHeaderState());
  const [series, setSeries] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  
  // State for lookup suggestions
  const [lookupSuggestions, setLookupSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [selectedRegNumber, setSelectedRegNumber] = useState(""); // New state for selected registration number

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

  // Auto-lookup Initial Registration ONLY when Registration Number changes
  useEffect(() => {
    const lookupInitialReg = async () => {
      const registrationSearch = header.RegistrationNumber.trim();
      if (registrationSearch.length < 2) {
        setLookupSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      setLookupLoading(true);
      try {
        const { data } = await fetchInitialRegistrations({ 
          search: registrationSearch, 
          top: 10 // Show up to 10 matches for dropdown
        });
        const results = data?.d?.results || [];
        // Filter to only show Success status registrations
        const successResults = results.filter(r => r.Status === "Success");
        setLookupSuggestions(successResults);
        setShowSuggestions(successResults.length > 0);
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
  }, [header.RegistrationNumber]);

  // Function to apply selected Initial Registration data (auto-fill all fields)
  const applyInitialRegData = (regData) => {
    console.log('[DEBUG] Applying Initial Registration data:', regData);
    setHeader(prev => ({
      ...prev,
      SalesDocument: regData.SalesDocument2 || '',
      Customer: regData.Customer || '',
      CustomerName: regData.CustomerName || '',
      Material: regData.Material || '',
      MaterialDescription: regData.MaterialDescription || '',
      VehicleNumber: regData.VehicleNumber || '',
      RegistrationNumber: regData.RegistrationNumber || prev.RegistrationNumber,
      TransporterName: regData.Transporter || '',
      BalanceQty: regData.ExpectedQty || '',
      Remarks: regData.SAP_Description || ''
    }));
    setShowSuggestions(false);
  };

  // Only update FiscalYear when GateEntryDate changes
  useEffect(() => {
    if (header.GateEntryDate) {
      const year = header.GateEntryDate.slice(0, 4);
      setHeader(prev => ({ ...prev, FiscalYear: year }));
    }
    // Do NOT auto-generate GateEntryNumber here
    // It will be generated only on submit
    // eslint-disable-next-line
  }, [header.GateEntryDate]);

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

    if (!header.SalesDocument) {
      setError("Sales Document Number is required");
      setLoading(false);
      return;
    }

    if (!header.Customer) {
      setError("Customer is required");
      setLoading(false);
      return;
    }

    if (!header.Material) {
      setError("Material is required");
      setLoading(false);
      return;
    }

    if (!header.BalanceQty) {
      setError("Balance Quantity is required");
      setLoading(false);
      return;
    }

    if (!/^\d*\.?\d*$/.test(header.BalanceQty)) {
      setError("Balance Quantity must be a valid number");
      setLoading(false);
      return;
    }

    try {
      // 1. Generate Gate Entry Number only now
      const year = header.GateEntryDate ? header.GateEntryDate.slice(0, 4) : currentYear;
      let gateNumber = "";
      try {
        const resp = await fetchNextGateNumber(year, series);
        gateNumber = resp?.data?.next || "";
      } catch (err) {
        // fallback if needed
        const y = header.GateEntryDate ? header.GateEntryDate.slice(2, 4) : currentYear.slice(2, 4);
        const seriesPrefix = series === '1' ? '1' : 'MM';
        gateNumber = `${y}${seriesPrefix}0000001`;
      }
      setHeader(prev => ({ ...prev, GateEntryNumber: gateNumber }));

      // 2. Prepare payload with the generated number
      const payload = transformDataForAPI({
        ...header,
        GateEntryNumber: gateNumber,
        GateEntryDate: `${header.GateEntryDate}T00:00:00`,
        InwardTime: hhmmssToSapDuration(header.InwardTime),
        OutwardTime: hhmmssToSapDuration(header.OutwardTime),
        SAP_CreatedDateTime: nowIso()
      });

      console.log('[DEBUG] Submitting payload:', payload);

      const response = await createHeader(payload);
      const createdGateNumber = response.data?.d?.GateEntryNumber || 
                                response.data?.GateEntryNumber || 
                                gateNumber;
      setResult({
        success: true,
        gateNumber: createdGateNumber,
        vehicle: header.VehicleNumber,
        date: header.GateEntryDate,
        salesDoc: header.SalesDocument
      });
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
         "Create Gate Entry"}
      </h2>

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        <section className="form-section">
          <h3 className="section-title">Header Information</h3>
          <div className="grid-3-cols">
            <div className="form-group">
              <label className="form-label required">Gate Entry Number</label>
              <input
                className="form-input"
                name="GateEntryNumber"
                value={header.GateEntryNumber}
                readOnly
                required
                placeholder="Gate Entry Number"
                style={{ background: header.GateEntryNumber ? undefined : '#f3f4f6', color: header.GateEntryNumber ? undefined : '#a0aec0' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Gate Entry Date</label>
              <input
                className="form-input"
                name="GateEntryDate"
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

            <div className="form-group lookup-field" style={{ position: 'relative', width: '100%' }}>
              <label className="form-label required">Registration Number</label>
              <input
                className="form-input"
                name="RegistrationNumber"
                value={header.RegistrationNumber}
                onChange={handleChange}
                placeholder="Registration Number"
                required
                autoComplete="off"
                style={{ width: '100%' }}
              />
              {lookupLoading && <small className="lookup-hint">Searching...</small>}
              {showSuggestions && lookupSuggestions.length > 0 && (
                <div className="dropdown-suggestions" style={{ width: '100%' }}>
                  <ul className="suggestion-list" style={{ width: '100%' }}>
                    {lookupSuggestions.map((reg, idx) => (
                      <li
                        key={reg.RegistrationNumber + '-' + idx}
                        className="suggestion-item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSelectedRegNumber(reg.RegistrationNumber);
                          applyInitialRegData(reg);
                          setHeader(prev => ({ ...prev, RegistrationNumber: reg.RegistrationNumber }));
                          setShowSuggestions(false); // hide after selection
                        }}
                      >
                        <span style={{ display: 'inline-block', minWidth: 120 }}><strong>{reg.RegistrationNumber}</strong></span>
                        <span style={{ color: '#888', marginLeft: 8 }}>{reg.VehicleNumber}</span>
                        <span style={{ color: '#aaa', marginLeft: 8 }}>{reg.SalesDocument2}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>



            <div className="form-group lookup-field">
              <label className="form-label required">Vehicle Number</label>
              <input
                className="form-input"
                name="VehicleNumber"
                value={header.VehicleNumber}
                onChange={handleChange}
                placeholder ="Enter vehicle number"
                required
              />
           {/* {lookupLoading && <small className="lookup-hint">Searching...</small>}  */}
            </div>
            <div className="form-group">
              <label className="form-label">Transporter Name</label>
              <input
                className="form-input"
                name="TransporterName"
                value={header.TransporterName}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Driver Name</label>
              <input
                className="form-input"
                name="DriverName"
                value={header.DriverName}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Driver Phone</label>
              <input
                className="form-input"
                name="DriverPhoneNumber"
                value={header.DriverPhoneNumber}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Permit Number</label>
              <input
                className="form-input"
                name="PermitNumber"
                value={header.PermitNumber}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Division</label>
              <input
                className="form-input"
                name="Division"
                value={header.Division}
                onChange={handleChange}
              />
            </div>

            <div className="form-group form-group-checkbox">
              <input type="checkbox" className="form-checkbox" name="EWayBill" checked={header.EWayBill} onChange={handleChange} />
              <label className="form-checkbox-label">E-Way Bill</label>
            </div>

            <div className="form-group">
              <label className="form-label">Inward Time (auto)</label>
              <input
                className="form-input"
                name="InwardTime"
                value={header.InwardTime}
                readOnly
              />
            </div>

            <div className="form-group">
              <label className="form-label">Outward Time (auto)</label>
              <input
                className="form-input"
                name="OutwardTime"
                value={header.OutwardTime}
                readOnly
              />
            </div>

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
          </div>
        </section>

        <section className="form-section">
          <h3 className="section-title">Sales Document Details</h3>
          
          {/* RegistrationNumber dropdown filter only; sales document suggestions removed */}

          <div className="sd-entry-card">
            <div className="grid-2-cols">
              <div className="form-group lookup-field">
                <label className="form-label required">Sales Document Number</label>
                <input
                  className="form-input"
                  name="SalesDocument"
                  value={header.SalesDocument}
                  onChange={handleChange}
                  placeholder="Start typing to search..."
                  required
                />
                {/* {lookupLoading && <small className="lookup-hint">Searching...</small>} */}
              </div>

              <div className="form-group">
                <label className="form-label required">Customer</label>
                <input
                  className="form-input"
                  name="Customer"
                  value={header.Customer}
                  onChange={handleChange}
                  placeholder="Enter customer code"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Customer Name</label>
                <input
                  className="form-input"
                  name="CustomerName"
                  value={header.CustomerName}
                  onChange={handleChange}
                  placeholder="Customer name"
                />
              </div>

              <div className="form-group">
                <label className="form-label required">Material</label>
                <input
                  className="form-input"
                  name="Material"
                  value={header.Material}
                  onChange={handleChange}
                  placeholder="Enter material code"
                  required
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
                <label className="form-label required">Balance Qty</label>
                <input
                  className="form-input"
                  name="BalanceQty"
                  value={header.BalanceQty}
                  onChange={handleChange}
                  placeholder="Balance Qty"
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
             "Create Gate Entry"}
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
            <h3>Gate Entry Created Successfully!</h3>
          </div>
          <div className="success-content">
            <p><strong>Gate Entry Number:</strong> {result.gateNumber}</p>
            <p><strong>Date:</strong> {result.date}</p>
            <p><strong>Vehicle:</strong> {result.vehicle}</p>
            <p><strong>Sales Document:</strong> {result.salesDoc}</p>
          </div>
        </div>
      )}
    </div>
  );
}
