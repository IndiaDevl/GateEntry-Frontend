import React from "react";
import { Link, useNavigate } from "react-router-dom";
import "./CreateHeader.css";

export default function MoveINHome() {
  const navigate = useNavigate();

  return (
    <div className="movein-container">
      <div className="movein-header">
        <h2>Gate Movement - Select Operation</h2>
      </div>

      <div className="movein-actions">
        <button onClick={() => navigate("/home/movein/inward")} className="action-button">
          Inward
        </button>
        <button onClick={() => navigate("/home/movein/outward")} className="action-button">
          Outward
        </button>
        <button onClick={() => navigate("/home/storeconsumable")} className="action-button">Store & Consumable</button>
        <button className="action-button">Cash Purchase</button>
      </div>
    </div>
  );
}