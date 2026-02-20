import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPriorityLabel, getStatutLabel, sortAlertsByPriority } from '../../utils/helpers';
import '../../css/alerts.css';

export default function TechAlerts() {
  const { API_BASE, user } = useAuth();
  const { globalSearch } = useOutletContext() || {};
  const [alerts, setAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState('citoyen');
  const [filters, setFilters] = useState({ priority: '', status: '' });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewAlert, setViewAlert] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    fetch(`${API_BASE}/alertes/by-tech/${user.id}`)
      .then(r => r.json())
      .then(d => setAlerts(Array.isArray(d) ? d : []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [API_BASE, user?.id]);

  const tabAlerts = alerts.filter(a => a.source_type === activeTab);
  const activeSearch = search || globalSearch || '';

  const filtered = sortAlertsByPriority(tabAlerts.filter(a => {
    if (filters.priority && a.priorite !== filters.priority) return false;
    if (filters.status && a.statut !== filters.status) return false;
    if (activeSearch) {
      const s = activeSearch.toLowerCase();
      const matchName = (a.nom_demandeur || '').toLowerCase().includes(s);
      const matchEmail = (a.email || '').toLowerCase().includes(s);
      const matchMsg = (a.description || '').toLowerCase().includes(s);
      if (!matchName && !matchEmail && !matchMsg) return false;
    }
    return true;
  }));

  const handleStatus = async (id, statut) => {
    try {
      await fetch(`${API_BASE}/alertes/${id}/statut`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut, technicien_id: user?.id }),
      });
      if (statut === 'resolue') {
        setAlerts(prev => prev.filter(a => a.id !== id));
      } else {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, statut } : a));
      }
    } catch { /* ignore */ }
  };

  // Parse old-format descriptions that have email/sujet stuffed inside
  const parseAlerte = (a) => {
    if (a.email) return { email: a.email, message: a.description || '' };
    const desc = a.description || '';
    let email = '';
    let message = desc;
    const emailMatch = desc.match(/Email\s*:\s*(.+)/i);
    if (emailMatch) email = emailMatch[1].trim();
    const msgMatch = desc.match(/Message\s*:\s*\n?([\s\S]*)/i);
    if (msgMatch) message = msgMatch[1].trim();
    return { email: email || '', message: message || desc };
  };

  const resetFilters = () => {
    setFilters({ priority: '', status: '' });
    setSearch('');
  };

  return (
    <div className="alert-container">
      <div className="alert-header">
        <h1 className="alert-title">Mes alertes</h1>
      </div>

      <div className="alertes-switch">
        <button className={`switch-btn${activeTab === 'citoyen' ? ' active' : ''}`} onClick={() => setActiveTab('citoyen')}>
          Citoyen
        </button>
        <button className={`switch-btn${activeTab === 'entreprise' ? ' active' : ''}`} onClick={() => setActiveTab('entreprise')}>
          Entreprise
        </button>
      </div>

      <div className="alert-filters">
        <div className="filter-group">
          <label>Recherche</label>
          <input
            type="text"
            className="alert-search"
            placeholder="Nom, email, message..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>Priorité</label>
          <select value={filters.priority} onChange={e => setFilters({ ...filters, priority: e.target.value })}>
            <option value="">Toutes</option>
            <option value="haute">Haute (Panne)</option>
            <option value="moyenne">Moyenne (Autre)</option>
            <option value="basse">Basse (Proposition)</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Statut</label>
          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Tous</option>
            <option value="nouveau">Nouveau</option>
            <option value="en_cours">En cours</option>
          </select>
        </div>
        <div className="filter-group">
          <label>&nbsp;</label>
          <button className="btn-reset-filter" onClick={resetFilters}>Réinitialiser</button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="alert-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Message</th>
              <th>Priorité</th>
              <th>Statut</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7"><div className="loading-container"><div className="spinner"></div><span className="loading-text">Chargement...</span></div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Aucune alerte assignée</td></tr>
            ) : filtered.map(a => {
              const parsed = parseAlerte(a);
              return (
              <tr key={a.id}>
                <td>{a.nom_demandeur || '-'}</td>
                <td>{parsed.email || '-'}</td>
                <td className="message-cell" title={parsed.message}>{parsed.message || '-'}</td>
                <td><span className={`badge ${a.priorite || ''}`}>{getPriorityLabel(a.priorite)}</span></td>
                <td>
                  <select
                    className="status-select"
                    value={a.statut || ''}
                    onChange={e => handleStatus(a.id, e.target.value)}
                  >
                    <option value="nouveau">Nouveau</option>
                    <option value="en_cours">En cours</option>
                    <option value="resolue">Résolue</option>
                  </select>
                </td>
                <td>{a.date_creation ? new Date(a.date_creation).toLocaleString('fr-FR') : '-'}</td>
                <td>
                  <div className="action-btns">
                    <button className="btn-action-sm view" onClick={() => setViewAlert(a)} title="Voir">
                      <i className="fa-solid fa-eye"></i>
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Voir détail */}
      {viewAlert && (() => {
        const parsed = parseAlerte(viewAlert);
        return (
          <>
            <div className="modal-overlay active" onClick={() => setViewAlert(null)}></div>
            <div className="alert-detail-modal active">
              <div className="modal-header">
                <h3><i className="fa-solid fa-eye"></i> Détail de l'alerte</h3>
                <button className="close-modal" onClick={() => setViewAlert(null)}>&times;</button>
              </div>
              <div className="modal-content">
                <div className="detail-grid">
                  <div className="detail-row"><span className="detail-label">Nom</span><span>{viewAlert.nom_demandeur || '-'}</span></div>
                  <div className="detail-row"><span className="detail-label">Email</span><span>{parsed.email || '-'}</span></div>
                  <div className="detail-row"><span className="detail-label">Priorité</span><span className={`badge ${viewAlert.priorite || ''}`}>{getPriorityLabel(viewAlert.priorite)}</span></div>
                  <div className="detail-row"><span className="detail-label">Statut</span><span className={`badge statut-${viewAlert.statut || ''}`}>{getStatutLabel(viewAlert.statut)}</span></div>
                  <div className="detail-row"><span className="detail-label">Date</span><span>{viewAlert.date_creation ? new Date(viewAlert.date_creation).toLocaleString('fr-FR') : '-'}</span></div>
                </div>
                <div className="detail-message">
                  <span className="detail-label">Message</span>
                  <p>{parsed.message || '-'}</p>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setViewAlert(null)}>Fermer</button>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
