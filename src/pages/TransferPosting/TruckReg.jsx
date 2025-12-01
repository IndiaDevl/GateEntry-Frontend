import React, { useState, useEffect, useRef } from "react";
import { initialRegistration, fetchInitialRegistrations, updateInitialRegistration, fetchSalesOrderSuggestions } from "../../api";
import { useLocation } from "react-router-dom";
//import "./InitialReg.css";

export default function InitialRegistration() {
  const location = useLocation();

  // Always initialize all fields as string or number (never undefined/null)
  const initialFormState = {
    VehicleNumber: "",
    Material: "",
    MaterialDescription: "",
    MaterialGrade: "",
    Plant: "",
    Vendor: "",
    Transporter: "",
    SAP_Description: ""
  };

  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);

  // List state
  const [showList, setShowList] = useState(false);
  const [rows, setRows] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");
  const [count, setCount] = useState(null);

  // No SO suggestion state needed

  // Prefill from navigation state
  useEffect(() => {
    if (location.state?.initialData) {
      setFormData({
        ...initialFormState,
        ...location.state.initialData
      });
    }
  }, [location.state]);

  // No SO suggestion effect needed

  // No SO suggestion click effect needed

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
    try {
      const payload = {
        ...formData,
        Status: "Success"
      };
      await initialRegistration(payload);
      alert("Initial Registration Successful!");
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
      <h2>Truck Registration for Internal Transfer Posting</h2>
      <form onSubmit={handleSubmit} className="create-header-form">
        <div className="form-row-2col">
          <div className="form-group">
            <label>Truck Number</label>
            <input
              type="text"
              name="VehicleNumber"
              value={formData.VehicleNumber || ""}
              onChange={handleChange}
              autoComplete="off"
              required
            />
          </div>
          <div className="form-group">
            <label>Material</label>
            <input
              type="text"
              name="Material"
              value={formData.Material || ""}
              onChange={handleChange}
              required
            />
          </div>
        </div>
        <div className="form-row-2col">
          <div className="form-group">
            <label>Material Description</label>
            <input
              type="text"
              name="MaterialDescription"
              value={formData.MaterialDescription || ""}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Material Grade</label>
            <input
              type="text"
              name="MaterialGrade"
              value={formData.MaterialGrade || ""}
              onChange={handleChange}
              required
            />
          </div>
        </div>
        <div className="form-row-2col">
          <div className="form-group">
            <label>Plant</label>
            <input
              type="text"
              name="Plant"
              value={formData.Plant || ""}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Vendor</label>
            <input
              type="text"
              name="Vendor"
              value={formData.Vendor || ""}
              onChange={handleChange}
              required
            />
          </div>
        </div>
        <div className="form-row-2col">
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
                  <th>Truck Number</th>
                  <th>Material</th>
                  <th>Material Description</th>
                  <th>Material Grade</th>
                  <th>Plant</th>
                  <th>Vendor</th>
                  <th>Transporter</th>
                  <th>Remarks</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.SAP_UUID || r.SalesDocument2 || i}>
                    <td>{r.VehicleNumber || "-"}</td>
                    <td>{r.Material || "-"}</td>
                    <td>{r.MaterialDescription || "-"}</td>
                    <td>{r.MaterialGrade || "-"}</td>
                    <td>{r.Plant || "-"}</td>
                    <td>{r.Vendor || "-"}</td>
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

