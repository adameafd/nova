import { useState, useEffect, useCallback, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Filler,
} from 'chart.js';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../socket';
import '../../css/iot-dashboard.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

// Après OFFLINE_THRESHOLD secondes sans données → "Hors ligne"
const OFFLINE_THRESHOLD_MS = 60_000;
// Nb max de points gardés en mémoire pour les graphes live
const MAX_HISTORY_POINTS = 300;

// ── Utilitaires ──────────────────────────────────────────────────────────────

function timeAgo(date) {
  if (!date) return '—';
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 5)    return "à l'instant";
  if (diff < 60)   return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  return `il y a ${Math.floor(diff / 3600)}h`;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function fmtFull(ts) {
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ── Sous-composants ──────────────────────────────────────────────────────────

function StatusBadge({ online }) {
  return (
    <span className={`iot-status-badge ${online ? 'online' : 'offline'}`}>
      <span className="iot-dot" />
      {online ? 'En ligne' : 'Hors ligne'}
    </span>
  );
}

function StatCard({ icon, label, colorClass, children }) {
  return (
    <div className={`iot-card ${colorClass}`}>
      <div className="iot-card-header">
        <i className={`fa-solid ${icon}`} />
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function MiniChart({ data, color, label, yLabel, yMin, yMax }) {
  const chartData = {
    labels: data.map(d => fmtTime(d.ts)),
    datasets: [{
      data: data.map(d => d.value),
      borderColor: color,
      backgroundColor: `${color}14`,
      fill: true,
      tension: 0.35,
      pointRadius: data.length > 60 ? 0 : 2,
      borderWidth: 2,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: { tooltip: { mode: 'index', intersect: false } },
    scales: {
      x: {
        ticks: { maxTicksLimit: 6, font: { size: 10 }, color: '#9fb3c6' },
        grid: { color: 'rgba(0,0,0,0.04)' },
      },
      y: {
        min: yMin,
        max: yMax,
        title: { display: true, text: yLabel, font: { size: 10 }, color: '#9fb3c6' },
        ticks: { font: { size: 10 }, color: '#9fb3c6' },
        grid: { color: 'rgba(0,0,0,0.04)' },
      },
    },
  };

  return (
    <div className="iot-chart-card">
      <div className="iot-chart-label">
        <span className="iot-chart-dot" style={{ background: color }} />
        {label}
      </div>
      <div className="iot-chart-body">
        {data.length === 0
          ? <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--muted)', fontSize:12 }}>Pas encore de données</div>
          : <Line data={chartData} options={options} />
        }
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function IoTDashboard() {
  const { API_BASE } = useAuth();

  const [devices, setDevices]     = useState([]);
  const [deviceId, setDeviceId]   = useState(null);
  const [latest, setLatest]       = useState(null);
  const [history, setHistory]     = useState([]);
  const [range, setRange]         = useState('10m');
  const [online, setOnline]       = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading, setLoading]     = useState(true);

  const offlineTimer = useRef(null);
  const lastUpdateRef = useRef(null);

  // Ticker pour rafraîchir "il y a Xs" sans refetch
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  // ── Marquer online ───────────────────────────────────────────
  const markOnline = useCallback(() => {
    setOnline(true);
    const now = new Date();
    setLastUpdate(now);
    lastUpdateRef.current = now;
    clearTimeout(offlineTimer.current);
    offlineTimer.current = setTimeout(() => setOnline(false), OFFLINE_THRESHOLD_MS);
  }, []);

  useEffect(() => () => clearTimeout(offlineTimer.current), []);

  // ── Fetch list of devices ─────────────────────────────────────
  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/telemetry/devices`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setDevices(data);
        setDeviceId(prev => prev ?? data[0].device_id);
      }
    } catch { /* ignore */ }
  }, [API_BASE]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  // ── Fetch latest ──────────────────────────────────────────────
  const fetchLatest = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/telemetry/latest?deviceId=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = await res.json();
      setLatest(data);
      markOnline();
    } catch { /* ignore */ }
  }, [API_BASE, markOnline]);

  // ── Fetch history ─────────────────────────────────────────────
  const fetchHistory = useCallback(async (id, r) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/telemetry/history?deviceId=${encodeURIComponent(id)}&range=${r}`);
      if (!res.ok) return;
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }, [API_BASE]);

  // ── Charge les données quand device/range change ──────────────
  useEffect(() => {
    if (!deviceId) return;
    setLoading(true);
    Promise.all([fetchLatest(deviceId), fetchHistory(deviceId, range)])
      .finally(() => setLoading(false));
  }, [deviceId, range, fetchLatest, fetchHistory]);

  // ── Socket.IO : mises à jour live ────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    const onUpdate = (payload) => {
      // Ignorer les updates d'autres devices si on a un device sélectionné
      if (deviceId && payload.deviceId !== deviceId) return;

      setLatest(payload);
      markOnline();

      setHistory(prev => {
        const next = [...prev, payload];
        return next.length > MAX_HISTORY_POINTS ? next.slice(-MAX_HISTORY_POINTS) : next;
      });
    };

    socket.on('telemetry_update', onUpdate);
    return () => socket.off('telemetry_update', onUpdate);
  }, [deviceId, markOnline]);

  // ── Données des graphes (extraites de l'historique) ──────────
  const powerPoints    = history.map(h => ({ ts: h.ts, value: h.energy.powerW }));
  const batteryPoints  = history.map(h => ({ ts: h.ts, value: h.battery.percentage }));
  const supercapPoints = history.map(h => ({ ts: h.ts, value: h.energy.supercapV }));

  const bat  = latest?.battery;
  const ene  = latest?.energy;
  const diag = latest?.diagnostics;

  // ── Rendu ─────────────────────────────────────────────────────
  return (
    <section className="iot-section">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="iot-header">
        <h1>
          <i className="fa-solid fa-microchip" />
          IoT Dashboard — ESP32
        </h1>
        <div className="iot-header-right">
          <StatusBadge online={online} />
          {lastUpdate && (
            <span className="iot-last-update">
              Mis à jour {timeAgo(lastUpdate)}
            </span>
          )}
          <select
            className="iot-device-select"
            value={deviceId || ''}
            onChange={e => setDeviceId(e.target.value)}
          >
            {devices.length === 0
              ? <option value="">Aucun device</option>
              : devices.map(d => (
                  <option key={d.device_id} value={d.device_id}>
                    {d.device_id}
                    {d.firmware_version ? ` (v${d.firmware_version})` : ''}
                  </option>
                ))
            }
          </select>
        </div>
      </div>

      {/* ── État vide ──────────────────────────────────────────── */}
      {!loading && !latest && (
        <div className="iot-empty">
          <i className="fa-solid fa-satellite-dish" />
          <p>En attente de données — <strong>{deviceId || 'aucun device'}</strong></p>
          <span>
            Le dashboard s'actualisera dès réception du premier paquet de l'ESP32.
            Assurez-vous que le device est connecté et envoie des données sur
            <code style={{ margin: '0 4px', fontSize: 12 }}>POST /api/telemetry</code>.
          </span>
        </div>
      )}

      {/* ── Loader ─────────────────────────────────────────────── */}
      {loading && (
        <div className="iot-empty">
          <i className="fa-solid fa-circle-notch fa-spin" style={{ opacity: 0.4, fontSize: 36 }} />
          <p style={{ fontSize: 14 }}>Chargement des données…</p>
        </div>
      )}

      {!loading && latest && (
        <>
          {/* ══════════════════════════════════════════════════════
              SECTION 1 — Live Status (cartes)
          ══════════════════════════════════════════════════════ */}
          <div className="iot-cards-section">
            <h2 className="iot-section-label">
              <i className="fa-solid fa-bolt" />
              Statut en direct
            </h2>

            <div className="iot-cards">

              {/* Batterie */}
              <StatCard icon="fa-battery-three-quarters" label="Batterie" colorClass="iot-card--battery">
                <div className="iot-card-header" style={{ marginBottom: 0, marginTop: -8 }}>
                  <span className={`iot-badge ${bat.charging ? 'badge-charging' : 'badge-discharging'}`} style={{ marginLeft: 'auto', fontSize: 10 }}>
                    {bat.charging ? '⚡ En charge' : '↓ Décharge'}
                  </span>
                </div>
                <div className="iot-card-value" style={{ marginTop: 8 }}>
                  {bat.percentage}<span className="unit">%</span>
                </div>
                <div className="iot-battery-bar">
                  <div
                    className="iot-battery-fill"
                    style={{
                      width: `${bat.percentage}%`,
                      background: bat.percentage > 50
                        ? '#27ae60'
                        : bat.percentage > 20
                          ? '#f39c12'
                          : '#e74c3c',
                    }}
                  />
                </div>
                <div className="iot-card-sub">{bat.voltageV.toFixed(3)} V</div>
              </StatCard>

              {/* Puissance consommée */}
              <StatCard icon="fa-plug" label="Puissance consommée" colorClass="iot-card--power">
                <div className="iot-card-value">
                  {ene.powerW.toFixed(3)}<span className="unit">W</span>
                </div>
                <div className="iot-card-meta">
                  <span>
                    <i className="fa-solid fa-arrow-trend-down" />
                    {ene.consumedJ.toFixed(3)} J consommés
                  </span>
                  <span>
                    <i className="fa-solid fa-arrow-trend-up" />
                    {ene.providedJ.toFixed(3)} J récupérés
                  </span>
                  <span>
                    <i className="fa-solid fa-bolt-lightning" />
                    {ene.currentA.toFixed(4)} A
                  </span>
                </div>
              </StatCard>

              {/* Energy Harvesting */}
              <StatCard icon="fa-sun" label="Energy Harvesting" colorClass="iot-card--harvest">
                <div className="iot-card-value">
                  {ene.supercapV.toFixed(3)}<span className="unit">V</span>
                </div>
                <div className="iot-card-sub">Supercap ({ene.supercapF} F)</div>
                <div className="iot-card-meta">
                  <span>LTC3588: {ene.ltc3588V.toFixed(3)} V</span>
                  <span>Système: {ene.systemV.toFixed(3)} V</span>
                </div>
              </StatCard>

              {/* Boost MT3608 */}
              <StatCard icon="fa-gauge-high" label="Boost MT3608" colorClass="iot-card--boost">
                <div className="iot-card-value">
                  {diag.mt3608V.toFixed(3)}<span className="unit">V</span>
                </div>
                <div className="iot-card-meta">
                  <span>Tension nominale cible : 5.0 V</span>
                  <span
                    style={{
                      color: Math.abs(diag.mt3608V - 5.0) < 0.15
                        ? '#27ae60'
                        : '#e74c3c',
                      fontWeight: 600,
                    }}
                  >
                    {Math.abs(diag.mt3608V - 5.0) < 0.15 ? '✓ Stable' : '⚠ Hors plage'}
                  </span>
                </div>
              </StatCard>

              {/* Diagnostics */}
              <StatCard icon="fa-stethoscope" label="Diagnostics" colorClass="iot-card--diag">
                <div className="iot-diag-row">
                  <span className="iot-diag-label">
                    <i className="fa-solid fa-wifi" /> WiFi
                  </span>
                  <span className={`iot-badge ${diag.wifiActive ? 'badge-ok' : 'badge-err'}`}>
                    {diag.wifiActive ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <div className="iot-diag-row">
                  <span className="iot-diag-label">
                    <i className="fa-solid fa-tower-broadcast" /> ESP-NOW TX
                  </span>
                  <span className={`iot-badge ${diag.espNowOk ? 'badge-ok' : 'badge-err'}`}>
                    {diag.espNowOk ? 'OK' : 'FAIL'}
                  </span>
                </div>
                <div className="iot-diag-row">
                  <span className="iot-diag-label">
                    <i className="fa-solid fa-wave-square" /> ACS712 raw
                  </span>
                  <span className="iot-diag-val">{diag.acs712Raw}</span>
                </div>
              </StatCard>

            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              SECTION 2 — Graphes temps réel
          ══════════════════════════════════════════════════════ */}
          <div className="iot-charts-section">
            <div className="iot-charts-header">
              <h2 className="iot-section-label">
                <i className="fa-solid fa-chart-line" />
                Graphes temps réel
              </h2>
              <div className="iot-range-btns">
                {[
                  { key: '10m', label: '10 min' },
                  { key: '1h',  label: '1 h' },
                  { key: '24h', label: '24 h' },
                  { key: '7d',  label: '7 j' },
                ].map(r => (
                  <button
                    key={r.key}
                    className={`iot-range-btn ${range === r.key ? 'active' : ''}`}
                    onClick={() => setRange(r.key)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="iot-charts-grid">
              <MiniChart
                data={powerPoints}
                color="#e74c3c"
                label="Puissance consommée (W)"
                yLabel="W"
                yMin={0}
              />
              <MiniChart
                data={batteryPoints}
                color="#27ae60"
                label="Batterie (%)"
                yLabel="%"
                yMin={0}
                yMax={100}
              />
              <MiniChart
                data={supercapPoints}
                color="#3498db"
                label="Supercapaciteur (V)"
                yLabel="V"
                yMin={0}
              />
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              SECTION 3 — Historique (table)
          ══════════════════════════════════════════════════════ */}
          <div className="iot-history-section">
            <h2 className="iot-section-label">
              <i className="fa-solid fa-clock-rotate-left" />
              Historique — {history.length} point{history.length !== 1 ? 's' : ''}
            </h2>

            <div className="iot-table-wrap">
              <table className="iot-table">
                <thead>
                  <tr>
                    <th>Horodatage</th>
                    <th>Device</th>
                    <th>Power (W)</th>
                    <th>Batterie</th>
                    <th>Supercap (V)</th>
                    <th>Consommé (J)</th>
                    <th>Récupéré (J)</th>
                    <th>WiFi</th>
                    <th>ESP-NOW</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                        Aucun enregistrement dans la plage sélectionnée
                      </td>
                    </tr>
                  )}
                  {[...history].reverse().slice(0, 50).map((h, i) => (
                    <tr key={`${h.ts}-${i}`}>
                      <td className="iot-td-time">{fmtFull(h.ts)}</td>
                      <td>
                        <span className="iot-device-tag">{h.deviceId}</span>
                      </td>
                      <td>{h.energy.powerW.toFixed(3)}</td>
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            color: h.battery.percentage > 50
                              ? '#1e8449'
                              : h.battery.percentage > 20
                                ? '#b7770d'
                                : '#c0392b',
                          }}
                        >
                          {h.battery.percentage}%
                        </span>
                        <span style={{ color: 'var(--muted)', marginLeft: 4, fontSize: 11 }}>
                          {h.battery.voltageV.toFixed(3)} V
                        </span>
                      </td>
                      <td>{h.energy.supercapV.toFixed(3)}</td>
                      <td>{h.energy.consumedJ.toFixed(3)}</td>
                      <td>{h.energy.providedJ.toFixed(3)}</td>
                      <td>
                        <span className={`iot-badge-sm ${h.diagnostics.wifiActive ? 'badge-ok' : 'badge-err'}`}>
                          {h.diagnostics.wifiActive ? '✓' : '✗'}
                        </span>
                      </td>
                      <td>
                        <span className={`iot-badge-sm ${h.diagnostics.espNowOk ? 'badge-ok' : 'badge-err'}`}>
                          {h.diagnostics.espNowOk ? '✓' : '✗'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
