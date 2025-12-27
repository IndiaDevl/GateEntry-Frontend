import { useEffect, useState } from "react";
import axios from "axios";

export default function LiveDashBoard() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sales, setSales] = useState({ rows: [], totals: {} });
  const [inward, setInward] = useState({ rows: [], totals: {} });
  const [seconds, setSeconds] = useState(30);

  const fetchData = async () => {
    try {
      const res = await axios.get(
        "http://localhost:4600/api/material-trucks",
    //    "https://gateentry-backend.onrender.com/api/material-trucks",
        { params: { fromDate, toDate } }
      );
      setSales(res.data.sales);
      setInward(res.data.inward);
    } catch (err) {
      console.error(err);
    }
  };

  /* ===== Default TODAY + 30 sec refresh ===== */
  useEffect(() => {
    fetchData();

    const refreshInterval = setInterval(() => {
      fetchData();
      setSeconds(30);
    }, 30000);

    const secondInterval = setInterval(() => {
      setSeconds(s => (s === 0 ? 30 : s - 1));
    }, 1000);

    return () => {
      clearInterval(refreshInterval);
      clearInterval(secondInterval);
    };
  }, []);

  return (
    <div className="dashboard">
      {/* ===== HEADER ===== */}
      <div className="header">
        MATERIAL TRUCKS LIVE STATUS : (TODAY)
      </div>

      {/* ===== FILTER ROW ===== */}
      <div className="filter-row">
        <b>Period (Filter)</b>

        <label>From Date</label>
        <input type="date" onChange={e => setFromDate(e.target.value)} />

        <label>To Date</label>
        <input type="date" onChange={e => setToDate(e.target.value)} />

        <button onClick={fetchData}>Get Status</button>

        <div className="refresh-text">
          Auto refresh in <b>{seconds}</b> sec
        </div>
      </div>

      {/* ===== TABLES ===== */}
      <div className="tables-row">
        <Section
          title="Sales / Dispatch Trucks Status (SD Materials)"
          data={sales}
        />

        <Section
          title="Inward Trucks Status (Purchase Materials)"
          data={inward}
        />
      </div>

      {/* ===== CSS ===== */}
      <style>{`
        .dashboard {
          background: #eaf3ff;
          padding: 20px;
          font-family: Arial, Helvetica, sans-serif;
        }

        .header {
          background: #ccffcc;
          padding: 10px;
          font-size: 20px;
          font-weight: bold;
          text-align: center;
          border: 1px solid #000;
          margin-bottom: 10px;
        }

        .filter-row {
          display: grid;
          grid-template-columns: 130px 90px 160px 60px 160px 110px auto;
          gap: 10px;
          align-items: center;
          margin-bottom: 15px;
        }

        .filter-row input {
          padding: 4px;
        }

        .filter-row button {
          padding: 6px;
          font-weight: bold;
          cursor: pointer;
        }

        .refresh-text {
          font-size: 12px;
          color: #444;
        }

        .tables-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .section-title {
          background: #fff2cc;
          border: 1px solid #000;
          padding: 6px;
          font-weight: bold;
          text-align: center;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          background: #fff;
        }

        th {
          background: #f4c7ff;
          border: 1px solid #000;
          padding: 6px;
          text-align: center;
        }

        td {
          border: 1px solid #000;
          padding: 6px;
        }

        .total-row {
          background: #f2f2f2;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
}

/* ===== REUSABLE SECTION ===== */
function Section({ title, data }) {
  return (
    <div>
      <div className="section-title">{title}</div>

      <table>
        <thead>
          <tr>
            <th>Type of Mtrls</th>
            <th>No of Trucks IN</th>
            <th>No of Trucks OUT</th>
            <th>Net Weight</th>
            <th>No of Trucks Pending</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r, i) => (
            <tr key={i}>
              <td>{r.material}</td>
              <td>{r.in}</td>
              <td>{r.out}</td>
              <td>{r.netWeight.toFixed(2)}</td>
              <td>{r.pending}</td>
            </tr>
          ))}

          <tr className="total-row">
            <td>Total</td>
            <td>{data.totals.in}</td>
            <td>{data.totals.out}</td>
            <td>{data.totals.netWeight}</td>
            <td>{data.totals.pending}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
