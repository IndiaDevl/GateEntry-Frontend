import React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();
  const logout = () => {
    localStorage.removeItem("loggedIn");
    navigate("/");
  };

  return (
    <div style={{ maxWidth: 900, margin: "24px auto", padding: 16 }}>
      <h2>Home</h2>
      <p>Welcome to the static demo home page.</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
        <Link to="/home/create"><button style={{ padding: "8px 12px" }}>GATE MOVEMENT IN</button></Link>
        <button onClick={logout} style={{ padding: "8px 12px" }}>Logout</button>
      </div>

      {/* <section>
        <h3>Sub Pages</h3>
        <ul>
          <li><Link to="/home/create">Create Header (Gate Entry)</Link></li>
          <li><em>Other sub pages can be added here</em></li>
        </ul>
      </section> */}
    </div>
  );
}