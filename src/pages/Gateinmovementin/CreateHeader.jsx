
import React, { useState, useEffect, useRef } from "react";
import { createHeader, fetchNextGateNumber, fetchPurchaseOrderByNumber, fetchPurchaseOrderSuggestions, updateHeaderByUUID, fetchGateEntryByNumber } from "../../api";
import { useLocation } from "react-router-dom";
import "./CreateHeader.css";

export default function CreateHeader() {
    // Track if we are editing an existing entry
    const [isUpdateMode, setIsUpdateMode] = useState(false);
    const [loadedUUID, setLoadedUUID] = useState(null);
  const currentDate = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear().toString();

  // Create initial state function
  const createInitialHeaderState = () => {
    const initialState = {
      GateEntryNumber: "",
      GateEntryDate: currentDate,
      Indicators: "I",
      VehicleStatus: "IN",
      VehicleNumber: "",
      TransporterCode: "",
      TransporterName: "",
      DriverName: "",
      DriverPhoneNumber: "",
      DrivingLicenseNumber: "",
      LRGCNumber: "",
      PermitNumber: "",
      EWayBill: false,
      Division: "",
      Remarks: "",
      SubTransporterName: "",
      FiscalYear: currentYear,
      InwardTime: new Date().toISOString().includes('T')
        ? `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}:${new Date().getSeconds().toString().padStart(2, '0')}`
        : '',
      OutwardTime: "",
      SAP_CreatedDateTime: new Date().toISOString(),
    };

    for (let i = 1; i <= 5; i++) {
      const suffix = i === 1 ? "" : String(i);
      initialState[`PurchaseOrderNumber${suffix}`] = "";
      initialState[`Material${suffix}`] = "";
      initialState[`MaterialDescription${suffix}`] = "";
      initialState[`Vendor${suffix}`] = "";
      initialState[`VendorName${suffix}`] = "";
      initialState[`VendorInvoiceNumber${suffix}`] = "";
      initialState[`VendorInvoiceDate${suffix}`] = "";
      initialState[`VendorInvoiceWeight${suffix}`] = "";
      initialState[`BalanceQty${suffix}`] = "";
    }

    return initialState;
  };

  const [header, setHeader] = useState(createInitialHeaderState());
  const [series, setSeries] = useState("2");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [poLoading, setPoLoading] = useState({});
  const [lastCreated, setLastCreated] = useState(null);
  

  // PO dropdown state
  const [poDropdown, setPoDropdown] = useState({
    show: false,
    poList: [],
    suffix: '',
    searchQuery: '',
    loading: false
    // selectedPO: null
  });

  const [poItemsModal, setPoItemsModal] = useState({
    show: false,
    items: [],
    suffix: '',
    poNumber: '',
    headerData: null
  });

  // Refs for debouncing
  const searchTimeoutRef = useRef(null);

  // Helper functions
  const formatTimeToSapDuration = (date = new Date()) => {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `PT${hh}H${mm}M${ss}S`;
  };

  const nowIso = (date = new Date()) => date.toISOString();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.includes('VendorInvoiceWeight') || name.includes('BalanceQty')) {
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

  // ============================================
  // NEW: Enhanced PO Number Change Handler
  // ============================================
  const handlePONumberChange = async (e, suffix) => {
    const { value } = e.target;
    const poFieldName = `PurchaseOrderNumber${suffix}`;
    
    // Update the field immediately
    setHeader(prev => ({ ...prev, [poFieldName]: value }));

    // Clear related fields if value is empty
    if (!value || value.trim() === '') {
      clearPOFields(suffix);
      return;
    }

    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set loading state
    setPoLoading(prev => ({ ...prev, [suffix]: true }));

    // Debounce the search
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Show PO dropdown for short input
        if (value.length >= 1 && value.length <= 10) {
          await fetchAndShowPODropdown(value, suffix);
          return;
        }
        // If full PO number (>=10 chars), fetch directly
        if (value.length >= 10) {
          await fetchAndShowPOItems(value, suffix, true);
          setPoDropdown(prev => ({ ...prev, show: false, poList: [] }));
        }
      } catch (err) {
        console.error('Error in PO handling:', err);
        alert(`Error: ${err?.message || 'Failed to process PO'}`);
      } finally {
        setPoLoading(prev => ({ ...prev, [suffix]: false }));
      }
    }, 500); // 500ms debounce
  };

  // ============================================
  // NEW: Function to fetch and show PO dropdown
  // ============================================
  const fetchAndShowPODropdown = async (query, suffix) => {
    setPoDropdown(prev => ({ ...prev, loading: true, show: true, suffix, searchQuery: query }));
    try {
      const response = await fetchPurchaseOrderSuggestions(query);
      if (response.data.items && response.data.items.length > 0) {
        setPoDropdown({
          show: true,
          poList: response.data.items,
          suffix,
          searchQuery: query,
          loading: false
        });
      } else {
        setPoDropdown(prev => ({ ...prev, show: false, poList: [], loading: false }));
        clearPOFields(suffix);
      }
    } catch (err) {
      setPoDropdown(prev => ({ ...prev, show: false, poList: [], loading: false }));
      clearPOFields(suffix);
    }
  };

  // ============================================
  // NEW: Function to fetch and show PO line items
  // ============================================
  const fetchAndShowPOItems = async (poNumber, suffix, shouldUpdateField = false) => {
    try {
      if (shouldUpdateField) {
        setHeader(prev => ({ 
          ...prev, 
          [`PurchaseOrderNumber${suffix}`]: poNumber 
        }));
      }

      const response = await fetchPurchaseOrderByNumber(poNumber);
      const poData = response.data;
      
      console.log('PO Data received:', poData);
      
      const items = poData.items || [];
      const availableItems = items.filter((it) => {
        const mat = it.Material || it.material || '';
        const rem = getRemainingFor(poNumber, mat);
        return !(Number.isFinite(rem) && rem <= 0);
      });

      if (availableItems.length === 0) {
        // Instead of alert, set a completed badge/message for this PO entry
        setHeader(prev => ({
          ...prev,
          [`Material${suffix}`]: '',
          [`MaterialDescription${suffix}`]: '',
          [`Vendor${suffix}`]: '',
          [`VendorName${suffix}`]: '',
          [`BalanceQty${suffix}`]: 0,
          [`__POCompletedMsg${suffix}`]: `All items for PO ${poNumber} are completed (remaining 0)`
        }));
        return;
      }

      // If only one item, auto-fill; otherwise show selection modal
      if (availableItems.length === 1) {
        fillPOFields(suffix, availableItems[0], poData);
      } else {
        setPoItemsModal({
          show: true,
          items: availableItems,
          suffix: suffix,
          poNumber: poNumber,
          headerData: poData
        });
      }
      
    } catch (err) {
      console.error('Error fetching PO details:', err);
      const errorMsg = err?.response?.data?.error || err?.message || 'Failed to fetch PO details';
      alert(`Error loading PO: ${errorMsg}`);
      clearPOFields(suffix);
    }
  };

  // ============================================
  // NEW: Handle PO selection from dropdown
  // ============================================
  const handleSelectPOFromDropdown = (selectedPO) => {
    const { suffix } = poDropdown;
    setHeader(prev => ({
      ...prev,
      [`PurchaseOrderNumber${suffix}`]: selectedPO.PurchaseOrder
    }));
    setPoDropdown({ show: false, poList: [], suffix: '', searchQuery: '', loading: false });
    fetchAndShowPOItems(selectedPO.PurchaseOrder, suffix, false);
  };

  // ============================================
  // Helper Functions
  // ============================================
  const clearPOFields = (suffix) => {
    const fieldsToClear = [
      'Material', 'MaterialDescription', 'Vendor', 'VendorName',
      'BalanceQty', 'VendorInvoiceNumber', 'VendorInvoiceDate', 'VendorInvoiceWeight'
    ];
    
    const updates = {};
    fieldsToClear.forEach(field => {
      updates[`${field}${suffix}`] = '';
    });
    
    setHeader(prev => ({ ...prev, ...updates }));
  };

  const fillPOFields = (suffix, item, headerData) => {
    const supplierCode = headerData?.Supplier || headerData?.supplier || '';
    const supplierName = headerData?.SupplierName || headerData?.supplierName || '';

    const material = item.Material || item.material || '';
    const materialDesc = item.PurchaseOrderItemText || item.MaterialDescription || item.materialDescription || '';
    const orderQtyNum = toNum(item.OrderQuantity || item.orderQuantity);

    setHeader(prev => {
      const poNo = prev[`PurchaseOrderNumber${suffix}`] || headerData?.PurchaseOrder || '';
      const storedRemaining = getRemainingFor(poNo, material);
      
      const initialRemaining = Number.isFinite(storedRemaining) 
        ? storedRemaining 
        : (Number.isFinite(orderQtyNum) ? orderQtyNum : '');

      return {
        ...prev,
        [`Material${suffix}`]: material,
        [`MaterialDescription${suffix}`]: materialDesc,
        [`Vendor${suffix}`]: supplierCode,
        [`VendorName${suffix}`]: supplierName,
        [`BalanceQty${suffix}`]: initialRemaining === 0 ? '' : String(initialRemaining || '')
      };
    });
  };

  const handleSelectPOItem = (item) => {
    fillPOFields(poItemsModal.suffix, item, poItemsModal.headerData);
    setPoItemsModal({ show: false, items: [], suffix: '', poNumber: '', headerData: null });
  };

  const closePOListModal = () => {
    setPoSelectionModal({ show: false, poList: [], suffix: '', searchQuery: '', loading: false });
  };

  const closePOItemsModal = () => {
    setPoItemsModal({ show: false, items: [], suffix: '', poNumber: '', headerData: null });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Rest of your existing code (transformDataForAPI, handleSubmit, etc.)
  // ============================================
  // [Keep all your existing functions below - they remain the same]
  // ============================================

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
      const weightField = `VendorInvoiceWeight${suffix}`;
      const qtyField = `BalanceQty${suffix}`;
      transformed[weightField] = normalizeDecimalString(transformed[weightField]);
      transformed[qtyField] = normalizeDecimalString(transformed[qtyField]);
    }

    transformed.EWayBill = Boolean(transformed.EWayBill);
    return transformed;
  };

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

  const extractErrorMessage = (err) => {
    const resp = err?.response?.data;
    if (!resp) return err?.message || String(err);
    if (typeof resp.error === 'string') return resp.error;
    if (resp.error?.message?.value) return resp.error.message.value;
    if (resp.error?.message && typeof resp.error.message === 'string') return resp.error.message;
    if (resp.message && typeof resp.message === 'string') return resp.message;
    return JSON.stringify(resp);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    // Validation
    const validationErrors = [];
    for (let i = 1; i <= 5; i++) {
      const s = i === 1 ? '' : String(i);
      const poNo = header[`PurchaseOrderNumber${s}`];
      const material = header[`Material${s}`];
      if (!poNo || !material) continue;

      const remaining = getRemainingFor(poNo, material);
      const weight = toNum(header[`VendorInvoiceWeight${s}`]);

      if (Number.isFinite(remaining) && remaining <= 0 && Number.isFinite(weight) && weight > 0) {
        validationErrors.push(`PO ${poNo} / ${material} is fully used (remaining 0). Remove weight or choose another line.`);
      }
      if (Number.isFinite(remaining) && Number.isFinite(weight) && weight > remaining) {
        validationErrors.push(`PO ${poNo} / ${material}: entered weight ${weight} exceeds remaining ${remaining}.`);
      }
    }
    if (validationErrors.length) {
      setError(validationErrors.join(' | '));
      setLoading(false);
      return;
    }

    try {
      let gateEntryNumber = header.GateEntryNumber;
      let uuid = loadedUUID;
      // If update mode, use PATCH
      if (isUpdateMode && uuid) {
        // Prepare payload (do not send GateEntryNumber or UUID fields)
        const rawPayload = {
          ...header,
          GateEntryDate: `${header.GateEntryDate}T00:00:00`,
          InwardTime: hhmmssToSapDuration(header.InwardTime),
          OutwardTime: hhmmssToSapDuration(header.OutwardTime),
          SAP_CreatedDateTime: nowIso(),
          FiscalYear: header.FiscalYear || currentYear
        };
        delete rawPayload.GateEntryNumber;
        const payload = transformDataForAPI(rawPayload);
        const response = await updateHeaderByUUID(uuid, payload);
        setResult('Gate entry updated successfully');
        setTimeout(() => setResult(null), 20000);
        setLoading(false);
        return;
      }

      // Else, create new
      if (!gateEntryNumber) {
        const year = header.GateEntryDate ? header.GateEntryDate.slice(0, 4) : currentYear;
        const resp = await fetchNextGateNumber(year, series);
        gateEntryNumber = resp?.data?.next || '';
        setHeader(h => ({ ...h, GateEntryNumber: gateEntryNumber }));
      }

      const inbound = header.InwardTime || `${new Date().getHours().toString().padStart(2,'0')}:${new Date().getMinutes().toString().padStart(2,'0')}:${new Date().getSeconds().toString().padStart(2,'0')}`;
      const outbound = header.OutwardTime || inbound;

      const rawPayload = {
        ...header,
        GateEntryNumber: gateEntryNumber,
        GateEntryDate: `${header.GateEntryDate}T00:00:00`,
        InwardTime: hhmmssToSapDuration(header.InwardTime || inbound),
        OutwardTime: mode === "outward" ? hhmmssToSapDuration(outbound) : (header.OutwardTime ? hhmmssToSapDuration(header.OutwardTime) : null),
        SAP_CreatedDateTime: nowIso(),
        FiscalYear: header.FiscalYear || currentYear
      };

      const payload = transformDataForAPI(rawPayload);
      console.debug('Sending payload', payload);

      const response = await createHeader(payload);
      setResult('Gate entry created successfully');

      setLastCreated({
        gateEntryNumber: gateEntryNumber,
        date: header.GateEntryDate,
        vehicle: header.VehicleNumber
      });

      // Update remaining quantities
      for (let i = 1; i <= 5; i++) {
        const s = i === 1 ? '' : String(i);
        const poNo = header[`PurchaseOrderNumber${s}`];
        const material = header[`Material${s}`];
        if (!poNo || !material) continue;

        const prevRemainingStored = getRemainingFor(poNo, material);
        const formBalance = toNum(header[`BalanceQty${s}`]);
        const received = toNum(header[`VendorInvoiceWeight${s}`]);

        const prevRemaining = Number.isFinite(prevRemainingStored)
          ? prevRemainingStored
          : (Number.isFinite(formBalance) ? formBalance : NaN);

        if (!Number.isFinite(prevRemaining)) continue;

        let consumed = 0;
        if (Number.isFinite(received) && received > 0) {
          consumed = received;
        } else if (Number.isFinite(formBalance) && formBalance < prevRemaining) {
          consumed = prevRemaining - formBalance;
        }

        const newRemaining = Math.max(0, prevRemaining - consumed);
        setRemainingFor(poNo, material, newRemaining);
      }

      setTimeout(() => setResult(null), 20000);
      resetForm({ keepMessages: true });
    } catch (err) {
      console.error('Submit error:', err?.response?.data || err);
      const msg = extractErrorMessage(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = (opts = { keepMessages: false }) => {
    setHeader(createInitialHeaderState());
    setError(null);
    setIsUpdateMode(false);
    setLoadedUUID(null);
    if (!opts.keepMessages) {
      setResult(null);
      setLastCreated(null);
    }
  };

  // Load existing entry by GateEntryNumber
  const handleLoadForUpdate = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!header.GateEntryNumber) {
        setError('Enter Gate Entry Number to load for update');
        setLoading(false);
        return;
      }
      const resp = await fetchGateEntryByNumber(header.GateEntryNumber);
      let entry = null;
      if (resp.data?.d?.results?.length) {
        entry = resp.data.d.results[0];
      } else if (resp.data?.value?.length) {
        entry = resp.data.value[0];
      }
      if (!entry) {
        setError('Gate entry not found');
        setLoading(false);
        return;
      }
      // Map SAP fields to form fields as needed
      setHeader(prev => ({ ...prev, ...entry }));
      setIsUpdateMode(true);
      setLoadedUUID(entry.SAP_UUID || entry.uuid || entry.Id || entry.id);
      setResult('Loaded for update. Edit and click Update.');
    } catch (err) {
      setError('Failed to load entry for update');
    } finally {
      setLoading(false);
    }
  };

  // Mode detection
  const location = useLocation();
  const pathTail = location.pathname.split("/").pop();
  const mode = pathTail === "inward" ? "inward" : (pathTail === "outward" ? "outward" : "default");

  useEffect(() => {
    if (mode === "inward") {
      const hh = String(new Date().getHours()).padStart(2, "0");
      const mm = String(new Date().getMinutes()).padStart(2, "0");
      const ss = String(new Date().getSeconds()).padStart(2, "0");
      setHeader(h => ({ ...h, InwardTime: `${hh}:${mm}:${ss}`, OutwardTime: "" }));
    }
    if (mode === "outward") {
      setHeader(h => ({ ...h, OutwardTime: "" }));
    }
  }, [mode]);

  useEffect(() => {
    if (header.GateEntryDate) {
      const year = header.GateEntryDate.slice(0, 4);
      setHeader(prev => ({ ...prev, FiscalYear: year }));
    }
  }, [header.GateEntryDate]);

  // ============================================
  // JSX Render
  // ============================================
  return (
    <div className="create-header-container">
      <h2 className="page-title">
        {mode === "inward" ? "Create Gate Entry (Inward)" : 
         mode === "outward" ? "Create Gate Entry (Outward)" : 
         "Create Gate Entry"}
      </h2>

      <form onSubmit={handleSubmit}>
        <section className="form-section">
          <h3 className="section-title">Header Information</h3>
          <div className="grid-3-cols">
            <div className="form-group">
              <label className="form-label">Gate Entry Number *</label>
              <input
                className="form-input"
                name="GateEntryNumber"
                value={header.GateEntryNumber}
                readOnly
                placeholder="Gate Entry Number"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Gate Entry Date *</label>
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
                <option value="2">MM</option>
              </select>
            </div>

            {/* ... rest of header fields ... */}
            {/* Keep your existing header fields exactly as they were */}
            
            <div className="form-group">
              <label className="form-label">Vehicle Number *</label>
              <input
                className="form-input"
                name="VehicleNumber"
                value={header.VehicleNumber}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Transporter Code</label>
              <input
                className="form-input"
                name="TransporterCode"
                value={header.TransporterCode}
                onChange={handleChange}
              />
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
              <label className="form-label">LR/GC Number</label>
              <input
                className="form-input"
                name="LRGCNumber"
                value={header.LRGCNumber}
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
              <label className="form-label">Sub Transporter Name</label>
              <input
                className="form-input"
                name="SubTransporterName"
                value={header.SubTransporterName}
                onChange={handleChange}
              />
            </div>

            <div className="form-group form-group-checkbox">
              <input type="checkbox" className="form-checkbox" name="EWayBill" checked={header.EWayBill} onChange={handleChange} />
              <label className="form-checkbox-label">E-Way Bill</label>
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
              <label className="form-label">Outward Time</label>
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
          <h3 className="section-title">Purchase Order Details</h3>
          {Array.from({ length: 5 }).map((_, idx) => {
            const suffix = idx === 0 ? "" : String(idx + 1);
            return (
              <div key={idx} className="po-entry-card">
                <h4 className="po-entry-title">Purchase Order Entry {idx + 1}</h4>
                <div className="grid-4-cols">
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label className="form-label">Purchase Order Number</label>
                    <div className="po-input-wrapper">
                      <input
                        className="form-input"
                        name={`PurchaseOrderNumber${suffix}`}
                        value={header[`PurchaseOrderNumber${suffix}`]}
                        onChange={(e) => handlePONumberChange(e, suffix)}
                        placeholder="Purchase Order Number"
                        style={{
                          paddingRight: poLoading[suffix] ? '40px' : '12px',
                          fontSize: '1.1em',
                          width: '240px',
                          minWidth: '120px',
                          maxWidth: '250px'
                        }}
                        autoComplete="off"
                      />
                      {poLoading[suffix] && (
                        <div className="po-loading-spinner" />
                      )}
                      {/* PO Dropdown */}
                      {poDropdown.show && poDropdown.suffix === suffix && poDropdown.poList.length > 0 && (
                        <div className="po-dropdown" style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          zIndex: 10,
                          background: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: 6,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                          minWidth: '240px',
                          maxHeight: '220px',
                          overflowY: 'auto',
                          marginTop: 2
                        }}>
                          {poDropdown.poList.map((po, i) => (
                            <div key={i} className="po-dropdown-item" style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              borderBottom: i < poDropdown.poList.length - 1 ? '1px solid #f3f4f6' : 'none',
                              background: '#fff'
                            }}
                              onClick={() => handleSelectPOFromDropdown(po)}
                            >
                              <div style={{ fontWeight: 600 }}>{po.PurchaseOrder}</div>
                              <div style={{ fontSize: '0.95em', color: '#444' }}>{po.Supplier} - {po.SupplierName}</div>
                              <div style={{ fontSize: '0.9em', color: '#666' }}>{po.PurchaseOrderDate ? new Date(po.PurchaseOrderDate).toLocaleDateString() : 'N/A'}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {header[`__POCompletedMsg${suffix}`] && (
                      <div className="po-completed-badge" style={{ color: '#b91c1c', fontWeight: 500, marginTop: 4 }}>
                        {header[`__POCompletedMsg${suffix}`]}
                      </div>
                    )}
                  </div>

                  {/* ... rest of PO fields (keep as is) ... */}
                  <div className="form-group">
                    <label className="form-label">Material Code</label>
                    <input
                      className="form-input"
                      name={`Material${suffix}`}
                      value={header[`Material${suffix}`]}
                      onChange={handleChange}
                      readOnly
                      style={{ backgroundColor: '#f3f4f6' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Material Description</label>
                    <input
                      className="form-input"
                      name={`MaterialDescription${suffix}`}
                      value={header[`MaterialDescription${suffix}`]}
                      onChange={handleChange}
                      readOnly
                      style={{ backgroundColor: '#f3f4f6' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Code</label>
                    <input
                      className="form-input"
                      name={`Vendor${suffix}`}
                      value={header[`Vendor${suffix}`]}
                      onChange={handleChange}
                      readOnly
                      style={{ backgroundColor: '#f3f4f6' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Name</label>
                    <input
                      className="form-input"
                      name={`VendorName${suffix}`}
                      value={header[`VendorName${suffix}`]}
                      onChange={handleChange}
                      readOnly
                      style={{ backgroundColor: '#f3f4f6' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Invoice No</label>
                    <input
                      className="form-input"
                      name={`VendorInvoiceNumber${suffix}`}
                      value={header[`VendorInvoiceNumber${suffix}`]}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Invoice Date</label>
                    <input
                      className="form-input"
                      name={`VendorInvoiceDate${suffix}`}
                      value={header[`VendorInvoiceDate${suffix}`]}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Invoice Weight</label>
                    <input
                      className="form-input"
                      name={`VendorInvoiceWeight${suffix}`}
                      type="text"
                      inputMode="decimal"
                      value={header[`VendorInvoiceWeight${suffix}`]}
                      onChange={handleChange}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">PO Balance Quantity</label>
                    <input
                      className="form-input"
                      name={`BalanceQty${suffix}`}
                      type="text"
                      inputMode="decimal"
                      value={header[`BalanceQty${suffix}`]}
                      onChange={handleChange}
                      placeholder="0.000"
                      readOnly={toNum(header[`BalanceQty${suffix}`]) === 0}
                      style={toNum(header[`BalanceQty${suffix}`]) === 0 ? { backgroundColor: '#ffe5e5' } : {}}
                    />
                    {toNum(header[`BalanceQty${suffix}`]) === 0 && (
                      <span className="po-completed-badge">
                        Completed: No remaining quantity
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <div className="form-actions">
          <button
            type="submit"
            disabled={loading}
            className={`btn btn-primary ${loading ? 'disabled' : ''}`}
          >
            {loading
              ? (isUpdateMode ? "Updating..." : "Creating...")
              : isUpdateMode
                ? "Update Gate Entry"
                : (mode === "inward"
                  ? "Create Inward Entry"
                  : mode === "outward"
                    ? "Create Outward Entry"
                    : "Create Gate Entry")}
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="btn btn-secondary"
          >
            Reset Form
          </button>

          <button
            type="button"
            onClick={handleLoadForUpdate}
            className="btn btn-info"
            style={{ marginLeft: 8 }}
            disabled={loading || !header.GateEntryNumber}
          >
            Load for Update
          </button>
        </div>
      </form>

      {/* PO dropdown is now inline under the input, not a modal */}

      {/* ============================================
          MODAL 2: Line Items Selection (Second Step)
      ============================================ */}
      {poItemsModal.show && (
        <div className="modal-overlay" onClick={closePOItemsModal}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select Line Item - PO: {poItemsModal.poNumber}</h3>
              <p className="modal-subtitle">{poItemsModal.items.length} line item(s) available</p>
              <button className="modal-close" onClick={closePOItemsModal}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="table-container">
                <table className="po-items-table">
                  <thead>
                    <tr>
                      <th>Item No</th>
                      <th>Material</th>
                      <th>Description</th>
                      <th>Order Qty</th>
                      <th>Unit</th>
                      <th>Remaining</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poItemsModal.items.map((item, index) => {
                      const material = item.Material || item.material || '';
                      const remaining = getRemainingFor(poItemsModal.poNumber, material);
                      const orderQty = toNum(item.OrderQuantity || item.orderQuantity);
                      
                      return (
                        <tr key={index} className={remaining === 0 ? 'row-completed' : ''}>
                          <td>{item.PurchaseOrderItem || item.purchaseOrderItem || index + 1}</td>
                          <td>{material}</td>
                          <td title={item.PurchaseOrderItemText || item.MaterialDescription || item.materialDescription || '-'}>
                            {item.PurchaseOrderItemText || item.MaterialDescription || item.materialDescription || '-'}
                          </td>
                          <td>{orderQty.toLocaleString()}</td>
                          <td>{item.OrderQuantityUnit || item.PurchaseOrderQuantityUnit || 'KG'}</td>
                          <td>
                            {Number.isFinite(remaining) ? (
                              <span className={remaining === 0 ? 'badge-completed' : 'badge-available'}>
                                {remaining.toLocaleString()}
                              </span>
                            ) : (
                              <span className="badge-unknown">Unknown</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`btn-select-item ${remaining === 0 ? 'disabled' : ''}`}
                              onClick={() => handleSelectPOItem(item)}
                              disabled={remaining === 0}
                              title={remaining === 0 ? 'Item fully consumed' : 'Select this item'}
                            >
                              {remaining === 0 ? 'Completed' : 'Select'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="success-message">
          <div className="success-header">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <h3>Gate Entry Created Successfully!</h3>
          </div>
          <div className="success-content">
            <p>Gate Entry Number: <strong>{lastCreated?.gateEntryNumber || header.GateEntryNumber}</strong></p>
            <p>Date: {lastCreated?.date || header.GateEntryDate}</p>
            <p>Vehicle: {lastCreated?.vehicle || header.VehicleNumber}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Utility functions (keep at bottom)
const poKey = (poNo, material) => `${String(poNo || '').trim()}__${String(material || '').trim()}`;

const getRemainingMap = () => {
  try { return JSON.parse(localStorage.getItem('poRemainingMap') || '{}'); }
  catch { return {}; }
};

const getRemainingFor = (poNo, material) => {
  const map = getRemainingMap();
  const v = map[poKey(poNo, material)];
  return typeof v === 'number' ? v : (v != null ? Number(v) : null);
};

const setRemainingFor = (poNo, material, qty) => {
  try {
    const map = getRemainingMap();
    const key = poKey(poNo, material);
    if (!Number.isFinite(qty) || qty <= 0) {
      delete map[key];
    } else {
      map[key] = qty;
    }
    localStorage.setItem('poRemainingMap', JSON.stringify(map));
  } catch {}
};

const toNum = (val) => {
  if (val === '' || val === null || val === undefined) return NaN;
  const n = Number(String(val).replace(',', '.').trim());
  return Number.isFinite(n) ? n : NaN;
};