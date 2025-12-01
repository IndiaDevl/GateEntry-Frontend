import React from "react";
import { Link, useNavigate } from "react-router-dom";
//import "./CreateHeader.css";

export default function MoveINHome() {
  const navigate = useNavigate();

  return (
    <div className="movein-container">
      <div className="movein-header">
        <h2>Internal Transfer Posting</h2>
      </div>

      <div className="movein-actions">
        <button onClick={() => navigate("/home/truckregistration")} className="action-button">
          Truck Registration
        </button>
        <button onClick={() => navigate("/home/transferposting/itp")} className="action-button">
          Empty Truck Internal Transfer Posting
        </button>
        <button onClick={() => navigate("/home/transferposting/loadeditp")} className="action-button">
          Loaded Truck Internal Transfer Posting
        </button>
      </div>
    </div>
  );
}