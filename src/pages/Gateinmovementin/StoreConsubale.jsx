import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from "axios";
//import './CreateHeader.css';
 
export default function StoresConsumableDashboard() {
  const navigate = useNavigate();
 
  // Gate Entry Section
  const [gateInNumber, setGateInNumber] = useState('');
  const [fetchedData, setFetchedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gateMsg, setGateMsg] = useState("");
  const [gateMsgType, setGateMsgType] = useState("");
  const [recentEntries, setRecentEntries] = useState([]);
 
  // PO Section
  const [poNumber, setPoNumber] = useState("");
  const [poData, setPoData] = useState([]);
  const [receivedQty, setReceivedQty] = useState({});
  const [poMsg, setPoMsg] = useState("");
  const [poMsgType, setPoMsgType] = useState("");
 
  // Form fields for Stores & Consumable Entry (as per UI)
  const [form, setForm] = useState({
    GateEntryNumber: '',
    GateEntryDate: '',
    Series: '',
    VehicleNumber: '',
    TransporterName: '',
    DriverName: '',
    DriverPhoneNumber: '',
    VendorInvoiceNumber: '',
    VendorInvoiceDate: '',
    VendorInvoiceWeight: '',
    PermitNumber: '',
    Division: '',
    InwardTime: '',
    OutwardTime: '',
    Remarks: '',
    EWayBill: false,
  });
 
  // Fetch recent entries
  const fetchRecentEntries = useCallback(async () => {
    try {
      const filter = `$filter=startswith(GateEntryNumber,'252')&$orderby=SAP_CreatedDateTime desc&$top=10&$format=json`;
      const response = await axios.get(`http://localhost:4000/api/headers?${filter}`);
      const results = response.data?.d?.results || [];
      const entries = results.map(entry => ({
        gateEntryNumber: entry.GateEntryNumber,
        vehicleNumber: entry.VehicleNumber || 'No Vehicle',
        series: '252',
        gateEntryDate: entry.GateEntryDate
          ? new Date(parseInt(entry.GateEntryDate.match(/\d+/)[0])).toLocaleDateString()
          : '--'
      }));
      setRecentEntries(entries);
    } catch {
      setRecentEntries([]);
    }
  }, []);
 
  useEffect(() => {
    fetchRecentEntries();
  }, [fetchRecentEntries]);
 
  // Fetch gate entry details
  const handleFetchGateData = async () => {
    setGateMsg("");
    setGateMsgType("");
    setFetchedData(null);
 
    if (!gateInNumber.trim()) {
      setGateMsg('Please enter Gate Entry Number');
      setGateMsgType("error");
      return;
    }
 
    setLoading(true);
 
    try {
      const filter = `$filter=GateEntryNumber eq '${gateInNumber}'&$format=json`;
      const response = await axios.get(`http://localhost:4000/api/headers?${filter}`);
      const results = response.data?.d?.results || [];
 
      if (results.length === 0) {
        setGateMsg(`Gate entry "${gateInNumber}" not found.`);
        setGateMsgType("error");
        return;
      }
 
      const gateEntry = results[0];
 
      if (!gateEntry.GateEntryNumber.startsWith('252')) {
        setGateMsg('This is not a Stores & Consumable 252-series gate entry.');
        setGateMsgType("error");
        return;
      }
 
      const formatSapDate = (sapDate) => {
        if (!sapDate) return '--';
        if (sapDate.includes('/Date(')) {
          const timestamp = parseInt(sapDate.match(/\d+/)[0]);
          return new Date(timestamp).toLocaleDateString();
        }
        return new Date(sapDate).toLocaleDateString();
      };
 
      setFetchedData({
        GateEntryNumber: gateEntry.GateEntryNumber,
        GateEntryDate: formatSapDate(gateEntry.GateEntryDate),
        VehicleNumber: gateEntry.VehicleNumber || '--',
        TransporterName: gateEntry.TransporterName || '--',
        DriverName: gateEntry.DriverName || '--',
        DriverPhoneNumber: gateEntry.DriverPhoneNumber || '--',
        VendorInvoiceNumber: gateEntry.VendorInvoiceNumber || '--',
        VendorInvoiceDate: formatSapDate(gateEntry.VendorInvoiceDate),
        VendorInvoiceWeight: gateEntry.VendorInvoiceWeight || '--',
        Division: gateEntry.Division || '--',
        FiscalYear: gateEntry.FiscalYear || '--',
        Remarks: gateEntry.Remarks || '--'
      });
 
      setGateMsg('Gate entry details fetched successfully');
      setGateMsgType("success");
 
    } catch (error) {
      setGateMsg(`Error fetching gate entry: ${error.message}`);
      setGateMsgType("error");
    } finally {
      setLoading(false);
    }
  };
 
  // Fetch PO Details
  const fetchPO = async () => {
    setPoMsg("");
    setPoMsgType("");
    setPoData([]);
 
    if (!poNumber.trim()) {
      setPoMsg("Enter PO Number");
      setPoMsgType("error");
      return;
    }
 
    try {
      const res = await axios.get(
        `http://localhost:4000/api/po-details?poNumber=${poNumber}`
      );
 
      if (res.data.message) {
        setPoMsg(res.data.message);
        setPoMsgType("error");
      } else {
        setPoData(res.data);
        setPoMsg("PO details fetched successfully.");
        setPoMsgType("success");
      }
    } catch (err) {
      setPoMsg("Error fetching PO");
      setPoMsgType("error");
    }
  };
 
  // Update PO (PATCH)
  const updatePO = async (item) => {
    setPoMsg("");
    setPoMsgType("");
 
    const qty = Number(receivedQty[item.SAP_UUID] || 0);
    const currentRemainQty = Number(item.RemainQty);
 
    if (!qty || qty <= 0) {
      setPoMsg("❌ Enter received quantity greater than 0.");
      setPoMsgType("error");
      return;
    }
    if (qty > currentRemainQty) {
      setPoMsg(`❌ Received qty (${qty}) cannot exceed remaining qty (${currentRemainQty}).`);
      setPoMsgType("error");
      return;
    }
 
    try {
      const res = await axios.patch("http://localhost:4000/api/update-po", {
        SAP_UUID: item.SAP_UUID,
        RemainQty: currentRemainQty,
        ReceivedQty: qty,
      });
 
      setPoMsg(res.data.message);
      setPoMsgType("success");
 
      setReceivedQty(prev => {
        const newState = { ...prev };
        delete newState[item.SAP_UUID];
        return newState;
      });
 
      fetchPO();
    } catch (err) {
      const msg = err.response?.data?.error || "Error updating PO";
      setPoMsg(msg);
      setPoMsgType("error");
    }
  };
 
  return (
    <div className="dashboard-container">
 
      <button className="back-btn" onClick={() => navigate("/")}>
        <svg width="32" height="32" viewBox="0 0 24 24">
          <path d="M15 18l-6-6 6-6" stroke="#222" strokeWidth="2"
            fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Home
      </button>
 
      <h2>Stores & Consumable Dashboard</h2>
 
      <div className="dashboard-form">
        <input
          type="text"
          placeholder="Enter Gate Entry Number"
          value={gateInNumber}
          onChange={e => setGateInNumber(e.target.value.toUpperCase())}
        />
        <button onClick={handleFetchGateData} disabled={loading}>
          {loading ? "Fetching..." : "Fetch Data"}
        </button>
      </div>
 
      {gateMsg && (
        <div className={`dashboard-message ${gateMsgType}`}>
          {gateMsg}
        </div>
      )}
 
      {/* PO SECTION */}
      <div className="dashboard-form" style={{ marginTop: 30 }}>
        <input
          type="text"
          placeholder="Enter PO Number"
          value={poNumber}
          onChange={e => setPoNumber(e.target.value)}
        />
        <button onClick={fetchPO}>Fetch PO</button>
      </div>
 
      {poMsg && (
        <div className={`dashboard-message ${poMsgType}`}>
          {poMsg}
        </div>
      )}
 
      {poData.length > 0 && (
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Description</th>
              <th>Balance Qty</th>
              <th>Remain Qty</th>
              <th>Receive Qty</th>
              <th>Update</th>
            </tr>
          </thead>
          <tbody>
            {poData.map(item => (
              <tr key={item.SAP_UUID}>
                <td>{item.Material}</td>
                <td>{item.MaterialDescription}</td>
                <td>{item.BalanceQty}</td>
                <td>{item.RemainQty}</td>
                <td>
                  <input
                    type="number"
                    min="1"
                    max={Number(item.RemainQty)}
                    value={receivedQty[item.SAP_UUID] || ""}
                    onChange={e =>
                      setReceivedQty(prev => ({
                        ...prev,
                        [item.SAP_UUID]: e.target.value
                      }))
                    }
                  />
                </td>
                <td>
                  <button
                    onClick={() => updatePO(item)}
                    disabled={
                      !receivedQty[item.SSAP_UUID] ||
                      Number(receivedQty[item.SAP_UUID]) <= 0 ||
                      Number(receivedQty[item.SAP_UUID]) > Number(item.RemainQty)
                    }
                  >
                    Update SAP
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
 
    </div>
  );
}

