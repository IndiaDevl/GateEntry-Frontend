// import React, { useState, useEffect, useRef } from "react";
// import { initialRegistration, fetchInitialRegistrations, updateInitialRegistration, fetchSalesOrderSuggestions, checkVehicleStatus } from "../../api";
// import { useLocation } from "react-router-dom";
// import "./InitialReg.css";

// export default function InitialRegistration() {
//     // RemainingQty state
//     const [remainingQty, setRemainingQty] = useState(null);
//   // Track available qty for validation
//   const [availableQty, setAvailableQty] = useState(null);
//   const location = useLocation();

//   // Always initialize all fields as string or number (never undefined/null)
//   const initialFormState = {
//     RegistrationNumber: "",
//     Indicators: "IR",
//     SalesDocument2: "",
//     ExpectedQty: "",
//     VehicleNumber: "",
//     Transporter: "",
//     SAP_Description: ""
//   };

//   const [formData, setFormData] = useState(initialFormState);
//   const [submitting, setSubmitting] = useState(false);
//   const [successMsg, setSuccessMsg] = useState("");

//   // List state
//   const [showList, setShowList] = useState(false);
//   const [rows, setRows] = useState([]);
//   const [listLoading, setListLoading] = useState(false);
//   const [listError, setListError] = useState("");
//   const [search, setSearch] = useState("");
//   const [count, setCount] = useState(null);

//   // SO Suggestion state
//   const [soSuggestions, setSoSuggestions] = useState([]);
//   const [showSoSuggestions, setShowSoSuggestions] = useState(false);
//   const soInputRef = useRef();

//   // Prefill from navigation state
//   useEffect(() => {
//     if (location.state?.initialData) {
//       setFormData({
//         ...initialFormState,
//         ...location.state.initialData
//       });
//     }
//   }, [location.state]);

//   // SO Suggestion handler
//   useEffect(() => {
//       const val = (formData.SalesDocument2 || "").trim();
//       if (val.length < 2) {
//         setSoSuggestions([]);
//         setShowSoSuggestions(false);
//         setRemainingQty(null);
//         return;
//       }
//       let ignore = false;
//       // Fetch SO suggestions and for each, fetch used qty and calculate remaining
//       fetchSalesOrderSuggestions(val)
//         .then(async res => {
//           if (!ignore) {
//             const suggestions = res.data || [];
//             // For each SO, fetch used qty and calculate remaining
//             const updatedSuggestions = await Promise.all(suggestions.map(async (s) => {
//               const soNumber = s.SalesDocument2 || s.SalesOrder || s.SalesDocument || "";
//               // Fetch registrations for this SO
//               try {
//                 const regRes = await fetchInitialRegistrations({ search: soNumber, top: 50 });
//                 const regResults = regRes?.data?.d?.results || [];
//                 const usedQty = regResults
//                   .filter(r => r.SalesDocument2 === soNumber || r.SalesDocument === soNumber)
//                   .reduce((sum, r) => sum + (Number(r.ExpectedQty) || 0), 0);
//                 const balanceQty = Number(s.BalanceQty || (s.items && s.items[0]?.BalanceQty) || 0);
//                 const remainingQty = balanceQty - usedQty;
//                 return { ...s, UsedQty: usedQty, RemainingQty: remainingQty };
//               } catch {
//                 return { ...s, UsedQty: 0, RemainingQty: Number(s.BalanceQty || (s.items && s.items[0]?.BalanceQty) || 0) };
//               }
//             }));
//             setSoSuggestions(updatedSuggestions);
//             setShowSoSuggestions(true);
//           }
//         })
//         .catch(() => setSoSuggestions([]));
//       // For the selected SO, fetch registrations and set remainingQty for display
//       fetchInitialRegistrations({ search: val, top: 50 })
//         .then(res => {
//           const results = res?.data?.d?.results || [];
//           const totalQty = results
//             .filter(r => r.SalesDocument2 === val || r.SalesDocument === val)
//             .reduce((sum, r) => sum + (Number(r.ExpectedQty) || 0), 0);
//           // Get SO master qty
//           let soMasterQty = 0;
//           if (soSuggestions && soSuggestions.length > 0) {
//             const soObj = soSuggestions.find(s => (s.SalesDocument2 || s.SalesOrder || s.SalesDocument) === val);
//             soMasterQty = Number(soObj?.BalanceQty || (soObj?.items && soObj.items[0]?.BalanceQty) || 0);
//           }
//           setRemainingQty(soMasterQty - totalQty);
//         })
//         .catch(() => setRemainingQty(null));
//       return () => { ignore = true; };
//     }, [formData.SalesDocument2]);

//   // Hide suggestions on outside click
//   useEffect(() => {
//     function handleClick(e) {
//       if (soInputRef.current && !soInputRef.current.contains(e.target)) {
//         setShowSoSuggestions(false);
//       }
//     }
//     if (showSoSuggestions) {
//       document.addEventListener("mousedown", handleClick);
//       return () => document.removeEventListener("mousedown", handleClick);
//     }
//   }, [showSoSuggestions]);

//   // Handlers
//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setFormData(prev => ({
//       ...prev,
//       [name]: value === undefined || value === null ? "" : value
//     }));
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     const expectedQtyNum = Number(formData.ExpectedQty);
//     if (isNaN(expectedQtyNum) || expectedQtyNum <= 0) {
//       alert("Expected Quantity must be a positive number");
//       return;
//     }
//     if (availableQty !== null && availableQty <= 0) {
//       alert("Registration not allowed: SO is fully registered (Remaining Qty is zero)");
//       return;
//     }
//     if (formData.ExpectedQty && availableQty !== null && expectedQtyNum >= Number(availableQty)) {
//       alert(`Expected Quantity cannot be more than available (${availableQty})`);
//       return;
//     }
//     setSubmitting(true);
//     setSuccessMsg("");
//     try {
//       const payload = {
//         ...formData,
//         ExpectedQty: expectedQtyNum, // <-- Ensure this is a number
//         Status: "Success"
//       };
//       const res = await initialRegistration(payload);
//       // Get RegistrationNumber from backend response
//       const regNumber = res?.data?.RegistrationNumber || "";
//       setSuccessMsg(`Initial Registration Successfully!\nSalesOrder Number: ${formData.SalesDocument2} | Vehicle: ${formData.VehicleNumber} | Initial Reg Number: ${regNumber}`);
//       setFormData({ ...initialFormState, SalesDocument2: "", ExpectedQty: "" });
//       setRemainingQty(null);
//       setAvailableQty(null); // Reset availableQty after registration
//       if (showList) loadList({ search });
//     } catch (error) {
//       console.error("Initial Registration Error:", error);
//       alert("Initial Registration Failed. Please try again.");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const loadList = async ({ search: s = "" } = {}) => {
//     setListLoading(true);
//     setListError("");
//     try {
//       const { data } = await fetchInitialRegistrations({
//         top: 50,
//         search: s,
//         count: true
//       });
//       const results = data?.d?.results || [];
//       setRows(results);
//       setCount(data?.d?.__count ?? results.length);
//     } catch (e) {
//       setListError(e?.response?.data?.error || e.message || "Failed to load registrations");
//     } finally {
//       setListLoading(false);
//     }
//   };

//   const toggleList = () => {
//     const next = !showList;
//     setShowList(next);
//     if (next) {
//       loadList({ search });
//     }
//   };

//   const handleSearchSubmit = (e) => {
//     e.preventDefault();
//     loadList({ search });
//   };

//   const handleReset = () => {
//     setSearch("");
//     loadList({ search: "" });
//   };

//   // Handler to cancel/update a registration to "Failed"
//   const handleCancelRegistration = async (uuid, currentStatus) => {
//     if (!uuid) {
//       alert("Cannot update: missing UUID");
//       return;
//     }
//     if (currentStatus === "Failed") {
//       alert("This registration is already marked as Failed");
//       return;
//     }
//     if (!window.confirm("Mark this registration as Failed?")) return;
//     try {
//       await updateInitialRegistration(uuid, { Status: "Failed" });
//       alert("Registration marked as Failed");
//       loadList({ search });
//     } catch (e) {
//       console.error("Cancel error:", e);
//       alert("Failed to update status: " + (e?.response?.data?.error || e.message));
//     }
//   };

// const handleInitialRegistration = async (e) => {
//   if (e && e.preventDefault) e.preventDefault();
//   if (!formData.VehicleNumber || formData.VehicleNumber.trim() === "") {
//     alert("Please enter a Vehicle Number.");
//     return;
//   }
//   try {
//     const resp = await checkVehicleStatus(formData.VehicleNumber.trim());
//     const results = resp?.data?.d?.results || [];
//     // Check if any record has VehicleStatus IN (case-insensitive)
//     const isIn = results.some(
//       r => (r.VehicleStatus || "").toUpperCase().trim() === "IN"
//     );
//     if (isIn) {
//       alert("This vehicle is already IN. Cannot register again.");
//       return;
//     } else {
//       console.log("Vehicle status Not checking");
//     }
//     // If OUT or not found, allow registration
//     handleSubmit(e);
//   } catch (error) {
//     console.error("Error checking vehicle status:", error);
//     const msg = error?.response?.data?.error?.message?.value || error.message || "Failed to check vehicle status. Please try again.";
//     alert(msg);
//   }
// };
//   return (
//     <div className="create-header-container initial-reg-wrapper">
//       <h2 className="initial-reg-title">Initial Registration</h2>
//       {successMsg && (
//         <div className="success-message" style={{marginBottom: 16, background: '#e6ffed', color: '#256029', padding: 12, borderRadius: 6, fontWeight: 500}}>
//           {successMsg.split('\n').map((line, idx) => <div key={idx}>{line}</div>)}
//         </div>
//       )}
//       <form onSubmit={handleSubmit} className="create-header-form">
//         <div className="form-row-2col">
//           <div className="form-group" ref={soInputRef} style={{ position: "relative" }}>
//             <label>Sales Document</label>
//             <input
//               type="text"
//               name="SalesDocument2"
//               value={formData.SalesDocument2 || ""}
//               onChange={handleChange}
//               autoComplete="off"
//               required
//               onFocus={() => {
//                 if (soSuggestions.length > 0) setShowSoSuggestions(true);
//               }}
//             />
//             {showSoSuggestions && soSuggestions.length > 0 && (
//               <ul className="so-suggestion-list">
//                 {soSuggestions.map((s, i) => {
//                   const soNumber = s.SalesDocument2 || s.SalesOrder || s.SalesDocument || "N/A";
//                   const material = s.Material || (s.items && s.items[0]?.Material) || "";
//                   const materialDesc = s.MaterialDescription || (s.items && s.items[0]?.MaterialDescription) || "";
//                   // Show RemainingQty as Balance Qty
//                   const balanceQty = s.RemainingQty !== undefined ? s.RemainingQty : (s.BalanceQty || (s.items && s.items[0]?.BalanceQty) || "");
//                   return (
//                     <li
//                       key={soNumber + "_" + i}
//                       onClick={() => {
//                         setFormData(f => ({
//                           ...f,
//                           SalesDocument2: soNumber,
//                           Customer: s.Customer || "",
//                           CustomerName: s.CustomerName || "",
//                           Material: material,
//                           MaterialDescription: materialDesc,
//                           BalanceQty: balanceQty,
//                           ExpectedQty: balanceQty // Set ExpectedQty to RemainingQty
//                         }));
//                         setShowSoSuggestions(false);
//                       }}
//                     >
//                       <div>
//                         <strong>SalesDocument: {soNumber}</strong>
//                         {s.Customer && <span style={{marginLeft:8}}>Customer: {s.Customer}</span>}
//                         {s.CustomerName && <span style={{marginLeft:8}}>Name: {s.CustomerName}</span>}
//                         {material && <span style={{marginLeft:8}}>Material: {material}</span>}
//                         {materialDesc && <span style={{marginLeft:8}}>Desc: {materialDesc}</span>}
//                         {balanceQty !== undefined && <span style={{marginLeft:8}}>Balance Qty: {balanceQty}</span>}
//                       </div>
//                     </li>
//                   );
//                 })}
//               </ul>
//             )}
//           </div>
//           <div className="form-group">
//             <label>Expected Quantity</label>
//             <input
//               type="number"
//               name="ExpectedQty"
//               value={formData.ExpectedQty || ""}
//               onChange={handleChange}
//               required
//               step="0.01"
//             />
//             {formData.ExpectedQty && Number(formData.ExpectedQty) <= 0 && (
//               <div style={{ marginTop: 4, color: 'red', fontWeight: 500 }}>
//                 Error: Quantity not available in sales document
//               </div>
//             )}
//             {formData.ExpectedQty && availableQty !== null && Number(formData.ExpectedQty) > Number(availableQty) && (
//               <div style={{ marginTop: 4, color: 'red', fontWeight: 500 }}>
//                 Error: Expected Qty more than Sales Document Qty
//               </div>
//             )}
//           </div>
//         </div>
//         <div className="form-row-2col">
//           <div className="form-group">
//             <label>Vehicle Number</label>
//             <input
//               type="text"
//               name="VehicleNumber"
//               value={formData.VehicleNumber || ""}
//               onChange={handleChange}
//               required
//             />
//           </div>
//           <div className="form-group">
//             <label>Transporter</label>
//             <input
//               type="text"
//               name="Transporter"
//               value={formData.Transporter || ""}
//               onChange={handleChange}
//               required
//             />
//           </div>
//         </div>
//         <div className="form-group">
//           <label>Remarks</label>
//           <input
//             type="text"
//             name="SAP_Description"
//             value={formData.SAP_Description || ""}
//             onChange={handleChange}
//             required
//           />
//         </div>
//         <div className="actions-row">
//           {/* Removed Used Initial Reg Qty display */}
//           <button
//             type="submit"
//             className="submit-button"
//             disabled={submitting || (availableQty !== null && availableQty <= 0)}
//           >
//             {submitting ? "Submitting..." : "Submit"}
//           </button>
//           <button
//             type="button"
//             className="secondary-button"
//             onClick={toggleList}
//           >
//             {showList ? "Hide Register Details" : "Register Details"}
//           </button>
//         </div>
//       </form>
//       {showList && (
//         <div className="registration-list-panel">
//           <h3 className="panel-title">Registered Entries</h3>
//           <form onSubmit={handleSearchSubmit} className="search-bar">
//             <input
//               type="text"
//               placeholder="Search Sales Doc / Vehicle / Transporter / Remarks..."
//               value={search || ""}
//               onChange={(e) => setSearch(e.target.value)}
//             />
//             <button type="submit" className="submit-button small">
//               Search
//             </button>
//             <button
//               type="button"
//               className="secondary-button small"
//               onClick={handleReset}
//             >
//               Reset
//             </button>
//           </form>
//           {listLoading && <div className="loading-indicator">Loading...</div>}
//           {listError && (
//             <div className="error-message" style={{ marginBottom: 12 }}>
//               {listError}
//             </div>
//           )}
//           {count != null && !listLoading && (
//             <div className="count-text">Total: {count}</div>
//           )}
//           <div className="table-scroll">
//             <table className="data-table">
//               <thead>
//                 <tr>
//                   <th>Sales Document</th>
//                   <th>Expected Qty</th>
//                   <th>Vehicle</th>
//                   <th>Transporter</th>
//                   <th>Remarks</th>
//                   <th>Status</th>
//                   <th>Actions</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {rows.map((r, i) => (
//                   <tr key={r.SAP_UUID || r.SalesDocument2 || i}>
//                     <td>{r.SalesDocument2 || "-"}</td>
//                     <td>{r.ExpectedQty || "-"}</td>
//                     <td>{r.VehicleNumber || "-"}</td>
//                     <td>{r.Transporter || "-"}</td>
//                     <td>{r.SAP_Description || "-"}</td>
//                     <td>
//                       <span className={`status-badge status-${(r.Status || 'Success').toLowerCase()}`}>
//                         {r.Status || "Success"}
//                       </span>
//                     </td>
//                     <td>
//                       {r.Status !== "Failed" && (
//                         <button
//                           type="button"
//                           className="cancel-button"
//                           onClick={() => handleCancelRegistration(r.SAP_UUID, r.Status)}
//                         >
//                           Cancel
//                         </button>
//                       )}
//                     </td>
//                   </tr>
//                 ))}
//                 {!listLoading && rows.length === 0 && (
//                   <tr>
//                     <td colSpan={7} className="empty-row">
//                       No records found
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }


// Version2 Date:18-12-2025
import React, { useState, useEffect, useRef } from "react";
import { initialRegistration, fetchInitialRegistrations, updateInitialRegistration, fetchSalesOrderSuggestions, checkVehicleStatus } from "../../api";
import { useLocation } from "react-router-dom";
import "./InitialReg.css";

export default function InitialRegistration() {
  // RemainingQty state
  const [remainingQty, setRemainingQty] = useState(null);
  // Track available qty for validation
  const [availableQty, setAvailableQty] = useState(null);
  const location = useLocation();

  // Always initialize all fields as string or number (never undefined/null)
  const initialFormState = {
    RegistrationNumber: "",
    Indicators: "IR",
    SalesDocument2: "",
    Material: "",
    Customer: "",
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
    const fetchSOData = async () => {
      const val = (formData.SalesDocument2 || "").trim();
      if (val.length < 2) {
        setSoSuggestions([]);
        setShowSoSuggestions(false);
        setRemainingQty(null);
        setAvailableQty(null);
        return;
      }

      try {
        // Fetch SO suggestions
        const res = await fetchSalesOrderSuggestions(val);
        const suggestions = res.data || [];
        
        // Calculate remaining quantity for each SO
        const updatedSuggestions = await Promise.all(
          suggestions.map(async (s) => {
            const soNumber = s.SalesDocument2 || s.SalesOrder || s.SalesDocument || "";
            
            // Fetch existing registrations for this SO
            try {
              const regRes = await fetchInitialRegistrations({ 
                search: soNumber, 
                top: 100 
              });
              
              // Handle different response formats
              const regResults = 
                regRes?.data?.d?.results || 
                regRes?.data?.results || 
                regRes?.data || 
                [];
              
              // Sum up ExpectedQty for this SO (only successful registrations)
              const usedQty = regResults
                .filter(r => 
                  (r.SalesDocument2 === soNumber || r.SalesDocument === soNumber) &&
                  (r.Status === "Success" || !r.Status) // Only count successful ones
                )
                .reduce((sum, r) => sum + (Number(r.ExpectedQty) || 0), 0);
              
              // Get total qty from SO master
              const totalQty = Number(s.BalanceQty || s.OrderQuantity || 
                                    (s.items && s.items[0]?.BalanceQty) || 
                                    (s.items && s.items[0]?.OrderQuantity) || 0);
              
              const remainingQty = totalQty - usedQty;
              
              return { 
                ...s, 
                UsedQty: usedQty, 
                TotalQty: totalQty,
                RemainingQty: remainingQty 
              };
            } catch (err) {
              console.error("Error calculating used qty:", err);
              return s;
            }
          })
        );
        
        setSoSuggestions(updatedSuggestions);
        
        // For the currently selected SO, set available qty
        if (formData.SalesDocument2 === val && updatedSuggestions.length > 0) {
          const currentSO = updatedSuggestions.find(s => 
            (s.SalesDocument2 || s.SalesOrder || s.SalesDocument) === val
          );
          
          if (currentSO) {
            const available = currentSO.RemainingQty !== undefined ? 
                            currentSO.RemainingQty : 
                            Number(currentSO.BalanceQty || 0);
            setAvailableQty(available);
            setRemainingQty(available);
            
            // Auto-fill ExpectedQty if empty or if it exceeds available
            if (!formData.ExpectedQty || 
                Number(formData.ExpectedQty) > available) {
              setFormData(prev => ({
                ...prev,
                ExpectedQty: available > 0 ? available.toString() : ""
              }));
            }
          }
        }
        
        setShowSoSuggestions(true);
        
      } catch (error) {
        console.error("Error fetching SO suggestions:", error);
        setSoSuggestions([]);
      }
    };

    fetchSOData();
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

  // Separate validation and submission function
  const validateAndSubmit = async (e) => {
    // Validate expected quantity
    const expectedQtyNum = parseFloat(formData.ExpectedQty);
    if (isNaN(expectedQtyNum) || expectedQtyNum <= 0) {
      alert("Expected Quantity must be a positive number");
      return;
    }

    // Validate against available quantity
    if (availableQty !== null && availableQty <= 0) {
      alert("Registration not allowed: SO is fully registered (Remaining Qty is zero)");
      return;
    }

    if (formData.ExpectedQty && availableQty !== null && expectedQtyNum > Number(availableQty)) {
      alert(`Expected Quantity (${expectedQtyNum}) cannot exceed available quantity (${availableQty})`);
      return;
    }

    // Proceed with actual submission
    await performRegistration(e);
  };

  const performRegistration = async (e) => {
    setSubmitting(true);
    setSuccessMsg("");
    
    try {
      // Format ExpectedQty properly for SAP - try different approaches
      const expectedQtyValue = parseFloat(formData.ExpectedQty) || 0;
      
      // Create payload with proper formatting
      const payload = {
        Indicators: formData.Indicators || "IR",
        SalesDocument2: formData.SalesDocument2 || "",
        VehicleNumber: formData.VehicleNumber || "",
        Transporter: formData.Transporter || "",
        SAP_Description: formData.SAP_Description || "",
        Status: "Success",
        // Try sending as string with 2 decimal places first (most common SAP requirement)
        ExpectedQty: expectedQtyValue.toFixed(2)
      };
      
      // Add optional fields only if they have values
      if (formData.RegistrationNumber && formData.RegistrationNumber.trim() !== "") {
        payload.RegistrationNumber = formData.RegistrationNumber;
      }
      
      console.log("Submitting registration payload:", payload);
      console.log("JSON payload:", JSON.stringify(payload));
      
      const res = await initialRegistration(payload);
      
      // Get RegistrationNumber from backend response
      const regNumber = res?.data?.RegistrationNumber || 
                       res?.data?.registrationNumber || 
                       res?.data?.d?.RegistrationNumber || 
                       "N/A";
      
      setSuccessMsg(`✅ Initial Registration Successful!\n` +
                    `Sales Order: ${formData.SalesDocument2}\n` +
                    `Vehicle: ${formData.VehicleNumber}\n` +
                    `Registration Number: ${regNumber}\n` +
                    `Quantity: ${formData.ExpectedQty}`);
      
      // Reset form but keep SO for multiple entries
      setFormData({
        ...initialFormState,
        SalesDocument2: formData.SalesDocument2, // Keep SO number
        ExpectedQty: availableQty > 0 ? availableQty.toString() : "", // Pre-fill with remaining qty
      });
      
      setRemainingQty(null);
      setAvailableQty(null);
      
      // Refresh list if shown
      if (showList) {
        loadList({ search });
      }
      
    } catch (error) {
      console.error("Registration error details:", error);
      console.error("Error response:", error.response?.data);
      
      // Check for specific ExpectedQty error
      if (error.response?.data?.error?.message?.value?.includes("ExpectedQty") ||
          error.response?.data?.error?.message?.value?.includes("property 'ExpectedQty'")) {
        // Try alternative payload format
        const shouldRetry = window.confirm(
          `SAP Field Error: ${error.response.data.error.message.value}\n\n` +
          "Try sending with different format?"
        );
        
        if (shouldRetry) {
          await retryWithAlternativeFormat();
          return;
        }
      }
      
      const errorMsg = error?.response?.data?.error?.message?.value ||
                      error?.response?.data?.error?.message ||
                      error?.response?.data?.message ||
                      error.message ||
                      "Registration failed. Please check the data and try again.";
      alert(`Registration Failed: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const retryWithAlternativeFormat = async () => {
    try {
      const expectedQtyValue = parseFloat(formData.ExpectedQty) || 0;
      
      // Try alternative 1: Send as number without formatting
      const payload1 = {
        Indicators: formData.Indicators || "IR",
        SalesDocument2: formData.SalesDocument2 || "",
        VehicleNumber: formData.VehicleNumber || "",
        Transporter: formData.Transporter || "",
        SAP_Description: formData.SAP_Description || "",
        Status: "Success",
        ExpectedQty: expectedQtyValue // Send as raw number
      };
      
      console.log("Retry with alternative payload 1:", payload1);
      
      const res = await initialRegistration(payload1);
      
      // Get RegistrationNumber from backend response
      const regNumber = res?.data?.RegistrationNumber || 
                       res?.data?.registrationNumber || 
                       res?.data?.d?.RegistrationNumber || 
                       "N/A";
      
      setSuccessMsg(`✅ Initial Registration Successful! (Retry)\n` +
                    `Sales Order: ${formData.SalesDocument2}\n` +
                    `Vehicle: ${formData.VehicleNumber}\n` +
                    `Registration Number: ${regNumber}\n` +
                    `Quantity: ${formData.ExpectedQty}`);
      
      // Reset form
      setFormData({
        ...initialFormState,
        SalesDocument2: formData.SalesDocument2,
        ExpectedQty: availableQty > 0 ? availableQty.toString() : "",
      });
      
      setRemainingQty(null);
      setAvailableQty(null);
      
    } catch (retryError) {
      console.error("Retry also failed:", retryError);
      alert(`Retry also failed: ${retryError.response?.data?.error?.message?.value || retryError.message}`);
    }
  };

  const handleInitialRegistration = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    
    const vehicleNumber = formData.VehicleNumber?.trim();
    if (!vehicleNumber || vehicleNumber === "") {
      alert("Please enter a Vehicle Number.");
      return;
    }

    try {
      console.log("Checking vehicle status for:", vehicleNumber);
      
      // First, check if vehicle exists and is IN
      const resp = await checkVehicleStatus(vehicleNumber);
      console.log("Vehicle status response:", resp.data);
      
      // Check different response formats
      let isVehicleIn = false;
      
      // If response is an array
      if (Array.isArray(resp.data)) {
        isVehicleIn = resp.data.some(vehicle => 
          (vehicle.VehicleStatus || "").toUpperCase() === "IN"
        );
      }
      // If response is object with results array
      else if (resp.data?.results && Array.isArray(resp.data.results)) {
        isVehicleIn = resp.data.results.some(vehicle => 
          (vehicle.VehicleStatus || "").toUpperCase() === "IN"
        );
      }
      // If response is object with d.results (OData format)
      else if (resp.data?.d?.results && Array.isArray(resp.data.d.results)) {
        isVehicleIn = resp.data.d.results.some(vehicle => 
          (vehicle.VehicleStatus || "").toUpperCase() === "IN"
        );
      }
      // If response is a single vehicle object
      else if (resp.data?.VehicleStatus) {
        isVehicleIn = resp.data.VehicleStatus.toUpperCase() === "IN";
      }
      
      console.log("Is vehicle IN?", isVehicleIn);
      
      if (isVehicleIn) {
        alert(`Vehicle ${vehicleNumber} is currently INSIDE the premises. 
               Please complete departure before new registration.`);
        return;
      }
      
      console.log("Vehicle is OUT or not found, proceeding with validation...");
      
      // Proceed with validation and registration
      await validateAndSubmit(e);
      
    } catch (error) {
      console.error("Vehicle status check error:", error);
      
      // If 404 (vehicle not found), that's OK - proceed
      if (error.response?.status === 404) {
        console.log("Vehicle not found (404), proceeding with registration");
        await validateAndSubmit(e);
        return;
      }
      
      // For other errors, ask user
      const proceed = window.confirm(
        `Unable to verify vehicle status (${error.message}).\n\n` +
        "Vehicle might already be inside.\n" +
        "Do you want to proceed anyway?"
      );
      
      if (proceed) {
        await validateAndSubmit(e);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Call the vehicle check first
    await handleInitialRegistration(e);
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
            <label>Sales Document *</label>
            <input
              type="text"
              name="SalesDocument2"
              value={formData.SalesDocument2 || ""}
              onChange={handleChange}
              autoComplete="off"
              required
              placeholder="Enter SO number"
              onFocus={() => {
                if (formData.SalesDocument2?.length >= 2) {
                  setShowSoSuggestions(true);
                }
              }}
            />
            {availableQty !== null && (
              <div style={{ 
                marginTop: 4, 
                fontSize: "0.9em",
                color: availableQty > 0 ? "#256029" : "#c10000",
                fontWeight: 500 
              }}>
                Available Quantity: {availableQty}
                {availableQty <= 0 && " (SO fully consumed)"}
              </div>
            )}
            
            {showSoSuggestions && soSuggestions.length > 0 && (
              <ul className="so-suggestion-list">
                {soSuggestions.map((s, i) => {
                  const soNumber = s.SalesDocument2 || s.SalesOrder || s.SalesDocument || "N/A";
                  const material = s.Material || (s.items && s.items[0]?.Material) || "";
                  const materialDesc = s.MaterialDescription || (s.items && s.items[0]?.MaterialDescription) || "";
                  // Show RemainingQty as Balance Qty
                  const balanceQty = s.RemainingQty !== undefined ? s.RemainingQty : (s.BalanceQty || (s.items && s.items[0]?.BalanceQty) || "");
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
                          BalanceQty: balanceQty,
                          ExpectedQty: balanceQty // Set ExpectedQty to RemainingQty
                        }));
                        setShowSoSuggestions(false);
                        setAvailableQty(balanceQty);
                      }}
                    >
                      <div>
                        <strong>SalesDocument: {soNumber}</strong>
                        {s.Customer && <span style={{marginLeft:8}}>Customer: {s.Customer}</span>}
                        {s.CustomerName && <span style={{marginLeft:8}}>Name: {s.CustomerName}</span>}
                        {material && <span style={{marginLeft:8}}>Material: {material}</span>}
                        {materialDesc && <span style={{marginLeft:8}}>Desc: {materialDesc}</span>}
                        {balanceQty !== undefined && <span style={{marginLeft:8}}>Available Qty: {balanceQty}</span>}
                        {s.UsedQty !== undefined && <span style={{marginLeft:8}}>Used: {s.UsedQty}</span>}
                        {s.TotalQty !== undefined && <span style={{marginLeft:8}}>Total: {s.TotalQty}</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          
          <div className="form-group">
            <label>Expected Quantity *</label>
            <input
              type="number"
              name="ExpectedQty"
              value={formData.ExpectedQty || ""}
              onChange={handleChange}
              required
              step="0.01"
              min="0.01"
              max={availableQty || undefined}
              placeholder={availableQty ? `Max: ${availableQty}` : "Enter quantity"}
            />
            
            {/* Validation messages */}
            {formData.ExpectedQty && (
              <div style={{ marginTop: 4 }}>
                {Number(formData.ExpectedQty) <= 0 ? (
                  <span style={{ color: 'red', fontWeight: 500 }}>
                    ❌ Quantity must be greater than 0
                  </span>
                ) : availableQty !== null && Number(formData.ExpectedQty) > availableQty ? (
                  <span style={{ color: 'red', fontWeight: 500 }}>
                    ❌ Cannot exceed available quantity ({availableQty})
                  </span>
                ) : availableQty !== null ? (
                  <span style={{ color: '#256029', fontWeight: 500 }}>
                    ✓ Within available limit
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </div>
        
        <div className="form-row-2col">
          <div className="form-group">
            <label>Vehicle Number *</label>
            <input
              type="text"
              name="VehicleNumber"
              value={formData.VehicleNumber || ""}
              onChange={handleChange}
              required
              placeholder="e.g. MH12AB1234"
              style={{ 
                borderColor: formData.VehicleNumber ? 
                  (availableQty !== null && availableQty <= 0 ? '#ffcdd2' : '#ccc') 
                  : '#ccc' 
              }}
            />
          </div>
          <div className="form-group">
            <label>Transporter *</label>
            <input
              type="text"
              name="Transporter"
              value={formData.Transporter || ""}
              onChange={handleChange}
              required
              placeholder="Enter transporter name"
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
            placeholder="Enter remarks (optional)"
          />
        </div>
        
        <div className="actions-row">
          <button
            type="submit"
            className="submit-button"
            disabled={submitting || 
                     (availableQty !== null && availableQty <= 0) ||
                     !formData.VehicleNumber ||
                     !formData.SalesDocument2 ||
                     !formData.ExpectedQty ||
                     !formData.Transporter}
          >
            {submitting ? "Submitting..." : "Register Vehicle"}
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