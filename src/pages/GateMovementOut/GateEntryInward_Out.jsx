// Vehicle Out (Departure) screen: load by Gate Entry Number, show details, and save only OutwardTime
import React, { useState, useEffect } from "react";
import api, { fetchGateEntryByNumber } from "../../api";
import "./GateOutHome.css";

export default function GateEntryOutwardCompletion() {
  const currentDate = new Date().toISOString().split("T")[0];

  // --- helpers ---
  const formatTimeToSapDuration = (date = new Date()) => {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `PT${hh}H${mm}M${ss}S`;
  };

  const hhmmssNow = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  };

  const hhmmssToSapDuration = (val) => {
    if (!val) return null;
    if (typeof val === "string" && /^\d{2}:\d{2}:\d{2}$/.test(val)) {
      const [h, m, s] = val.split(":").map((v) => parseInt(v, 10));
      return `PT${h}H${m}M${s}S`;
    }
    if (val instanceof Date) return formatTimeToSapDuration(val);
    return String(val);
  };

  const sapDurationToHHMMSS = (val) => {
    if (!val) return "";
    if (typeof val === "string" && val.startsWith("PT")) {
      const mh = val.match(/(\d+)H/);
      const mm = val.match(/(\d+)M/);
      const ms = val.match(/(\d+)S/);
      const h = String(mh ? parseInt(mh[1], 10) : 0).padStart(2, "0");
      const m = String(mm ? parseInt(mm[1], 10) : 0).padStart(2, "0");
      const s = String(ms ? parseInt(ms[1], 10) : 0).padStart(2, "0");
      return `${h}:${m}:${s}`;
    }
    return val;
  };

  const extractGuid = (rec) => {
    if (!rec) return null;
    if (rec.SAP_UUID) return rec.SAP_UUID;
    if (rec.ID) return rec.ID;
    if (rec.Guid) return rec.Guid;
    if (rec.GUID) return rec.GUID;
    const idUrl = rec.__metadata?.id || rec.__metadata?.uri;
    if (idUrl) {
      const m = String(idUrl).match(/\(guid'([0-9a-fA-F-]{36})'\)/);
      if (m) return m[1];
    }
    return null;
  };

  // Try to map possible backend field variants into UI fields
  const hydrateHeaderFromSap = (r) => {
    const base = {
      GateEntryNumber: r.GateEntryNumber || "",
      GateEntryDate: (r.GateEntryDate || "").slice(0, 10) || currentDate,
      VehicleNumber: r.VehicleNumber || "",
      TransporterName: r.TransporterName || "",
      DriverName: r.DriverName || "",
      DriverPhoneNumber: r.DriverPhoneNumber || "",
      PermitNumber: r.PermitNumber || "",
      EWayBill: Boolean(r.EWayBill),
      Division: r.Division || "",
      Remarks: r.Remarks || "",
      FiscalYear: r.FiscalYear || String(new Date().getFullYear()),
      InwardTime: sapDurationToHHMMSS(r.InwardTime) || "",
      OutwardTime: sapDurationToHHMMSS(r.OutwardTime) || "",
    };

    // Map 5 possible PO blocks. Support multiple naming variants.
    for (let i = 1; i <= 5; i++) {
      const s = i === 1 ? "" : String(i);
      base[`PurchaseOrderNumber${s}`] =
        r[`PurchaseOrderNumber${s}`] ||
        r[`VendorPONumber${s}`] ||
        r[`PONumber${s}`] ||
        "";
      base[`Material${s}`] =
        r[`Material${s}`] ||
        r[`VendorMaterial${s}`] ||
        "";
      base[`MaterialDescription${s}`] =
        r[`MaterialDescription${s}`] ||
        r[`VendorMatDescription${s}`] ||
        "";
      base[`Vendor${s}`] =
        r[`Vendor${s}`] ||
        r[`VendorCode${s}`] ||
        "";
      base[`VendorName${s}`] = r[`VendorName${s}`] || "";
      base[`VendorInvoiceNumber${s}`] =
        r[`VendorInvoiceNumber${s}`] ||
        r[`VendorInvoiceNo${s}`] ||
        "";
      base[`VendorInvoiceWeight${s}`] = r[`VendorInvoiceWeight${s}`] ?? "";
      base[`BalanceQty${s}`] = r[`BalanceQty${s}`] ?? "";
    }
    return base;
  };

  // --- state ---
  const createInitialHeaderState = () => {
    const initialState = {
      GateEntryNumber: "",
      GateEntryDate: currentDate,
      VehicleNumber: "",
      TransporterName: "",
      DriverName: "",
      DriverPhoneNumber: "",
      PermitNumber: "",
      EWayBill: false,
      Division: "",
      Remarks: "",
      FiscalYear: String(new Date().getFullYear()),
      InwardTime: "",
      OutwardTime: "",
    };
    for (let i = 1; i <= 5; i++) {
      const s = i === 1 ? "" : String(i);
      initialState[`PurchaseOrderNumber${s}`] = "";
      initialState[`Material${s}`] = "";
      initialState[`MaterialDescription${s}`] = "";
      initialState[`Vendor${s}`] = "";
      initialState[`VendorName${s}`] = "";
      initialState[`VendorInvoiceNumber${s}`] = "";
      initialState[`VendorInvoiceWeight${s}`] = "";
      initialState[`BalanceQty${s}`] = "";
    }
    return initialState;
  };

  const [header, setHeader] = useState(createInitialHeaderState());
  const [searchNumber, setSearchNumber] = useState("");
  const [loadedGuid, setLoadedGuid] = useState(null);

  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // No auto-generation for departure screen; only fiscal year sync
  useEffect(() => {
    if (header.GateEntryDate) {
      const year = header.GateEntryDate.slice(0, 4);
      setHeader((prev) => ({ ...prev, FiscalYear: year }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header.GateEntryDate]);

  const handleLoad = async (e) => {
    e?.preventDefault?.();
    setError(null);
    setResult(null);
    setLoading(true);
    setLoadedGuid(null);

    try {
      const key = (searchNumber || "").trim();
      if (!key) {
        setError("Enter a Gate Entry Number to search.");
        return;
      }
      const resp = await fetchGateEntryByNumber(key);
      const results = resp?.data?.d?.results || [];
      if (!results.length) {
        setError("No record found for the entered Gate Entry Number.");
        return;
      }
      const rec = results[0];
      const guid = extractGuid(rec);
      if (!guid) {
        setError("Could not determine record GUID. Adjust GUID extraction if needed.");
        return;
      }
      setLoadedGuid(guid);
      setHeader(hydrateHeaderFromSap(rec));
      // If no outward time yet, prefill with now for convenience
      if (!rec.OutwardTime) {
        setHeader((prev) => ({ ...prev, OutwardTime: hhmmssNow() }));
      }
    } catch (err) {
      setError(
        err?.response?.data?.error?.message?.value ||
          err?.message ||
          "Failed to load Gate Entry"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSetOutwardNow = () => {
    setHeader((prev) => ({ ...prev, OutwardTime: hhmmssNow() }));
  };

  const handleSaveOutward = async (e) => {
    e?.preventDefault?.();
    setError(null);
    setResult(null);

    if (!loadedGuid) {
      setError("Load a Gate Entry first.");
      return;
    }

    if (header?.OutwardTime && header?.OutwardTime.length && header?.OutwardTime.startsWith("PT")) {
      // if somehow duration is in state, convert to HH:mm:ss for consistent UX
      setHeader((prev) => ({ ...prev, OutwardTime: sapDurationToHHMMSS(prev.OutwardTime) }));
    }

    setUpdating(true);
    try {
      // ONLY send OutwardTime - do NOT send SAP_ModifiedDateTime or any other fields
      const payload = {
        OutwardTime: hhmmssToSapDuration(header.OutwardTime || hhmmssNow()),
      };
      
      console.log('[DEBUG] Sending PATCH with payload:', payload);
      
      const resp = await api.patch(`/headers/${loadedGuid}`, payload);
      if (resp.status >= 200 && resp.status < 300) {
        setResult("Outward time saved. Vehicle marked departed.");
        // Update local state with the new outward time
        setHeader(prev => ({ ...prev, OutwardTime: header.OutwardTime }));
      } else {
        setError(`Unexpected status ${resp.status}`);
      }
    } catch (err) {
      const errMsg = err?.response?.data?.error?.message?.value ||
                     err?.response?.data?.error?.message ||
                     err?.response?.data?.message ||
                     err?.message ||
                     "Failed to save Outward Time";
      console.error('[ERROR] PATCH failed:', err?.response?.data);
      setError(errMsg);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="create-header-container">
      <h2 className="page-title">Complete Gate Entry (Vehicle Out)</h2>

      {/* Search bar */}
      <form onSubmit={handleLoad} className="form-section" style={{ marginBottom: 12 }}>
        <h3 className="section-title">Search</h3>
        <div className="grid-3-cols">
          <div className="form-group">
            <label className="form-label">Gate Entry Number</label>
            <input
              className="form-input"
              value={searchNumber}
              onChange={(e) => setSearchNumber(e.target.value)}
              placeholder="Enter Gate Entry Number (e.g. 2520000029)"
            />
          </div>
          <div className="form-group">
            <label className="form-label">&nbsp;</label>
            <button type="submit" disabled={loading} className={`btn btn-primary ${loading ? "disabled" : ""}`}>
              {loading ? "Loading..." : "Load Entry"}
            </button>
          </div>
        </div>
      </form>

      {/* Header Details - read-only */}
      <section className="form-section">
        <h3 className="section-title">Header Information</h3>
        <div className="grid-3-cols">
          <div className="form-group">
            <label className="form-label">Gate Entry Number</label>
            <input className="form-input" name="GateEntryNumber" value={header.GateEntryNumber} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Gate Entry Date</label>
            <input className="form-input" name="GateEntryDate" type="date" value={header.GateEntryDate} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Vehicle Number</label>
            <input className="form-input" name="VehicleNumber" value={header.VehicleNumber} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Transporter Name</label>
            <input className="form-input" name="TransporterName" value={header.TransporterName} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Driver Name</label>
            <input className="form-input" name="DriverName" value={header.DriverName} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Driver Phone</label>
            <input className="form-input" name="DriverPhoneNumber" value={header.DriverPhoneNumber} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Permit Number</label>
            <input className="form-input" name="PermitNumber" value={header.PermitNumber} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Division</label>
            <input className="form-input" name="Division" value={header.Division} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Inward Time</label>
            <input className="form-input" name="InwardTime" value={header.InwardTime} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Outward Time</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="form-input"
                name="OutwardTime"
                value={header.OutwardTime}
                readOnly
              />
              <button type="button" className="btn btn-secondary" onClick={handleSetOutwardNow}>
                Set Now
              </button>
            </div>
          </div>
          <div className="form-group full-width">
            <label className="form-label">Remarks</label>
            <textarea className="form-textarea" name="Remarks" value={header.Remarks} readOnly rows={2} />
          </div>
        </div>
      </section>

      {/* PO Details - read-only */}
      <section className="form-section">
        <h3 className="section-title">Purchase Order Details</h3>
        {Array.from({ length: 5 }).map((_, idx) => {
          const suffix = idx === 0 ? "" : String(idx + 1);
          const visible =
            header[`PurchaseOrderNumber${suffix}`] ||
            header[`Material${suffix}`] ||
            header[`MaterialDescription${suffix}`] ||
            header[`Vendor${suffix}`] ||
            header[`VendorName${suffix}`] ||
            header[`VendorInvoiceNumber${suffix}`] ||
            header[`VendorInvoiceWeight${suffix}`] ||
            header[`BalanceQty${suffix}`];
          if (!visible) return null;

          return (
            <div key={idx} className="po-entry-card">
              <h4 className="po-entry-title">PO Entry {idx + 1}</h4>
              <div className="grid-4-cols">
                <div className="form-group">
                  <label className="form-label">PO Number</label>
                  <input className="form-input" name={`PurchaseOrderNumber${suffix}`} value={header[`PurchaseOrderNumber${suffix}`]} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Material</label>
                  <input className="form-input" name={`Material${suffix}`} value={header[`Material${suffix}`]} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Material Description</label>
                  <input className="form-input" name={`MaterialDescription${suffix}`} value={header[`MaterialDescription${suffix}`]} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Vendor</label>
                  <input className="form-input" name={`Vendor${suffix}`} value={header[`Vendor${suffix}`]} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Vendor Name</label>
                  <input className="form-input" name={`VendorName${suffix}`} value={header[`VendorName${suffix}`]} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Vendor Invoice No</label>
                  <input className="form-input" name={`VendorInvoiceNumber${suffix}`} value={header[`VendorInvoiceNumber${suffix}`]} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Vendor Invoice Weight</label>
                  <input className="form-input" name={`VendorInvoiceWeight${suffix}`} value={header[`VendorInvoiceWeight${suffix}`]} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Balance Quantity</label>
                  <input className="form-input" name={`BalanceQty${suffix}`} value={header[`BalanceQty${suffix}`]} readOnly />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Actions */}
      <div className="form-actions">
        <button
          type="button"
          onClick={handleSaveOutward}
          disabled={updating || !loadedGuid}
          className={`btn btn-primary ${updating ? "disabled" : ""}`}
        >
          {updating ? "Saving..." : "Save Departure Time"}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="success-message">
          <div className="success-header">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
            <h3>{result}</h3>
          </div>
          <div className="success-content">
            <p>Gate Entry Number: <strong>{header.GateEntryNumber || "-"}</strong></p>
            <p>Vehicle: {header.VehicleNumber || "-"}</p>
            <p>Outward Time: {header.OutwardTime || "-"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
