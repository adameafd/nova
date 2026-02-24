import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getStatutLabel, sortAlertsByPriority } from '../../utils/helpers';
import '../../css/alerts.css';

// ── Helpers locaux ─────────────────────────────────────────────────────
function getCategorieClass(categorie) {
  const c = categorie || '';
  if (c === 'Panne ou dysfonctionnement') return 'type-panne';
  if (c === "Proposition d'amélioration") return 'type-proposition';
  return 'type-autre';
}

function getCategorieLabel(categorie) {
  return categorie || 'Autre';
}

function getPrioLabel(p) {
  if (p === 'haute')   return 'Haute';
  if (p === 'moyenne') return 'Moyenne';
  return 'Basse';
}

// Dérive la priorité depuis categorie si priorite absent en DB
function getPrioEffective(a) {
  if (a.priorite === 'haute' || a.priorite === 'moyenne' || a.priorite === 'basse') return a.priorite;
  const c = a.categorie || '';
  if (c === 'Panne ou dysfonctionnement') return 'haute';
  if (c === "Proposition d'amélioration") return 'moyenne';
  return 'basse';
}

function cap(str) {
  if (!str) return '-';
  return String(str).charAt(0).toUpperCase() + String(str).slice(1);
}

// Statuts qui basculent dans Historique (identiques pour admin + tech → historique commun)
const STATUTS_ARCHIVES = ['traitee', 'annulee', 'resolue'];

// Options de statut disponibles pour le tech (quand il est assigné)
const STATUT_OPTIONS = [
  { value: 'en_cours', label: 'En cours' },
  { value: 'resolue',  label: 'Résolue'  },
  { value: 'annulee',  label: 'Annulée'  },
];

export default function TechAlerts() {
  const { API_BASE, user } = useAuth();
  const { globalSearch } = useOutletContext() || {};

  const [allAlerts, setAllAlerts] = useState([]);
  const [mode,      setMode]      = useState('en_cours');
  const [filters,   setFilters]   = useState({ type: '' });
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [viewAlert, setViewAlert] = useState(null);
  const [savingId,  setSavingId]  = useState(null);

  const myId = Number(user?.id);

  const fetchAlerts = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/alertes`)
      .then(r => r.json())
      .then(d => setAllAlerts(Array.isArray(d) ? d : []))
      .catch(() => setAllAlerts([]))
      .finally(() => setLoading(false));
  }, [API_BASE]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // ── Partition ─────────────────────────────────────────────────────
  const enCoursAlerts    = allAlerts.filter(a => !STATUTS_ARCHIVES.includes(a.statut));
  const historiqueAlerts = allAlerts.filter(a =>  STATUTS_ARCHIVES.includes(a.statut));
  const modeAlerts       = mode === 'historique' ? historiqueAlerts : enCoursAlerts;

  const activeSearch = search || globalSearch || '';

  const filtered = sortAlertsByPriority(
    modeAlerts.filter(a => {
      if (filters.type && getCategorieClass(a.categorie) !== filters.type) return false;
      if (activeSearch) {
        const s = activeSearch.toLowerCase();
        if (
          !(a.nom_demandeur || '').toLowerCase().includes(s) &&
          !(a.email         || '').toLowerCase().includes(s) &&
          !(a.description   || '').toLowerCase().includes(s)
        ) return false;
      }
      return true;
    })
  );

  // ── PATCH statut — uniquement si assigné ─────────────────────────
  const handleStatus = async (e, id, statut) => {
    e.stopPropagation();
    setSavingId(id);
    try {
      const res = await fetch(`${API_BASE}/alertes/${id}/statut`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut, technicien_id: myId }),
      });
      if (!res.ok) throw new Error();
      setAllAlerts(prev => prev.map(a => a.id === id ? { ...a, statut } : a));
    } catch { /* ignore */ } finally {
      setSavingId(null);
    }
  };

  const parseAlerte = (a) => {
    if (a.email) return { email: a.email, message: a.description || '' };
    const desc       = a.description || '';
    const emailMatch = desc.match(/Email\s*:\s*(.+)/i);
    const msgMatch   = desc.match(/Message\s*:\s*\n?([\s\S]*)/i);
    return {
      email:   emailMatch ? emailMatch[1].trim() : '',
      message: msgMatch   ? msgMatch[1].trim()   : desc,
    };
  };

  const currentStatut = (a) =>
    STATUT_OPTIONS.some(o => o.value === a.statut) ? a.statut : 'en_cours';

  const resetFilters = () => { setFilters({ type: '' }); setSearch(''); };

  const isHistorique = mode === 'historique';

  return (
    <div className="alert-container">
      <div className="alert-header">
        <div className="alert-title-wrap">
          <h1 className="alert-title">Alertes</h1>
          <span className="mode-badge">{isHistorique ? 'Historique' : 'En direct'}</span>
        </div>
      </div>

      {/* Onglets */}
      <div className="mode-tabs">
        <button
          className={`mode-tab${mode === 'en_cours' ? ' active' : ''}`}
          onClick={() => setMode('en_cours')}
        >
          <i className="fa-solid fa-clock-rotate-left"></i>
          En cours
          {enCoursAlerts.length > 0 && (
            <span className="mode-tab-count">{enCoursAlerts.length}</span>
          )}
        </button>
        <button
          className={`mode-tab${mode === 'historique' ? ' active' : ''}`}
          onClick={() => setMode('historique')}
        >
          <i className="fa-solid fa-check-circle"></i>
          Historique
          {historiqueAlerts.length > 0 && (
            <span className="mode-tab-count resolved">{historiqueAlerts.length}</span>
          )}
        </button>
      </div>

      {/* Filtres */}
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
          <label>Type</label>
          <select value={filters.type} onChange={e => setFilters({ type: e.target.value })}>
            <option value="">Tous</option>
            <option value="type-panne">Panne ou dysfonctionnement</option>
            <option value="type-proposition">Proposition d'amélioration</option>
            <option value="type-autre">Autre</option>
          </select>
        </div>
        <div className="filter-group">
          <label>&nbsp;</label>
          <button className="btn-reset-filter" onClick={resetFilters}>Réinitialiser</button>
        </div>
      </div>

      {/* Tableau */}
      <div className="table-wrapper">
        <table className="alert-table">
          <thead>
            <tr>
              <th>Demandeur</th>
              <th>Email</th>
              <th>Message</th>
              <th>Priorité</th>
              <th>Statut</th>
              <th>{isHistorique ? 'Date résolution' : 'Date'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6">
                  <div className="loading-container">
                    <div className="spinner"></div>
                    <span className="loading-text">Chargement...</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
                  {isHistorique ? "Aucune alerte dans l'historique" : 'Aucune alerte en cours'}
                </td>
              </tr>
            ) : filtered.map(a => {
              const parsed     = parseAlerte(a);
              const isSaving   = savingId === a.id;
              const isAssigned = Number(a.technicien_id) === myId;
              const dateVal    = isHistorique
                ? (a.date_mise_a_jour || a.date_creation)
                : a.date_creation;

              return (
                <tr
                  key={a.id}
                  className={`row-clickable${isSaving ? ' row-saving' : ''}`}
                  onClick={() => setViewAlert(a)}
                >
                  <td>
                    {cap(a.nom_demandeur)}
                    {isAssigned && <span className="badge-assigned">Ma tâche</span>}
                  </td>
                  <td>{parsed.email || '-'}</td>
                  <td className="message-cell" title={parsed.message}>
                    {parsed.message || '-'}
                  </td>

                  {/* Priorité */}
                  <td>
                    <span className={`badge prio-${getPrioEffective(a)}`}>
                      {getPrioLabel(getPrioEffective(a))}
                    </span>
                  </td>

                  {/* Statut — select si assigné + en cours, badge sinon */}
                  <td onClick={e => e.stopPropagation()}>
                    {isHistorique || !isAssigned ? (
                      <span className={`badge statut-${a.statut || ''}`}>
                        {getStatutLabel(a.statut)}
                      </span>
                    ) : (
                      <select
                        className="inline-select status-select"
                        value={currentStatut(a)}
                        disabled={isSaving}
                        onChange={e => handleStatus(e, a.id, e.target.value)}
                      >
                        {STATUT_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    )}
                  </td>

                  <td className="date-cell">
                    {dateVal ? new Date(dateVal).toLocaleDateString('fr-FR') : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal détail */}
      {viewAlert && (() => {
        const parsed     = parseAlerte(viewAlert);
        const dateResol  = viewAlert.date_mise_a_jour || viewAlert.date_creation;
        const isAssigned = Number(viewAlert.technicien_id) === myId;
        return (
          <>
            <div className="modal-overlay active" onClick={() => setViewAlert(null)} />
            <div className="alert-detail-modal active">
              <div className="modal-header">
                <h3><i className="fa-solid fa-circle-info"></i> Détail de l'alerte</h3>
                <button className="close-modal" onClick={() => setViewAlert(null)}>&times;</button>
              </div>
              <div className="modal-content">
                <div className="detail-grid">
                  <div className="detail-row">
                    <span className="detail-label">Demandeur</span>
                    <span>{cap(viewAlert.nom_demandeur)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Email</span>
                    <span>{parsed.email || '-'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Type</span>
                    <span className={`badge ${getCategorieClass(viewAlert.categorie)}`}>
                      {getCategorieLabel(viewAlert.categorie)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Priorité</span>
                    <span className={`badge prio-${getPrioEffective(viewAlert)}`}>
                      {getPrioLabel(getPrioEffective(viewAlert))}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Statut</span>
                    <span className={`badge statut-${viewAlert.statut || ''}`}>
                      {getStatutLabel(viewAlert.statut)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Assigné à</span>
                    <span>
                      {viewAlert.technicien_nom
                        ? <>{cap(viewAlert.technicien_nom)}{isAssigned && <span className="badge-assigned">vous</span>}</>
                        : <em style={{ color: 'var(--muted)' }}>Non assigné</em>}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Reçue le</span>
                    <span className="date-cell">
                      {viewAlert.date_creation
                        ? new Date(viewAlert.date_creation).toLocaleString('fr-FR')
                        : '-'}
                    </span>
                  </div>
                  {STATUTS_ARCHIVES.includes(viewAlert.statut) && (
                    <div className="detail-row">
                      <span className="detail-label">Clôturée le</span>
                      <span className="date-cell">
                        {dateResol ? new Date(dateResol).toLocaleString('fr-FR') : '-'}
                      </span>
                    </div>
                  )}
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
