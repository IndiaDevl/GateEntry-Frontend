// Version 4 Automatic time and date working fine
import React, { useState, useEffect } from "react";
import { createHeader, fetchNextGateNumber, fetchPurchaseOrderByNumber } from "../../api";
import { useLocation } from "react-router-dom";
import "./CreateHeader.css";


export default function CreateHeader() {
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
  const createInitialHeaderState = () => {
    const initialState = {
      // Header fields
      GateEntryNumber: "",
      GateEntryDate: currentDate,
      Indicators: "I",
      VehicleNumber: "",
      TransporterCode: "",
      TransporterName: "",
      DriverName: "",
      DriverPhoneNumber: "",
      LRGCNumber: "",
      PermitNumber: "",
      EWayBill: false,
      Division: "",
      Remarks: "",
      SubTransporterName: "",
      FiscalYear: currentYear,

      // automatic timestamps
      InwardTime: new Date().toISOString().includes('T')
        ? `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}:${new Date().getSeconds().toString().padStart(2, '0')}`
        : '',
      OutwardTime: new Date().toISOString().includes('T')
        ? `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}:${new Date().getSeconds().toString().padStart(2, '0')}`
        : '',
      SAP_CreatedDateTime: new Date().toISOString(),
    };

    // Add PO fields dynamically
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
  
  // New state for PO item selection
  const [poItemsModal, setPoItemsModal] = useState({
    show: false,
    items: [],
    suffix: '',
    poNumber: '',
    headerData: null
  });

  const [lastCreated, setLastCreated] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Special handling for numeric fields to allow decimals
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

  // NEW: Handle PO Number Change with Item Selection
  const handlePONumberChange = async (e, suffix) => {
    const { value } = e.target;
    const poFieldName = `PurchaseOrderNumber${suffix}`;
    setHeader(prev => ({ ...prev, [poFieldName]: value }));

    // If PO number is empty, clear related fields
    if (!value || value.trim() === '') {
      setHeader(prev => ({
        ...prev,
        [`Material${suffix}`]: '',
        [`MaterialDescription${suffix}`]: '',
        [`Vendor${suffix}`]: '',
        [`VendorName${suffix}`]: '',
        [`BalanceQty${suffix}`]: ''
      }));
      return;
    }

    setPoLoading(prev => ({ ...prev, [suffix]: true }));

    try {
      // If value is short, fetch a list of matching POs
      if (value.length < 4) {
        // You need a backend endpoint like /api/po-suggestions?query=xx
        const response = await fetchPurchaseOrderSuggestions(value);
        // Show a modal or dropdown for user to pick a PO
        setPoItemsModal({
          show: true,
          items: response.data.items || [],
          suffix,
          poNumber: value,
          headerData: null
        });
        return;
      }

      // Otherwise, fetch the full PO details as before
      const response = await fetchPurchaseOrderByNumber(value);
      const poData = response.data;
      
      console.log('PO Data received:', poData);
      
      const items = poData.items || [];

      const availableItems = items.filter((it) => {
        const mat = it.Material || it.material || '';
        const rem = getRemainingFor(value, mat);
        // If we have a stored remaining and it's <= 0, hide it
        return !(Number.isFinite(rem) && rem <= 0);
      });

      if (availableItems.length === 0) {
        alert(`All items for PO ${value} are completed (remaining 0).`);
        setPoLoading(prev => ({ ...prev, [suffix]: false }));
        return;
      }

      // If only one available item, auto-fill; else open modal with filtered list
      if (availableItems.length === 1) {
        fillPOFields(suffix, availableItems[0], poData);
      } else {
        setPoItemsModal({
          show: true,
          items: availableItems,
          suffix,
          poNumber: value,
          headerData: poData
        });
      }
      
    } catch (err) {
      console.error('Error fetching PO details:', err);
      const errorMsg = err?.response?.data?.error || err?.message || 'Failed to fetch PO details';
      alert(`Error loading PO: ${errorMsg}`);
    } finally {
      setPoLoading(prev => ({ ...prev, [suffix]: false }));
    }
  };

  // NEW: Fill PO fields with selected item data
  const fillPOFields = (suffix, item, headerData) => {
    const supplierCode = headerData?.Supplier || headerData?.supplier || '';
    const supplierName = headerData?.SupplierName || headerData?.supplierName || '';

    const material = item.Material || item.material || '';
    const materialDesc = item.PurchaseOrderItemText || item.MaterialDescription || item.materialDescription || '';
    const orderQtyNum = toNum(item.OrderQuantity || item.orderQuantity);

    setHeader(prev => {
      const poNo =
        prev[`PurchaseOrderNumber${suffix}`] ||
        headerData?.PurchaseOrder || headerData?.purchaseOrder || '';

      const storedRemaining = getRemainingFor(poNo, material);
      // initialRemaining: prefer stored; else use PO order qty; else blank
      const initialRemaining =
        Number.isFinite(storedRemaining) ? storedRemaining :
        (Number.isFinite(orderQtyNum) ? orderQtyNum : '');

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

  // NEW: Handle PO Item Selection from Modal
  const handleSelectPOItem = (item) => {
    fillPOFields(poItemsModal.suffix, item, poItemsModal.headerData);
    setPoItemsModal({ show: false, items: [], suffix: '', poNumber: '', headerData: null });
  };

  // NEW: Close Modal
  const closeModal = () => {
    setPoItemsModal({ show: false, items: [], suffix: '', poNumber: '', headerData: null });
  };


  // Only update FiscalYear when GateEntryDate changes
  useEffect(() => {
    if (header.GateEntryDate) {
      const year = header.GateEntryDate.slice(0, 4);
      setHeader(prev => ({ ...prev, FiscalYear: year }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header.GateEntryDate]);

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

    // Validation: check remaining quantities vs entered weights
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
      // Only generate GateEntryNumber on Save
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

      // Snapshot details BEFORE reset so they show in success message
      setLastCreated({
        gateEntryNumber: gateEntryNumber,
        date: header.GateEntryDate,
        vehicle: header.VehicleNumber
      });

      // Persist updated PO remaining locally
      for (let i = 1; i <= 5; i++) {
        const s = i === 1 ? '' : String(i);
        const poNo = header[`PurchaseOrderNumber${s}`];
        const material = header[`Material${s}`];
        if (!poNo || !material) continue;

        const prevRemainingStored = getRemainingFor(poNo, material);
        const formBalance = toNum(header[`BalanceQty${s}`]); // what the form shows now
        const received = toNum(header[`VendorInvoiceWeight${s}`]); // prioritize this

        const prevRemaining = Number.isFinite(prevRemainingStored)
          ? prevRemainingStored
          : (Number.isFinite(formBalance) ? formBalance : NaN);

        if (!Number.isFinite(prevRemaining)) continue;

        let consumed = 0;
        if (Number.isFinite(received) && received > 0) {
          consumed = received;
        } else if (Number.isFinite(formBalance) && formBalance < prevRemaining) {
          consumed = prevRemaining - formBalance; // user manually reduced balance
        }

        const newRemaining = Math.max(0, prevRemaining - consumed);
        setRemainingFor(poNo, material, newRemaining);
      }

      // Optionally clear success after a few seconds
      setTimeout(() => setResult(null),20000);

      // IMPORTANT: reset fields but KEEP the success message
      resetForm({ keepMessages: true });
    } catch (err) {
      console.error('Submit error - full response:', err?.response?.data || err);
      const msg = extractErrorMessage(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = (opts = { keepMessages: false }) => {
    setHeader(createInitialHeaderState());
    setError(null);
    if (!opts.keepMessages) {
      setResult(null);
      setLastCreated(null);
    }
  };

  // detect mode from URL path (inward / outward)
  const location = useLocation();
  const pathTail = location.pathname.split("/").pop(); // "inward" or "outward" or "create"
  const mode = pathTail === "inward" ? "inward" : (pathTail === "outward" ? "outward" : "default");

  // if mode is inward, ensure OutwardTime is null and InwardTime set to current HH:mm:ss
  useEffect(() => {
    if (mode === "inward") {
      const hh = String(new Date().getHours()).padStart(2, "0");
      const mm = String(new Date().getMinutes()).padStart(2, "0");
      const ss = String(new Date().getSeconds()).padStart(2, "0");
      setHeader(h => ({ ...h, InwardTime: `${hh}:${mm}:${ss}`, OutwardTime: "" }));
    }
    if (mode === "outward") {
      // For outward you might want to leave InwardTime and set OutwardTime at submit
      setHeader(h => ({ ...h, OutwardTime: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // update the title shown to user
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
                {/* <option value="1">SD Series</option> */}
                <option value="2">MM</option>
              </select>
            </div>

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
              <label className="form-label">Outward Time (will be set at submit)</label>
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
                <h4 className="po-entry-title">PO Entry {idx + 1}</h4>
                <div className="grid-4-cols">
                  <div className="form-group">
                    <label className="form-label">PO Number</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="form-input"
                        name={`PurchaseOrderNumber${suffix}`}
                        value={header[`PurchaseOrderNumber${suffix}`]}
                        onChange={(e) => handlePONumberChange(e, suffix)}
                        placeholder="Enter PO and press Tab"
                        style={{
                          paddingRight: poLoading[suffix] ? '40px' : '12px'
                        }}
                      />
                      {poLoading[suffix] && (
                        <div style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: '20px',
                          height: '20px',
                          border: '2px solid #3b82f6',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite'
                        }} />
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Material</label>
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
                    <label className="form-label">Vendor</label>
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
                    <label className="form-label">Balance Quantity (from PO)</label>
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
                      <span style={{ color: 'red', fontSize: '12px' }}>
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

      {/* PO Items Selection Modal */}
      {poItemsModal.show && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select PO Line Item - PO: {poItemsModal.poNumber}</h3>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <div className="modal-body">
              <table className="po-items-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Material</th>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th>Unit</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {poItemsModal.items.map((item, index) => (
                    <tr key={index}>
                      <td>{item.PurchaseOrderItem || item.purchaseOrderItem || index + 1}</td>
                      <td>{item.Material || item.material || '-'}</td>
                      <td>{item.PurchaseOrderItemText || item.MaterialDescription || item.materialDescription || '-'}</td>
                      <td>{item.OrderQuantity || item.orderQuantity || '0'}</td>
                      <td>{item.OrderQuantityUnit || item.PurchaseOrderQuantityUnit || 'KG'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-select-item"
                          onClick={() => handleSelectPOItem(item)}
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

// Local persistence for remaining qty per PO + Material (browser-only, no backend change)
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
      delete map[key]; // 0 or invalid → treat as completed; don't auto-fill next time
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
