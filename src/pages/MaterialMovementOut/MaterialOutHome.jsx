import React from "react";
import { Link, useNavigate } from "react-router-dom";
import "./MaterialOutHome.css";

export default function MoveINHome() {
  const navigate = useNavigate();

  return (
    <div className="movein-container">
      <div className="movein-header">
        <h2>Material Movement Out</h2>
      </div>

      <div className="movein-actions">
        <button onClick={() => navigate("/home/materialout_inward")} className="action-button">
          Inward
        </button>
        <button onClick={() => navigate("/home/materialout_outward")} className="action-button">
          Outward
        </button>
      </div>
    </div>
  );
}