import { useState, useEffect, useCallback, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Filler,
} from 'chart.js';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../socket';
import '../../css/dashboard.css';
import '../../css/iot-dashboard.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

// ── Constantes ────────────────────────────────────────────────────────────────
const OFFLINE_THRESHOLD_MS = 60_000;
const MAX_HISTORY_POINTS   = 300;

// ── Utilitaires timestamps ─────────────────────────────────────────────────────
// Garantit que le timestamp est en millisecondes (gère secondes OU ms)
function toMs(ts) {
  if (ts === null || ts === undefined) return null;
  return ts > 1e11 ? ts : ts * 1000;
}

function fmtTime(ts) {
  const ms = toMs(ts);
  if (!ms) return '--';
  return new Date(ms).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function fmtDate(ts) {
  const ms = toMs(ts);
  if (!ms) return '--';
  return new Date(ms).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function fmtFull(ts) {
  const ms = toMs(ts);
  if (!ms) return '--';
  return new Date(ms).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function timeAgo(date) {
  if (!date) return '—';
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 5)    return "à l'instant";
  if (diff < 60)   return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  return `il y a ${Math.floor(diff / 3600)} h`;
}

// Affiche "--" si null/undefined, sinon formate le nombre
function fmt(val, decimals = 3) {
  if (val === null || val === undefined) return '--';
  return parseFloat(val).toFixed(decimals);
}

// ── % charge Li-ion 1 cellule (calcul front, pas stocké en DB) ───────────────
const BAT_V_MIN = 3.3;   // tension vide  (0 %)
const BAT_V_MAX = 4.2;   // tension pleine (100 %)

function voltToPercent(v) {
  if (v === null || v === undefined) return null;
  const pct = Math.round(((parseFloat(v) - BAT_V_MIN) / (BAT_V_MAX - BAT_V_MIN)) * 100);
  return Math.min(100, Math.max(0, pct));
}

// ── Label axe X adaptatif selon la plage choisie ──────────────────────────────
function chartLabel(ts, range) {
  const ms = toMs(ts);
  if (!ms) return '--';
  const d = new Date(ms);
  if (range === '7d')
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (range === '24h')
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  // 10m / 1h → HH:mm:ss
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Badge Online / Offline ────────────────────────────────────────────────────
function StatusBadge({ online }) {
  return (
    <span className={`iot-status-badge ${online ? 'online' : 'offline'}`}>
      <span className="iot-dot" />
      {online ? 'En ligne' : 'Hors ligne'}
    </span>
  );
}

// ── Mini graphe ligne ─────────────────────────────────────────────────────────
// data  = [{ ts: number (ms ou s), value: number|null }] trié ASC
// range = '10m' | '1h' | '24h' | '7d' — pour adapter le format des labels X
function MiniChart({ data, color, label, yLabel, range = '10m' }) {
  // Labels adaptés à la plage : HH:mm:ss pour 10m/1h, HH:mm pour 24h, dd/MM HH:mm pour 7d
  const labels = data.map(d => chartLabel(d.ts, range));
  const values = data.map(d => (d.value !== null && d.value !== undefined ? d.value : null));

  const chartData = {
    labels,
    datasets: [{
      data: values,
      borderColor: color,
      backgroundColor: `${color}18`,
      fill: true,
      tension: 0.35,
      pointRadius: data.length > 60 ? 0 : 2,
      borderWidth: 2,
      spanGaps: true,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          // Tooltip affiche toujours HH:mm:ss quelle que soit la plage
          title: (items) => {
            const idx = items[0]?.dataIndex;
            if (idx === undefined) return '';
            return fmtTime(data[idx]?.ts);
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          maxTicksLimit: 6,      // au max 6 graduations visibles
          autoSkip: true,         // saute les labels qui se chevauchent
          maxRotation: 0,         // labels horizontaux, jamais inclinés
          font: { size: 10 },
          color: '#9fb3c6',
        },
        grid: { color: 'rgba(0,0,0,0.04)' },
      },
      y: {
        title: { display: true, text: yLabel, font: { size: 10 }, color: '#9fb3c6' },
        ticks: { font: { size: 10 }, color: '#9fb3c6' },
        grid:  { color: 'rgba(0,0,0,0.04)' },
      },
    },
  };

  if (data.length === 0) {
    return (
      <div className="iot-chart-card">
        <div className="iot-chart-label">
          <span className="iot-chart-dot" style={{ background: color }} />
          {label}
        </div>
        <div className="iot-chart-body" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--muted)', fontSize: 12,
        }}>
          Aucune donnée
        </div>
      </div>
    );
  }

  return (
    <div className="iot-chart-card">
      <div className="iot-chart-label">
        <span className="iot-chart-dot" style={{ background: color }} />
        {label}
      </div>
      <div className="iot-chart-body">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}

// ── Dashboard principal ───────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { API_BASE } = useAuth();

  const [devices,    setDevices]    = useState([]);
  const [deviceId,   setDeviceId]   = useState(null);
  const [latest,     setLatest]     = useState(null);
  const [history,    setHistory]    = useState([]);
  const [range,      setRange]      = useState('10m');
  const [online,     setOnline]     = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Ticker pour rafraîchir "il y a Xs" sans refetch réseau
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const offlineTimer = useRef(null);

  const markOnline = useCallback(() => {
    setOnline(true);
    setLastUpdate(new Date());
    clearTimeout(offlineTimer.current);
    offlineTimer.current = setTimeout(() => setOnline(false), OFFLINE_THRESHOLD_MS);
  }, []);

  useEffect(() => () => clearTimeout(offlineTimer.current), []);

  // ── Fetch liste des appareils ──────────────────────────────────
  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/telemetry/devices`);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setDevices(data);
        // Sélectionne le premier appareil si aucun n'est déjà sélectionné
        setDeviceId(prev => prev ?? data[0].device_id);
      } else {
        setDevices([]);
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  // ── Fetch dernière mesure ──────────────────────────────────────
  const fetchLatest = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/telemetry/latest?deviceId=${encodeURIComponent(id)}`);
      if (res.status === 404) { setLatest(null); return; }
      if (!res.ok) return;
      const data = await res.json();
      setLatest(data);
      markOnline();
    } catch { /* ignore */ }
  }, [API_BASE, markOnline]);

  // ── Fetch historique ───────────────────────────────────────────
  const fetchHistory = useCallback(async (id, r) => {
    if (!id) return;
    try {
      const res = await fetch(
        `${API_BASE}/telemetry/history?deviceId=${encodeURIComponent(id)}&range=${r}`
      );
      if (!res.ok) return;
      const data = await res.json();
      // Trier par timestamp croissant pour la timeline des graphes
      const sorted = Array.isArray(data)
        ? [...data].sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp))
        : [];
      setHistory(sorted);
    } catch { /* ignore */ }
  }, [API_BASE]);

  // ── Rafraîchissement manuel ────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    if (!deviceId) { fetchDevices(); return; }
    setRefreshing(true);
    await Promise.all([fetchLatest(deviceId), fetchHistory(deviceId, range)]);
    setRefreshing(false);
  }, [deviceId, range, fetchDevices, fetchLatest, fetchHistory]);

  // ── Chargement initial + changement appareil / plage ──────────
  useEffect(() => {
    if (!deviceId) return;
    setLoading(true);
    Promise.all([fetchLatest(deviceId), fetchHistory(deviceId, range)])
      .finally(() => setLoading(false));
  }, [deviceId, range, fetchLatest, fetchHistory]);

  // ── Socket.IO : mise à jour temps réel ────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    const onUpdate = (payload) => {
      if (deviceId && payload.deviceId !== deviceId) return;
      setLatest(payload);
      markOnline();
      setHistory(prev => {
        const next = [...prev, payload].sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp));
        return next.length > MAX_HISTORY_POINTS ? next.slice(-MAX_HISTORY_POINTS) : next;
      });
    };

    socket.on('telemetry_update', onUpdate);
    return () => socket.off('telemetry_update', onUpdate);
  }, [deviceId, markOnline]);

  // ── Données graphes (triées, timestamp en ms) ──────────────────
  const batVoltagePoints = history.map(h => ({ ts: h.timestamp, value: h.battery?.voltage  ?? null }));
  const scVoltagePoints  = history.map(h => ({ ts: h.timestamp, value: h.supercap?.voltage ?? null }));
  const batCurrentPoints = history.map(h => ({ ts: h.timestamp, value: h.battery?.current_a ?? null }));

  const sc  = latest?.supercap;
  const bat = latest?.battery;
  const sys = latest?.system;

  // ── Rendu ──────────────────────────────────────────────────────
  return (
    <section className="dashboard-section">

      {/* ── En-tête ─────────────────────────────────────────────── */}
      <div className="iot-header" style={{ marginBottom: 24 }}>
        <h1>
          <i className="fa-solid fa-microchip" />
          Dashboard IoT — ESP32
        </h1>
        <div className="iot-header-right">
          <StatusBadge online={online} />
          {lastUpdate && (
            <span className="iot-last-update">Mis à jour {timeAgo(lastUpdate)}</span>
          )}
          <select
            className="iot-device-select"
            value={deviceId || ''}
            onChange={e => setDeviceId(e.target.value)}
          >
            {devices.length === 0
              ? <option value="">Aucun appareil</option>
              : devices.map(d => (
                  <option key={d.device_id} value={d.device_id}>
                    {d.device_id}{d.firmware ? ` (v${d.firmware})` : ''}
                  </option>
                ))
            }
          </select>
          <button
            className="iot-refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            title="Rafraîchir les données"
          >
            <i className={`fa-solid fa-arrows-rotate${refreshing ? ' fa-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* ── Chargement ──────────────────────────────────────────── */}
      {loading && (
        <div className="iot-empty">
          <i className="fa-solid fa-circle-notch fa-spin" style={{ opacity: 0.35, fontSize: 36 }} />
          <p style={{ fontSize: 14 }}>Chargement des données IoT…</p>
        </div>
      )}

      {/* ── Aucune donnée ───────────────────────────────────────── */}
      {!loading && !latest && (
        <div className="iot-empty">
          <i className="fa-solid fa-satellite-dish" />
          <p>
            {deviceId
              ? <>Appareil <strong>{deviceId}</strong> — aucune mesure reçue</>
              : <>Aucun appareil enregistré en base</>
            }
          </p>
          <span>
            Connectez l'ESP32 et envoyez un{' '}
            <code style={{ fontSize: 12 }}>POST /api/telemetry</code>{' '}
            pour que les données apparaissent ici.
          </span>
        </div>
      )}

      {/* ── Données disponibles ──────────────────────────────────── */}
      {!loading && latest && (
        <>
          {/* ═══════════════════════════════════════════════════════
              SECTION 1 — Statut en direct
          ═══════════════════════════════════════════════════════ */}
          <div className="iot-cards-section">
            <h2 className="iot-section-label">
              <i className="fa-solid fa-bolt" /> Statut en direct
            </h2>
            <div className="iot-cards">

              {/* Carte Batterie */}
              {(() => {
                const batPct = voltToPercent(bat?.voltage);
                return (
                  <div className="iot-card iot-card--battery">
                    <div className="iot-card-header">
                      <i className="fa-solid fa-battery-three-quarters" />
                      <span>Batterie</span>
                      {bat?.direction && (
                        <span
                          className={`iot-badge ${bat.direction === 'charge' ? 'badge-charging' : 'badge-discharging'}`}
                          style={{ marginLeft: 'auto', fontSize: 10 }}
                        >
                          {bat.direction === 'charge' ? '⚡ En charge' : '↓ Décharge'}
                        </span>
                      )}
                    </div>
                    {/* Valeur principale : tension */}
                    <div className="iot-card-value">
                      {bat?.voltage !== null && bat?.voltage !== undefined
                        ? <>{parseFloat(bat.voltage).toFixed(3)}<span className="unit">V</span></>
                        : '--'
                      }
                    </div>
                    {/* Barre de charge + % estimé */}
                    {batPct !== null && (
                      <>
                        <div className="iot-battery-bar">
                          <div
                            className="iot-battery-fill"
                            style={{
                              width: `${batPct}%`,
                              background: batPct > 50 ? '#27ae60' : batPct > 20 ? '#f39c12' : '#e74c3c',
                            }}
                          />
                        </div>
                        <div className="iot-card-sub">
                          {batPct}% estimé
                          <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6 }}>
                            ({BAT_V_MIN}–{BAT_V_MAX} V)
                          </span>
                        </div>
                      </>
                    )}
                    <div className="iot-card-meta">
                      <span>
                        <i className="fa-solid fa-bolt-lightning" />
                        Courant : {fmt(bat?.current_a, 4)} A
                      </span>
                      {bat?.direction && (
                        <span>
                          <i className="fa-solid fa-arrows-rotate" />
                          État : {bat.direction}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Carte Supercondensateur */}
              <div className="iot-card iot-card--harvest">
                <div className="iot-card-header">
                  <i className="fa-solid fa-sun" />
                  <span>Supercondensateur</span>
                </div>
                <div className="iot-card-value">
                  {sc?.voltage !== null && sc?.voltage !== undefined
                    ? <>{parseFloat(sc.voltage).toFixed(3)}<span className="unit">V</span></>
                    : '--'
                  }
                </div>
                <div className="iot-card-meta">
                  <span>
                    <i className="fa-solid fa-database" />
                    Énergie : {fmt(sc?.energy_j, 2)} J
                  </span>
                </div>
              </div>

              {/* Carte État système */}
              <div className="iot-card iot-card--diag">
                <div className="iot-card-header">
                  <i className="fa-solid fa-stethoscope" />
                  <span>État système</span>
                </div>
                <div className="iot-diag-row">
                  <span className="iot-diag-label">
                    <i className="fa-solid fa-lightbulb" /> LED
                  </span>
                  {sys?.led_on !== null && sys?.led_on !== undefined
                    ? <span className={`iot-badge ${sys.led_on ? 'badge-ok' : 'badge-err'}`}>
                        {sys.led_on ? 'Allumée' : 'Éteinte'}
                      </span>
                    : <span className="iot-diag-val">--</span>
                  }
                </div>
                <div className="iot-diag-row">
                  <span className="iot-diag-label">
                    <i className="fa-solid fa-circle-check" /> Statut
                  </span>
                  {sys?.status
                    ? <span className={`iot-badge ${sys.status === 'OK' ? 'badge-ok' : 'badge-err'}`}>
                        {sys.status}
                      </span>
                    : <span className="iot-diag-val">--</span>
                  }
                </div>
              </div>

              {/* Carte Dernière mesure */}
              <div className="iot-card iot-card--boost">
                <div className="iot-card-header">
                  <i className="fa-solid fa-clock" />
                  <span>Dernière mesure</span>
                </div>
                <div className="iot-card-value" style={{ fontSize: 20 }}>
                  {fmtTime(latest?.timestamp)}
                </div>
                <div className="iot-card-meta">
                  <span>
                    <i className="fa-solid fa-calendar-day" />
                    {fmtDate(latest?.timestamp)}
                  </span>
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>
                    {timeAgo(latest?.receivedAt)}
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 2 — Graphes temps réel
          ═══════════════════════════════════════════════════════ */}
          <div className="iot-charts-section">
            <div className="iot-charts-header">
              <h2 className="iot-section-label">
                <i className="fa-solid fa-chart-line" /> Graphes temps réel
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
                data={batVoltagePoints}
                color="#27ae60"
                label="Batterie — Tension (V)"
                yLabel="V"
                range={range}
              />
              <MiniChart
                data={scVoltagePoints}
                color="#f39c12"
                label="Supercondensateur — Tension (V)"
                yLabel="V"
                range={range}
              />
              <MiniChart
                data={batCurrentPoints}
                color="#3498db"
                label="Courant batterie (A)"
                yLabel="A"
                range={range}
              />
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 3 — Historique
          ═══════════════════════════════════════════════════════ */}
          <div className="iot-history-section">
            <h2 className="iot-section-label">
              <i className="fa-solid fa-clock-rotate-left" />
              Historique — {history.length} point{history.length !== 1 ? 's' : ''}
            </h2>
            <div className="iot-table-wrap">
              <table className="iot-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Appareil</th>
                    <th>Batterie (V)</th>
                    <th>Charge (%)</th>
                    <th>Courant (A)</th>
                    <th>Supercap (V)</th>
                    <th>Énergie (J)</th>
                    <th>LED</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}
                      >
                        Aucune donnée dans la plage sélectionnée
                      </td>
                    </tr>
                  ) : (
                    // Afficher les 50 plus récents (tableau inversé = plus récent en haut)
                    [...history].reverse().slice(0, 50).map((h, i) => (
                      <tr key={`${h.timestamp}-${i}`}>
                        <td className="iot-td-time">{fmtFull(h.timestamp)}</td>
                        <td>
                          <span className="iot-device-tag">{h.deviceId}</span>
                        </td>
                        <td>{fmt(h.battery?.voltage, 3)}</td>
                        <td>
                          {(() => {
                            const p = voltToPercent(h.battery?.voltage);
                            if (p === null) return '--';
                            return (
                              <span style={{
                                fontWeight: 700,
                                color: p > 50 ? '#1e8449' : p > 20 ? '#b7770d' : '#c0392b',
                              }}>
                                {p}%
                              </span>
                            );
                          })()}
                        </td>
                        <td>{fmt(h.battery?.current_a, 4)}</td>
                        <td>{fmt(h.supercap?.voltage,  3)}</td>
                        <td>{fmt(h.supercap?.energy_j, 2)}</td>
                        <td>
                          {h.system?.led_on !== null && h.system?.led_on !== undefined
                            ? <span className={`iot-badge-sm ${h.system.led_on ? 'badge-ok' : 'badge-err'}`}>
                                {h.system.led_on ? '✓' : '✗'}
                              </span>
                            : '--'
                          }
                        </td>
                        <td>
                          {h.system?.status
                            ? <span
                                className={`iot-badge ${h.system.status === 'OK' ? 'badge-ok' : 'badge-err'}`}
                                style={{ fontSize: 10 }}
                              >
                                {h.system.status}
                              </span>
                            : '--'
                          }
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
