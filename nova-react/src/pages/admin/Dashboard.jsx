import { useState, useEffect } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend
} from 'chart.js';
import '../../css/dashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

function generateData(period, offset) {
  const labels = [];
  const production = [];
  const consumption = [];
  let count = 0;

  switch (period) {
    case 'hour':
      count = 24;
      for (let i = 0; i < count; i++) labels.push(`${i}h`);
      break;
    case 'week':
      count = 7;
      labels.push('Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim');
      break;
    case 'month':
      count = 30;
      for (let i = 1; i <= count; i++) labels.push(`${i}`);
      break;
    case 'year':
      count = 12;
      labels.push('Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc');
      break;
    default:
      count = 24;
      for (let i = 0; i < count; i++) labels.push(`${i}h`);
  }

  for (let i = 0; i < count; i++) {
    production.push(Math.floor(Math.random() * 500 + 200 + offset * 10));
    consumption.push(Math.floor(Math.random() * 400 + 150 + offset * 10));
  }

  return { labels, production, consumption };
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState('hour');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(() => generateData('hour', 0));

  useEffect(() => {
    setData(generateData(period, offset));
  }, [period, offset]);

  const totalProd = data.production.reduce((a, b) => a + b, 0);
  const totalCons = data.consumption.reduce((a, b) => a + b, 0);
  const balance = totalProd - totalCons;

  const barData = {
    labels: data.labels,
    datasets: [
      { label: 'Production (kWh)', data: data.production, backgroundColor: 'rgba(39,174,96,0.7)' },
      { label: 'Consommation (kWh)', data: data.consumption, backgroundColor: 'rgba(231,76,60,0.7)' },
    ],
  };

  const lineData = {
    labels: data.labels,
    datasets: [
      {
        label: 'Consommation (kWh)',
        data: data.consumption,
        borderColor: '#e74c3c',
        backgroundColor: 'rgba(231,76,60,0.1)',
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' } },
  };

  return (
    <section className="dashboard-section">
      <h1><i className="fa-solid fa-chart-line"></i> Suivi énergétique</h1>

      <div className="energy-summary">
        <div className="summary-card">
          <i className="fa-solid fa-solar-panel"></i>
          <div>
            <h4>Production totale</h4>
            <p>{totalProd.toLocaleString()} kWh</p>
          </div>
        </div>
        <div className="summary-card">
          <i className="fa-solid fa-plug"></i>
          <div>
            <h4>Consommation totale</h4>
            <p>{totalCons.toLocaleString()} kWh</p>
          </div>
        </div>
        <div className="summary-card">
          <i className="fa-solid fa-scale-balanced"></i>
          <div>
            <h4>Bilan net</h4>
            <p style={{ color: balance >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {balance >= 0 ? '+' : ''}{balance.toLocaleString()} kWh
            </p>
          </div>
        </div>
      </div>

      <div className="dashboard-controls">
        <select value={period} onChange={(e) => { setPeriod(e.target.value); setOffset(0); }}>
          <option value="hour">Par heure</option>
          <option value="week">Par semaine</option>
          <option value="month">Par mois</option>
          <option value="year">Par année</option>
        </select>
        <div className="nav-buttons">
          <button onClick={() => setOffset(o => o - 1)}><i className="fa-solid fa-chevron-left"></i></button>
          <span>Période {offset === 0 ? 'actuelle' : offset > 0 ? `+${offset}` : offset}</span>
          <button onClick={() => setOffset(o => o + 1)}><i className="fa-solid fa-chevron-right"></i></button>
        </div>
      </div>

      <div className="charts-container">
        <div className="chart-card">
          <h3>Production vs Consommation</h3>
          <div style={{ height: 320 }}>
            <Bar data={barData} options={chartOptions} />
          </div>
        </div>
        <div className="chart-card">
          <h3>Évolution de la consommation</h3>
          <div style={{ height: 320 }}>
            <Line data={lineData} options={chartOptions} />
          </div>
        </div>
      </div>
    </section>
  );
}
