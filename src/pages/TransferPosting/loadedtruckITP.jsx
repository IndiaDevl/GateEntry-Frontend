import React, { useState, useEffect } from "react";
import api, { fetchGateEntryByNumber, ITPPDFGenerate } from "../../api";
//import "./GateOutHome.css";

export default function GateEntryOutwardSD() {
  const todayISO = new Date().toISOString().split("T")[0];

  // --- time helpers ---
  const hhmmssNow = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  };
  const hhmmssToSapDuration = (val) => {
    if (!val) return null;
    if (typeof val === "string" && /^\d{2}:\d{2}:\d{2}$/.test(val)) {
      const [h, m, s] = val.split(":").map(Number);
      return `PT${h}H${m}M${s}S`;
    }
    return val;
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

  // --- GUID extraction ---
  const extractGuid = (rec) => {
    if (!rec) return null;
    return (
      rec.SAP_UUID ||
      rec.ID ||
      rec.Guid ||
      rec.GUID ||
      (() => {
        const idUrl = rec.__metadata?.id || rec.__metadata?.uri;
        if (idUrl) {
          const m = String(idUrl).match(/\(guid'([0-9a-fA-F-]{36})'\)/);
          return m ? m[1] : null;
        }
        return null;
      })()
    );
  };

  // helpers
  const first = (obj, keys) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return "";
  };

  // Try to build a materials array from common field patterns:
  // Material/MaterialDescription/Quantity/UOM/Batch with suffixes: "", "1".."10"
  const parseMaterials = (r = {}) => {
    const items = [];
    const suffixes = ["", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    for (const sfx of suffixes) {
      const code = first(r, [
        `Material${sfx}`,
        `SDMaterial${sfx}`,
        `ItemMaterial${sfx}`,
        `MatCode${sfx}`,
        `Material_Code${sfx}`,
      ]);
      const desc = first(r, [
        `MaterialDescription${sfx}`,
        `SDMaterialDescription${sfx}`,
        `ItemDescription${sfx}`,
        `MatDesc${sfx}`,
        `Material_Description${sfx}`,
      ]);
      const qty = first(r, [
        `Quantity${sfx}`,
        `Qty${sfx}`,
        `OrderQty${sfx}`,
        `DeliveryQty${sfx}`,
        `IssuedQty${sfx}`,
        `QtyIssued${sfx}`,
      ]);
      const uom = first(r, [
        `UOM${sfx}`,
        `Unit${sfx}`,
        `UnitOfMeasure${sfx}`,
        `BaseUOM${sfx}`,
      ]);
      const batch = first(r, [
        `Batch${sfx}`,
        `BatchNumber${sfx}`,
        `Lot${sfx}`,
      ]);

      // Consider it a valid row if at least code/desc/qty are present
      if (String(code || desc || qty).trim() !== "") {
        items.push({
          code: String(code || "").trim(),
          desc: String(desc || "").trim(),
          qty: String(qty || "").trim(),
          uom: String(uom || "").trim(),
          batch: String(batch || "").trim(),
        });
      }
    }
    return items;
  };

  // --- mapping only SD / dispatch related fields ---
  const hydrateFromSap = (r = {}) => {
    const base = {
      GateEntryNumber: r.GateEntryNumber || "",
      GateEntryDate: (r.GateEntryDate || "").slice(0, 10) || todayISO,
      VehicleNumber: r.VehicleNumber || r.TruckNumber || r.LorryNumber || "",
      TransporterName: r.TransporterName || r.Transporter || r.CarrierName || "",
      DriverName: r.DriverName || r.Driver || "",
      DriverPhoneNumber: r.DriverPhoneNumber || r.DriverMobile || r.DriverPhone || "",
      OutwardTime: sapDurationToHHMMSS(r.OutwardTime) || "",

      vendorITP: r.vendorITP || r.VendorITP || r.Vendor || "",
      MaterialITP: r.MaterialITP || r.MaterialsITP || "",
      MaterialDescription: r.MaterialDescription || "",
      MaterialGrade: r.MaterialGrade || "",
      Remarks: r.Remarks || "",
      SAP_Description: r.SAP_Description || "",
      Plant: r.Plant || "",
      qty: r.qty || r.Quantity || "",
//      Materials: parseMaterials(r),
    };
    return base;
  };

  const initialState = {
    GateEntryNumber: "",
    GateEntryDate: todayISO,
    VehicleNumber: "",
    TransporterName: "",
    DriverName: "",
    DriverPhoneNumber: "",
    OutwardTime: "",
    vendorITP: "",
    MaterialITP: "",
    MaterialGrade: "",
    Remarks: "",
    SAP_Description: "",
    Plant: "",
    Materials: [],
  };

  const [data, setData] = useState(initialState);
  const [searchNumber, setSearchNumber] = useState("");
  const [guid, setGuid] = useState(null);

  const [grossWeight, setGrossWeight] = useState("");
  const [tareWeight, setTareWeight] = useState("");
  const [netWeight, setNetWeight] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Keep (no fiscal year logic needed now)

  // Calculate net weight whenever gross or tare changes
  useEffect(() => {
    const gross = parseFloat(grossWeight) || 0;
    const tare = parseFloat(tareWeight) || 0;
    setNetWeight(gross && tare ? (gross - tare).toFixed(3) : "");
  }, [grossWeight, tareWeight]);

  const handleLoad = async (e) => {
    e?.preventDefault?.();
    setError(null);
    setResult(null);
    setLoading(true);
    setGuid(null);
    try {
      const key = (searchNumber || "").trim();
      if (!key) {
        setError("Enter a Gate Entry Number.");
        return;
      }
      const resp = await fetchGateEntryByNumber(key);
      const results = resp?.data?.d?.results || [];
      if (!results.length) {
        setError("No record found.");
        return;
      }
      const rec = results[0];
      const g = extractGuid(rec);
      if (!g) {
        setError("Record GUID not found.");
        return;
      }
      setGuid(g);
      const hydrated = hydrateFromSap(rec);
      // Prefill outward time if not existing
      if (!hydrated.OutwardTime) hydrated.OutwardTime = hhmmssNow();
      setData(hydrated);
      // If SAP has weights, prefill them
      setGrossWeight(rec.GrossWeight || "");
      setTareWeight(rec.TareWeight || "");
      setNetWeight(rec.NetWeight || "");
    } catch (err) {
      setError(
        err?.response?.data?.error?.message?.value ||
          err?.message ||
          "Failed to load record"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSetOutwardNow = () => {
    setData((prev) => ({ ...prev, OutwardTime: hhmmssNow() }));
  };

  const downloadPdf = async (uuid, payload = {}) => {
    try {
      const response = await ITPPDFGenerate(uuid, payload);
      // If using axios, response.data is a Blob only if you set responseType
      // So, update your API function to:
      // return api.post(`/headers/${id}/pdf`, payload, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Truck Internal Transfer Posting.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download PDF');
    }
  };

  const handleSaveOutward = async () => {
    setError(null);
    setResult(null);
    if (!guid) {
      setError("Load an entry first.");
      return;
    }
    // Normalize
    if (data.OutwardTime?.startsWith("PT")) {
      setData((prev) => ({ ...prev, OutwardTime: sapDurationToHHMMSS(prev.OutwardTime) }));
    }

    setSaving(true);
    try {
      const payload = {
        OutwardTime: hhmmssToSapDuration(data.OutwardTime || hhmmssNow()),
        GrossWeight: grossWeight,
        TareWeight: tareWeight,
        NetWeight: netWeight,
      };
      const resp = await api.patch(`/headers/${guid}`, payload);
      if (resp.status >= 200 && resp.status < 300) {
        setResult("Departure time and weights saved.");
        downloadPdf(guid);
      } else {
        setError(`Unexpected status ${resp.status}`);
      }
    } catch (err) {
      setError(
        err?.response?.data?.error?.message?.value ||
          err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save outward time"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="create-header-container">
      <h2 className="page-title">Vehicle Departure (SD Details)</h2>

      {/* Search */}
      <form onSubmit={handleLoad} className="form-section" style={{ marginBottom: 12 }}>
        <h3 className="section-title">Search Entry</h3>
        <div className="grid-3-cols">
          <div className="form-group">
            <label className="form-label">Internal Transfer Posting Entry</label>
            <input
              className="form-input"
              value={searchNumber}
              onChange={(e) => setSearchNumber(e.target.value)}
              placeholder="2550000001"
            />
          </div>
          <div className="form-group">
            <label className="form-label">&nbsp;</label>
            <button
              type="submit"
              disabled={loading}
              className={`btn btn-primary ${loading ? "disabled" : ""}`}
            >
              {loading ? "Loading..." : "Get Details"}
            </button>
          </div>
        </div>
      </form>

      {/* Core Details */}
      <section className="form-section">
        <h3 className="section-title">Vehicle / Gate Info</h3>
        <div className="grid-3-cols">
          <div className="form-group">
            <label className="form-label">Internal Transfer Posting Entry</label>
            <input className="form-input" value={data.GateEntryNumber} readOnly />
          </div>
          {/* <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={data.GateEntryDate} readOnly />
          </div> */}
          <div className="form-group">
            <label className="form-label">Truck Number</label>
            <input className="form-input" value={data.VehicleNumber} readOnly />
          </div>

          <div className="form-group">
            <label className="form-label">Outward Time</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="form-input" value={data.OutwardTime} readOnly />
              <button type="button" className="btn btn-secondary" onClick={handleSetOutwardNow}>
                Set Now
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Gross Weight</label>
            <input
              className="form-input"
              type="number"
              value={grossWeight}
              onChange={e => setGrossWeight(e.target.value)}
              placeholder="Gross Weight"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Tare Weight</label>
            <input
              className="form-input"
              type="number"
              value={tareWeight}
              onChange={e => setTareWeight(e.target.value)}
              placeholder="Tare Weight"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Net Weight</label>
            <input
              className="form-input"
              type="number"
              value={netWeight}
              readOnly
              placeholder="Net Weight"
            />
          </div>
        </div>
      </section>


      {/* Materials - always show, never hide, always render at least one row */}
      <section className="form-section">
        <h3 className="section-title">Details</h3>
        {(() => {
          let materials = Array.isArray(data.MaterialITP) ? data.MaterialITP : [];
          if (materials.length === 0) {
            materials = [{}]; // Always render at least one row
          }
          return materials.map((it, idx) => (
            <div key={idx} className="po-entry-card">
              <div className="grid-4-cols">
                <div className="form-group">
                  <label className="form-label">Material</label>
                  <input className="form-input" value={data.MaterialITP || ""} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Material Description</label>
                  <input className="form-input" value={data.MaterialDescription || ""} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Material Grade</label>
                  <input className="form-input" value={data.MaterialGrade || ""} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Vendor</label>
                  <input className="form-input" value={data.vendorITP || ""} readOnly />
                </div>
               <div className="form-group">
                  <label className="form-label">Plant</label>
                  <input className="form-input" value={data.Plant || ""} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input className="form-input" value={data.qty || ""} readOnly />
                </div>
               <div className="form-group full-width">
                <label className="form-label">Remarks</label>
                <textarea className="form-textarea" value={data.Remarks || ""} readOnly rows={2} />
               </div>
              <div className="form-group full-width">
                <label className="form-label">WB Remarks</label>
                <textarea className="form-textarea" value={data.SAP_Description || ""} readOnly rows={2} />
               </div>
                {/* <div className="form-group">
                  <label className="form-label">UOM</label>
                  <input className="form-input" value={it.uom || ""} readOnly />
                </div> */}
              </div>
              {it.batch && (
                <div className="grid-3-cols" style={{ marginTop: 8 }}>
                  <div className="form-group">
                    <label className="form-label">Batch</label>
                    <input className="form-input" value={it.batch} readOnly />
                  </div>
                </div>
              )}
            </div>
          ));
        })()}
      </section>

      {/* Action */}
      <div className="form-actions">
        <button
          type="button"
          onClick={handleSaveOutward}
          disabled={saving || !guid}
          className={`btn btn-primary ${saving ? "disabled" : ""}`}
        >
          {saving ? "Saving..." : "Save Departure"}
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
            <p>Gate Entry: <strong>{data.GateEntryNumber || "-"}</strong></p>
            <p>Vehicle: {data.VehicleNumber || "-"}</p>
            <p>Outward Time: {data.OutwardTime || "-"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

