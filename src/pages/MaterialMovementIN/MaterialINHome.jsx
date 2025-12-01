import React from "react";
import { Link, useNavigate } from "react-router-dom";
import "./MaterialINHome.css";

export default function MoveINHome() {
  const navigate = useNavigate();

  return (
    <div className="movein-container">
      <div className="movein-header">
        <h2>Material Movement Details IN</h2>
      </div>

      <div className="movein-actions">
        <button onClick={() => navigate("/home/materialinward")} className="action-button">
          Inward
        </button>
        <button onClick={() => navigate("/home/materialoutward")} className="action-button">
          Outward
        </button>
      </div>
    </div>
  );
}