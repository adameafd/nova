import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal, { showToast } from '../../components/ConfirmModal';
import { getStatutLabel, sortAlertsByPriority } from '../../utils/helpers';
import '../../css/alerts.css';

// ── Helpers ────────────────────────────────────────────────────────────
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

// Badge CSS selon la categorie
function getCategorieClass(categorie) {
  const c = categorie || '';
  if (c === 'Panne ou dysfonctionnement') return 'type-panne';
  if (c === "Proposition d'amélioration") return 'type-proposition';
  return 'type-autre';
}

// Label affiché (fallback si null)
function getCategorieLabel(categorie) {
  return categorie || 'Autre';
}

function cap(str) {
  if (!str) return '-';
  const s = String(str);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Statuts qui basculent dans l'onglet Historique (commun admin + tech)
const STATUTS_ARCHIVES = ['traitee', 'annulee', 'resolue'];

const STATUT_OPTIONS = [
  { value: 'en_cours', label: 'En cours' },
  { value: 'traitee',  label: 'Traitée'  },
  { value: 'annulee',  label: 'Annulée'  },
];

// ── Composant ──────────────────────────────────────────────────────────
export default function AdminAlerts() {
  const { API_BASE } = useAuth();
  const { globalSearch } = useOutletContext() || {};

  // On charge TOUT d'un coup → on filtre localement par onglet
  const [allAlerts,    setAllAlerts]    = useState([]);
  const [technicians,  setTechnicians]  = useState([]);
  const [mode,         setMode]         = useState('en_cours'); // 'en_cours' | 'historique'
  const [filters,      setFilters]      = useState({ type: '', technician: '' });
  const [search,       setSearch]       = useState('');
  const [loading,      setLoading]      = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [savingId,     setSavingId]     = useState(null);
  const [viewAlert,    setViewAlert]    = useState(null);

  // ── Chargement de toutes les alertes ──────────────────────────────
  const fetchAlerts = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/alertes`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => setAllAlerts(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error('[AdminAlerts] fetch erreur:', err.message);
        setAllAlerts([]);
      })
      .finally(() => setLoading(false));
  }, [API_BASE]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // ── Chargement techniciens ─────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/utilisateurs`)
      .then(r => r.json())
      .then(data =>
        setTechnicians(
          (Array.isArray(data) ? data : []).filter(u =>
            u.role === 'technicien' || u.role === 'tech'
          )
        )
      )
      .catch(() => setTechnicians([]));
  }, [API_BASE]);

  // ── Partition par onglet ───────────────────────────────────────────
  const enCoursAlerts    = allAlerts.filter(a => !STATUTS_ARCHIVES.includes(a.statut));
  const historiqueAlerts = allAlerts.filter(a =>  STATUTS_ARCHIVES.includes(a.statut));
  const modeAlerts       = mode === 'historique' ? historiqueAlerts : enCoursAlerts;

  const activeSearch = search || globalSearch || '';

  const filtered = sortAlertsByPriority(
    modeAlerts.filter(a => {
      if (filters.type       && getCategorieClass(a.categorie) !== filters.type)         return false;
      if (filters.technician && String(a.technicien_id) !== filters.technician)          return false;
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

  // ── PATCH technicien ───────────────────────────────────────────────
  const handleAssign = async (e, id, technicien_id) => {
    e.stopPropagation();
    setSavingId(id);
    try {
      const res = await fetch(`${API_BASE}/alertes/${id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicien_id: technicien_id || null }),
      });
      if (!res.ok) throw new Error();
      const techNom = technicians.find(t => t.id === Number(technicien_id))?.nom || null;
      setAllAlerts(prev =>
        prev.map(a =>
          a.id === id
            ? { ...a, technicien_id: technicien_id ? Number(technicien_id) : null, technicien_nom: techNom }
            : a
        )
      );
      showToast('Technicien mis à jour');
    } catch {
      showToast('Erreur lors de la mise à jour', 'error');
    } finally {
      setSavingId(null);
    }
  };

  // ── PATCH statut — traitée/annulée → glisse dans Historique ────────
  const handleStatus = async (e, id, statut) => {
    e.stopPropagation();
    setSavingId(id);
    try {
      const res = await fetch(`${API_BASE}/alertes/${id}/statut`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || `HTTP ${res.status}`);
      }
      // Met à jour localement : la partition en_cours / historique se recalcule automatiquement
      setAllAlerts(prev => prev.map(a => a.id === id ? { ...a, statut } : a));
      if (STATUTS_ARCHIVES.includes(statut)) {
        showToast("Alerte déplacée vers l'Historique");
      } else {
        showToast('Statut mis à jour');
      }
    } catch (err) {
      console.error('[AdminAlerts] handleStatus erreur:', err.message);
      showToast(`Erreur : ${err.message}`, 'error');
    } finally {
      setSavingId(null);
    }
  };

  // ── Suppression ────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${API_BASE}/alertes/${deleteTarget}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setAllAlerts(prev => prev.filter(x => x.id !== deleteTarget));
      showToast('Alerte supprimée');
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const resetFilters = () => {
    setFilters({ type: '', technician: '' });
    setSearch('');
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

  const isHistorique = mode === 'historique';

  // ── Rendu ──────────────────────────────────────────────────────────
  return (
    <div className="alert-container">

      {/* En-tête */}
      <div className="alert-header">
        <div className="alert-title-wrap">
          <h1 className="alert-title">Alertes</h1>
          <span className="mode-badge">{isHistorique ? 'Historique' : 'En direct'}</span>
        </div>
      </div>

      {/* ── Onglets (même style que Tech) ── */}
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
          <select
            value={filters.type}
            onChange={e => setFilters({ ...filters, type: e.target.value })}
          >
            <option value="">Tous</option>
            <option value="type-panne">Panne ou dysfonctionnement</option>
            <option value="type-proposition">Proposition d'amélioration</option>
            <option value="type-autre">Autre</option>
          </select>
        </div>

        {!isHistorique && (
          <div className="filter-group">
            <label>Technicien</label>
            <select
              value={filters.technician}
              onChange={e => setFilters({ ...filters, technician: e.target.value })}
            >
              <option value="">Tous</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>{cap(t.nom)}</option>
              ))}
            </select>
          </div>
        )}

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
              <th>Technicien</th>
              <th>Statut</th>
              <th>{isHistorique ? 'Date résolution' : 'Date'}</th>
              {!isHistorique && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isHistorique ? 7 : 8}>
                  <div className="loading-container">
                    <div className="spinner" />
                    <span className="loading-text">Chargement…</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={isHistorique ? 7 : 8}
                  style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}
                >
                  {isHistorique ? "Aucune alerte dans l'historique" : 'Aucune alerte en cours'}
                </td>
              </tr>
            ) : filtered.map(a => {
              const parsed   = parseAlerte(a);
              const isSaving = savingId === a.id;
              const dateVal  = isHistorique
                ? (a.date_mise_a_jour || a.date_creation)
                : a.date_creation;

              return (
                <tr
                  key={a.id}
                  className={`row-clickable${isSaving ? ' row-saving' : ''}`}
                  onClick={() => setViewAlert(a)}
                >
                  {/* Demandeur */}
                  <td>{cap(a.nom_demandeur)}</td>

                  {/* Email */}
                  <td>{parsed.email || '-'}</td>

                  {/* Message */}
                  <td className="message-cell" title={parsed.message}>
                    {parsed.message || '-'}
                  </td>

                  {/* Priorité */}
                  <td>
                    <span className={`badge prio-${getPrioEffective(a)}`}>
                      {getPrioLabel(getPrioEffective(a))}
                    </span>
                  </td>

                  {/* Technicien — select (admin only, désactivé en historique) */}
                  <td onClick={e => e.stopPropagation()}>
                    {isHistorique ? (
                      <span className="text-muted-sm">{cap(a.technicien_nom) || '—'}</span>
                    ) : (
                      <select
                        className="inline-select tech-select"
                        value={a.technicien_id || ''}
                        disabled={isSaving}
                        onChange={e => handleAssign(e, a.id, e.target.value)}
                      >
                        <option value="">— Aucun —</option>
                        {technicians.map(t => (
                          <option key={t.id} value={t.id}>{cap(t.nom)}</option>
                        ))}
                      </select>
                    )}
                  </td>

                  {/* Statut — select (admin only, badge statique en historique) */}
                  <td onClick={e => e.stopPropagation()}>
                    {isHistorique ? (
                      <span className={`badge statut-${a.statut || ''}`}>
                        {cap(getStatutLabel(a.statut))}
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

                  {/* Date */}
                  <td className="date-cell">
                    {dateVal
                      ? new Date(dateVal).toLocaleString('fr-FR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : '-'}
                  </td>

                  {/* Actions (admin only, masquées en historique) */}
                  {!isHistorique && (
                    <td onClick={e => e.stopPropagation()}>
                      <div className="action-btns">
                        <button
                          className="btn-action-sm delete"
                          onClick={() => setDeleteTarget(a.id)}
                          title="Supprimer"
                          disabled={isSaving}
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Modal confirmation suppression ────────────────────────── */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer cette alerte ?"
        message="Cette alerte sera définitivement supprimée."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ── Modal détail alerte ──────────────────────────────────── */}
      {viewAlert && (() => {
        const parsed    = parseAlerte(viewAlert);
        const dateResol = viewAlert.date_mise_a_jour || viewAlert.date_creation;
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
                    <span>{cap(viewAlert.nom_demandeur) || '-'}</span>
                  </div>
                  {viewAlert.source_type === 'entreprise' && viewAlert.nom_entreprise && (
                    <div className="detail-row">
                      <span className="detail-label">Entreprise</span>
                      <span>{viewAlert.nom_entreprise}</span>
                    </div>
                  )}
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
                      {cap(getStatutLabel(viewAlert.statut))}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Technicien</span>
                    <span>{cap(viewAlert.technicien_nom) || '—'}</span>
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
                      <span className="detail-label">Traitée le</span>
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
