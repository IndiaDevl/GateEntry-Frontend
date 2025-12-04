import React, { useState, useEffect, useRef } from "react";
import { initialRegistration, fetchInitialRegistrations, updateInitialRegistration, fetchSalesOrderSuggestions } from "../../api";
import { useLocation } from "react-router-dom";
import "./InitialReg.css";

export default function InitialRegistration() {
  const location = useLocation();

  // Always initialize all fields as string or number (never undefined/null)
  const initialFormState = {
    RegistrationNumber: "",
    Indicators: "IR",
    SalesDocument2: "",
    ExpectedQty: "",
    VehicleNumber: "",
    Transporter: "",
    SAP_Description: ""
  };

  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // List state
  const [showList, setShowList] = useState(false);
  const [rows, setRows] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");
  const [count, setCount] = useState(null);

  // SO Suggestion state
  const [soSuggestions, setSoSuggestions] = useState([]);
  const [showSoSuggestions, setShowSoSuggestions] = useState(false);
  const soInputRef = useRef();

  // Prefill from navigation state
  useEffect(() => {
    if (location.state?.initialData) {
      setFormData({
        ...initialFormState,
        ...location.state.initialData
      });
    }
  }, [location.state]);

  // SO Suggestion handler
  useEffect(() => {
    const val = (formData.SalesDocument2 || "").trim();
    if (val.length < 2) {
      setSoSuggestions([]);
      setShowSoSuggestions(false);
      return;
    }
    let ignore = false;
    fetchSalesOrderSuggestions(val)
      .then(res => {
        if (!ignore) {
          setSoSuggestions(res.data || []);
          setShowSoSuggestions(true);
        }
      })
      .catch(() => setSoSuggestions([]));
    return () => { ignore = true; };
  }, [formData.SalesDocument2]);

  // Hide suggestions on outside click
  useEffect(() => {
    function handleClick(e) {
      if (soInputRef.current && !soInputRef.current.contains(e.target)) {
        setShowSoSuggestions(false);
      }
    }
    if (showSoSuggestions) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showSoSuggestions]);

  // Handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value === undefined || value === null ? "" : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg("");
    try {
      const payload = {
        ...formData,
        Status: "Success"
      };
      const res = await initialRegistration(payload);
      // Get RegistrationNumber from backend response
      const regNumber = res?.data?.RegistrationNumber || "";
      setSuccessMsg(`Initial Registration Successfully!\nSalesOrder Number: ${formData.SalesDocument2} | Vehicle: ${formData.VehicleNumber} | Initial Reg Number: ${regNumber}`);
      setFormData(initialFormState);
      if (showList) loadList({ search });
    } catch (error) {
      console.error("Initial Registration Error:", error);
      alert("Initial Registration Failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const loadList = async ({ search: s = "" } = {}) => {
    setListLoading(true);
    setListError("");
    try {
      const { data } = await fetchInitialRegistrations({
        top: 50,
        search: s,
        count: true
      });
      const results = data?.d?.results || [];
      setRows(results);
      setCount(data?.d?.__count ?? results.length);
    } catch (e) {
      setListError(e?.response?.data?.error || e.message || "Failed to load registrations");
    } finally {
      setListLoading(false);
    }
  };

  const toggleList = () => {
    const next = !showList;
    setShowList(next);
    if (next) {
      loadList({ search });
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadList({ search });
  };

  const handleReset = () => {
    setSearch("");
    loadList({ search: "" });
  };

  // Handler to cancel/update a registration to "Failed"
  const handleCancelRegistration = async (uuid, currentStatus) => {
    if (!uuid) {
      alert("Cannot update: missing UUID");
      return;
    }
    if (currentStatus === "Failed") {
      alert("This registration is already marked as Failed");
      return;
    }
    if (!window.confirm("Mark this registration as Failed?")) return;
    try {
      await updateInitialRegistration(uuid, { Status: "Failed" });
      alert("Registration marked as Failed");
      loadList({ search });
    } catch (e) {
      console.error("Cancel error:", e);
      alert("Failed to update status: " + (e?.response?.data?.error || e.message));
    }
  };

  return (
    <div className="create-header-container initial-reg-wrapper">
      <h2 className="initial-reg-title">Initial Registration</h2>
      {successMsg && (
        <div className="success-message" style={{marginBottom: 16, background: '#e6ffed', color: '#256029', padding: 12, borderRadius: 6, fontWeight: 500}}>
          {successMsg.split('\n').map((line, idx) => <div key={idx}>{line}</div>)}
        </div>
      )}
      <form onSubmit={handleSubmit} className="create-header-form">
        <div className="form-row-2col">
          <div className="form-group" ref={soInputRef} style={{ position: "relative" }}>
            <label>Sales Document</label>
            <input
              type="text"
              name="SalesDocument2"
              value={formData.SalesDocument2 || ""}
              onChange={handleChange}
              autoComplete="off"
              required
              onFocus={() => {
                if (soSuggestions.length > 0) setShowSoSuggestions(true);
              }}
            />
            {showSoSuggestions && soSuggestions.length > 0 && (
              <ul className="so-suggestion-list">
                {soSuggestions.map((s, i) => {
                  const soNumber = s.SalesDocument2 || s.SalesOrder || s.SalesDocument || "N/A";
                  const material = s.Material || (s.items && s.items[0]?.Material) || "";
                  const materialDesc = s.MaterialDescription || (s.items && s.items[0]?.MaterialDescription) || "";
                  const balanceQty = s.BalanceQty || (s.items && s.items[0]?.BalanceQty) || "";
                  return (
                    <li
                      key={soNumber + "_" + i}
                      onClick={() => {
                        setFormData(f => ({
                          ...f,
                          SalesDocument2: soNumber,
                          Customer: s.Customer || "",
                          CustomerName: s.CustomerName || "",
                          Material: material,
                          MaterialDescription: materialDesc,
                          BalanceQty: balanceQty || s.BalanceQty || ""
                        }));
                        setShowSoSuggestions(false);
                      }}
                    >
                      <div>
                        <strong>SalesDocument: {soNumber}</strong>
                        {s.Customer && <span style={{marginLeft:8}}>Customer: {s.Customer}</span>}
                        {s.CustomerName && <span style={{marginLeft:8}}>Name: {s.CustomerName}</span>}
                        {material && <span style={{marginLeft:8}}>Material: {material}</span>}
                        {materialDesc && <span style={{marginLeft:8}}>Desc: {materialDesc}</span>}
                        {balanceQty && <span style={{marginLeft:8}}>Balance Qty: {balanceQty}</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="form-group">
            <label>Expected Quantity</label>
            <input
              type="number"
              name="ExpectedQty"
              value={formData.ExpectedQty || ""}
              onChange={handleChange}
              required
              step="0.01"
            />
          </div>
        </div>
        <div className="form-row-2col">
          <div className="form-group">
            <label>Vehicle Number</label>
            <input
              type="text"
              name="VehicleNumber"
              value={formData.VehicleNumber || ""}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Transporter</label>
            <input
              type="text"
              name="Transporter"
              value={formData.Transporter || ""}
              onChange={handleChange}
              required
            />
          </div>
        </div>
        <div className="form-group">
          <label>Remarks</label>
          <input
            type="text"
            name="SAP_Description"
            value={formData.SAP_Description || ""}
            onChange={handleChange}
            required
          />
        </div>
        <div className="actions-row">
          <button
            type="submit"
            className="submit-button"
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={toggleList}
          >
            {showList ? "Hide Register Details" : "Register Details"}
          </button>
        </div>
      </form>
      {showList && (
        <div className="registration-list-panel">
          <h3 className="panel-title">Registered Entries</h3>
          <form onSubmit={handleSearchSubmit} className="search-bar">
            <input
              type="text"
              placeholder="Search Sales Doc / Vehicle / Transporter / Remarks..."
              value={search || ""}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="submit-button small">
              Search
            </button>
            <button
              type="button"
              className="secondary-button small"
              onClick={handleReset}
            >
              Reset
            </button>
          </form>
          {listLoading && <div className="loading-indicator">Loading...</div>}
          {listError && (
            <div className="error-message" style={{ marginBottom: 12 }}>
              {listError}
            </div>
          )}
          {count != null && !listLoading && (
            <div className="count-text">Total: {count}</div>
          )}
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sales Document</th>
                  <th>Expected Qty</th>
                  <th>Vehicle</th>
                  <th>Transporter</th>
                  <th>Remarks</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.SAP_UUID || r.SalesDocument2 || i}>
                    <td>{r.SalesDocument2 || "-"}</td>
                    <td>{r.ExpectedQty || "-"}</td>
                    <td>{r.VehicleNumber || "-"}</td>
                    <td>{r.Transporter || "-"}</td>
                    <td>{r.SAP_Description || "-"}</td>
                    <td>
                      <span className={`status-badge status-${(r.Status || 'Success').toLowerCase()}`}>
                        {r.Status || "Success"}
                      </span>
                    </td>
                    <td>
                      {r.Status !== "Failed" && (
                        <button
                          type="button"
                          className="cancel-button"
                          onClick={() => handleCancelRegistration(r.SAP_UUID, r.Status)}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!listLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-row">
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

