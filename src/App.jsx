import React, { useState, useEffect, useRef } from "react";
//import { userCrenditials } from "./api";
import { userCrenditials } from "./api.js";
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import InitialRegistration from  "./pages/Gateinmovementin/InitialReg.jsx";
import QRScannerInward from "./pages/QRScanner/QRScanner.jsx";
import QRScannerInwardOut from "./pages/QRScanner/QRScannerout.jsx"; 
import CreateHeader from "./pages/Gateinmovementin/CreateHeader.jsx";
import MoveINHome from "./pages/Gateinmovementin/MoveINHome.jsx";
import MoveOutHome from "./pages/GateMovementOut/GateOutHome.jsx";
import MaterialINHome from "./pages/MaterialMovementIN/MaterialINHome.jsx";
import MaterialInward from "./pages/MaterialMovementIN/MaterialInward.jsx";
import MaterialOutward from "./pages/MaterialMovementIN/MaterialOutward.jsx";
import MaterialOutHome from "./pages/MaterialMovementOut/MaterialOutHome.jsx";  
import MaterialOut_Inward from "./pages/MaterialMovementOut/MatInward_out.jsx";
import MaterialOut_Outward from "./pages/MaterialMovementOut/MatOutward_out.jsx";
import Outward from "./pages/Gateinmovementin/Outward.jsx";
import GateOut_Inward from "./pages/GateMovementOut/GateEntryInward_Out.jsx";
import GateOut_Outward from "./pages/GateMovementOut/GateEntryOutward_Out.jsx";
import Internal_TransferPosting from "./pages/TransferPosting/emptytruckITP.jsx";
import Loaded_TransferPosting from "./pages/TransferPosting/loadedtruckITP.jsx";
import ITPHome from "./pages/TransferPosting/ITPHome.jsx";
import TruckRegistration from "./pages/TransferPosting/TruckReg.jsx";
import StoreConsubale from "./pages/Gateinmovementin/StoreConsubale.jsx";
import LiveDashBoard from "./pages/Gateinmovementin/LiveDashBoard.jsx";
import "./App.css";

// Protected Route Component
// 101 = admin (all access), 102 = mm, 103 = sd
const ProtectedRoute = ({ children, allowedRoles }) => {
  const loggedIn = localStorage.getItem("loggedIn") === "true";
  const roleCode = localStorage.getItem("roleCode");
  if (!loggedIn) return <Navigate to="/" replace />;
  if (roleCode === "101") return children; // admin: allow all
  if (allowedRoles && !allowedRoles.includes(roleCode)) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "red", fontWeight: "bold" }}>
        Your ID is not authorized for this page.
      </div>
    );
  }
  return children;
};

// Home Page Component
const HomePage = () => {
  const navigate = useNavigate();
  
  return (
    <div className="home-container">
      <header
  className="home-header"
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "16px 24px 0 24px"
  }}
>
  <div>
    <h1 style={{ marginBottom: 20 }}>Gate Entry Screen</h1>
    <nav className="main-nav">
      <Link to="/home/livedashboard" className="card-link">Dashboard</Link>
      <Link to="/home/initial_registration" className="card-link">Initial Registration</Link>
    </nav>
  </div>
  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
    <img src="/Minera_Logo.jpg" alt="Minera Logo" style={{ width: "150px" }} />
    <button
      onClick={() => { localStorage.removeItem("loggedIn"); navigate("/"); }}
      className="logout-btn"
    >
      Logout
    </button>
  </div>
</header>

      <main className="home-main">
        <div className="dashboard-cards">
          <div className="card">
            <h3>Gate Entry Movement In</h3>
            <p>Gate movement in</p>
            <Link to="/home/movein" className="card-link">Gate Entry Movement IN</Link>
          </div>
          <div className="card">
            <h3>Material Movement Details IN</h3>
            <p>Gate Material Details</p>
            <Link to="/home/Materialin" className="card-link">Material Movement Details IN</Link>
          </div>
          <div className="card">
            <h3>Material Movement Details Out</h3>
            <p>Gate Material Details</p>
            <Link to="/home/materialout" className="card-link">Material Movement Details Out</Link>
          </div>
          <div className="card">
            <h3>Gate Entry Movement Out</h3>
            <p>Gate Movement Out Details</p>
            <Link to="/home/moveout" className="card-link">Gate Entry Movement Out</Link>
          </div>
            <div className="card">
            <h3>QR Scanner Inward</h3>
            <p>Inward</p>
            <Link to="/home/qrscanner/inward" className="card-link">QR Scanner Inward</Link>
          </div>
          <div className="card">
            <h3>QR Scanner Outward</h3>
            <p>Outward</p>
            <Link to="/home/qrscanner/outward" className="card-link">QR Scanner Outward</Link>
          </div>
          <div className="card">
            <h3>Internal Transfer Posting</h3>
            <p>ITP Details</p>
            <Link to="/home/transferposting" className="card-link">Internal Transfer Posting</Link>
          </div>
        </div>
      </main>
    </div>
  );
};

// Login Page Component
const LoginPage = () => {
  const [user, setUser] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await userCrenditials(user, pwd);
      if (data.success && data.user) {
        // Store only ModuleWise as roleCode (101=admin, 102=mm, 103=sd)
        localStorage.setItem("loggedIn", "true");
        localStorage.setItem("roleCode", data.user.ModuleWise || "");
        localStorage.setItem("user", data.user.UserName || "");
        navigate("/home");
      } else {
        setError("Invalid credentials");
      }
    } catch (err) {
      setError("Invalid credential");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
       <img src="/Minera_Logo.jpg" alt="Minera Logo" style={{ width: "120px" }} />
        <h2>Gate Entry System</h2>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <input 
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="login-btn" disabled={loading}>{loading ? "Logging" : "Login"}</button>
        </form>
      </div>
    </div>
  );
};

// Main App Component
// AutoLogout component to handle inactivity logout
function AutoLogout() {
  const timerRef = useRef();
  const logoutTimer = 3 * 60 * 1000; // 3 minutes
  const navigate = useNavigate();

  // Reset timer on user activity
  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (localStorage.getItem("loggedIn") === "true") {
      timerRef.current = setTimeout(() => {
        localStorage.removeItem("loggedIn");
        localStorage.removeItem("roleCode");
        localStorage.removeItem("user");
        alert("Logged out due to inactivity.");
        navigate("/");
      }, logoutTimer);
    }
  };

  useEffect(() => {
    if (localStorage.getItem("loggedIn") === "true") {
      const events = ["mousemove", "keydown", "mousedown", "touchstart"];
      events.forEach((event) => window.addEventListener(event, resetTimer));
      resetTimer();
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        events.forEach((event) => window.removeEventListener(event, resetTimer));
      };
    }
  }, [localStorage.getItem("loggedIn")]);
  return null;
}

export default function App() {
  return (
    <Router>
      <AutoLogout />
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        {/* 101 = admin, 102 = mm, 103 = sd */}
        <Route path="/home/initial_registration" element={<ProtectedRoute allowedRoles={["101","102"]}><InitialRegistration /></ProtectedRoute>} />
        <Route path="/home/create" element={<ProtectedRoute allowedRoles={["101","102"]}><CreateHeader /></ProtectedRoute>} />
        <Route path="/home/movein" element={<ProtectedRoute allowedRoles={["101","102","103"]}><MoveINHome /></ProtectedRoute>} />
        <Route path="/home/moveout" element={<ProtectedRoute allowedRoles={["101","102","103"]}><MoveOutHome /></ProtectedRoute>} />
        <Route path="/home/materialin" element={<ProtectedRoute allowedRoles={["101","102","103"]}><MaterialINHome /></ProtectedRoute>} />
        <Route path="/home/materialinward" element={<ProtectedRoute allowedRoles={["101","102"]}><MaterialInward /></ProtectedRoute>} />
        <Route path="/home/materialoutward" element={<ProtectedRoute allowedRoles={["101","103"]}><MaterialOutward /></ProtectedRoute>} />
        <Route path="/home/materialout" element={<ProtectedRoute allowedRoles={["101","102","103"]}><MaterialOutHome /></ProtectedRoute>} />
        <Route path="/home/materialout_inward" element={<ProtectedRoute allowedRoles={["101","102"]}><MaterialOut_Inward /></ProtectedRoute>} />
        <Route path="/home/movein/inward" element={<ProtectedRoute allowedRoles={["101","102"]}><CreateHeader /></ProtectedRoute>} />
        <Route path="/home/movein/outward" element={<ProtectedRoute allowedRoles={["101","103"]}><Outward /></ProtectedRoute>} />
        <Route path="/home/materialout_outward" element={<ProtectedRoute allowedRoles={["101","103"]}><MaterialOut_Outward /></ProtectedRoute>} />
        <Route path="/home/gateout_inward" element={<ProtectedRoute allowedRoles={["101","102"]}><GateOut_Inward /></ProtectedRoute>} />
        <Route path="/home/gateout_outward" element={<ProtectedRoute allowedRoles={["101","103"]}><GateOut_Outward /></ProtectedRoute>} />
        <Route path="/home/qrscanner/inward" element={<ProtectedRoute allowedRoles={["101","102"]}><QRScannerInward /></ProtectedRoute>} />
        <Route path="/home/qrscanner/outward" element={<ProtectedRoute allowedRoles={["101","102"]}><QRScannerInwardOut /></ProtectedRoute>} />
        <Route path="/home/transferposting/itp" element={<ProtectedRoute allowedRoles={["101","103"]}><Internal_TransferPosting /></ProtectedRoute>} />
        <Route path="/home/transferposting/loadeditp" element={<ProtectedRoute allowedRoles={["101","103"]}><Loaded_TransferPosting /></ProtectedRoute>} />
        <Route path="/home/transferposting" element={<ProtectedRoute allowedRoles={["101","103"]}><ITPHome /></ProtectedRoute>} />
        <Route path="/home/truckregistration" element={<ProtectedRoute allowedRoles={["101","103"]}><TruckRegistration /></ProtectedRoute>} />
        <Route path="/home/storeconsumable" element={<ProtectedRoute allowedRoles={["101","102"]}><StoreConsubale /></ProtectedRoute>} />
        <Route path="/home/livedashboard" element={<ProtectedRoute allowedRoles={["101","102","103"]}><LiveDashBoard /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}


