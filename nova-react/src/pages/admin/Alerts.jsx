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

function getPrioEffective(a) {
  if (a.priorite === 'haute' || a.priorite === 'moyenne' || a.priorite === 'basse') return a.priorite;
  const c = a.categorie || '';
  if (c === 'Panne ou dysfonctionnement') return 'haute';
  if (c === "Proposition d'amélioration") return 'moyenne';
  return 'basse';
}

function getCategorieClass(categorie) {
  const c = categorie || '';
  if (c === 'Panne ou dysfonctionnement') return 'type-panne';
  if (c === "Proposition d'amélioration") return 'type-proposition';
  return 'type-autre';
}

function getCategorieLabel(categorie) {
  return categorie || 'Autre';
}

function cap(str) {
  if (!str) return '-';
  const s = String(str);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getRoleClass(role) {
  if (role === 'admin')                         return 'role-admin';
  if (role === 'tech' || role === 'technicien') return 'role-tech';
  if (role === 'data')                          return 'role-data';
  return 'role-autre';
}

function getRoleLabel(role) {
  if (role === 'admin')                         return 'Admin';
  if (role === 'tech' || role === 'technicien') return 'Technicien';
  if (role === 'data')                          return 'Data';
  return cap(role);
}

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

  // Switch source : 'externe' | 'interne'
  const [source, setSource] = useState('externe');

  // ── Données externes (table alertes) ──────────────────────────────
  const [extAlerts,   setExtAlerts]   = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [extLoading,  setExtLoading]  = useState(true);

  // ── Données internes (table alertes_internes) ──────────────────────
  const [intAlerts,  setIntAlerts]  = useState([]);
  const [intLoading, setIntLoading] = useState(true);

  // ── État commun ────────────────────────────────────────────────────
  const [mode,         setMode]         = useState('en_cours');
  const [search,       setSearch]       = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterTech,   setFilterTech]   = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSource, setDeleteSource] = useState(null); // 'ext' | 'int'
  const [savingId,     setSavingId]     = useState(null);
  const [viewAlert,    setViewAlert]    = useState(null);
  const [viewSource,   setViewSource]   = useState(null); // 'ext' | 'int'

  // ── Fetch externes ─────────────────────────────────────────────────
  const fetchExt = useCallback(() => {
    setExtLoading(true);
    fetch(`${API_BASE}/alertes`)
      .then(r => r.json())
      .then(d => setExtAlerts(Array.isArray(d) ? d : []))
      .catch(() => setExtAlerts([]))
      .finally(() => setExtLoading(false));
  }, [API_BASE]);

  // ── Fetch internes ─────────────────────────────────────────────────
  const fetchInt = useCallback(() => {
    setIntLoading(true);
    fetch(`${API_BASE}/alertes/interne`)
      .then(r => r.json())
      .then(d => setIntAlerts(Array.isArray(d) ? d : []))
      .catch(() => setIntAlerts([]))
      .finally(() => setIntLoading(false));
  }, [API_BASE]);

  useEffect(() => { fetchExt(); fetchInt(); }, [fetchExt, fetchInt]);

  // ── Techniciens ────────────────────────────────────────────────────
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
  const isHistorique    = mode === 'historique';
  const activeSearch    = search || globalSearch || '';

  // Filtrage externes
  const extFiltered = sortAlertsByPriority(
    extAlerts
      .filter(a => isHistorique
        ? STATUTS_ARCHIVES.includes(a.statut)
        : !STATUTS_ARCHIVES.includes(a.statut)
      )
      .filter(a => {
        if (filterType && getCategorieClass(a.categorie) !== filterType) return false;
        if (filterTech && String(a.technicien_id) !== filterTech)        return false;
        if (activeSearch) {
          const s = activeSearch.toLowerCase();
          return (
            (a.nom_demandeur || '').toLowerCase().includes(s) ||
            (a.email         || '').toLowerCase().includes(s) ||
            (a.description   || '').toLowerCase().includes(s)
          );
        }
        return true;
      })
  );

  // Filtrage internes
  const intFiltered = sortAlertsByPriority(
    intAlerts
      .filter(a => isHistorique
        ? STATUTS_ARCHIVES.includes(a.statut)
        : !STATUTS_ARCHIVES.includes(a.statut)
      )
      .filter(a => {
        if (!activeSearch) return true;
        const s = activeSearch.toLowerCase();
        return (
          (a.createur_nom || '').toLowerCase().includes(s) ||
          (a.categorie    || '').toLowerCase().includes(s) ||
          (a.description  || '').toLowerCase().includes(s)
        );
      })
  );

  // Compteurs pour les onglets
  const extEnCours    = extAlerts.filter(a => !STATUTS_ARCHIVES.includes(a.statut));
  const extHistorique = extAlerts.filter(a =>  STATUTS_ARCHIVES.includes(a.statut));
  const intEnCours    = intAlerts.filter(a => !STATUTS_ARCHIVES.includes(a.statut));
  const intHistorique = intAlerts.filter(a =>  STATUTS_ARCHIVES.includes(a.statut));

  const tabEnCours    = source === 'interne' ? intEnCours.length    : extEnCours.length;
  const tabHistorique = source === 'interne' ? intHistorique.length : extHistorique.length;

  // ── Actions externes ───────────────────────────────────────────────
  const handleAssign = async (e, id, technicien_id) => {
    e.stopPropagation();
    setSavingId(`ext-${id}`);
    try {
      const res = await fetch(`${API_BASE}/alertes/${id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicien_id: technicien_id || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `Erreur HTTP ${res.status}`);
      }
      const { alerte } = await res.json();
      // Synchronise tous les champs (technicien_id, technicien_nom, statut, assigned_at…)
      setExtAlerts(prev =>
        prev.map(a => a.id === id ? { ...a, ...(alerte || {}) } : a)
      );
      showToast(technicien_id ? 'Technicien assigné — intervention créée' : 'Assignation retirée');
    } catch (err) {
      showToast(err.message || 'Erreur lors de la mise à jour', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleStatusExt = async (e, id, statut) => {
    e.stopPropagation();
    setSavingId(`ext-${id}`);
    try {
      const res = await fetch(`${API_BASE}/alertes/${id}/statut`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      });
      if (!res.ok) throw new Error();
      setExtAlerts(prev => prev.map(a => a.id === id ? { ...a, statut } : a));
      if (STATUTS_ARCHIVES.includes(statut)) showToast("Alerte déplacée vers l'Historique");
      else showToast('Statut mis à jour');
    } catch {
      showToast('Erreur lors de la mise à jour', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleStatusInt = async (e, id, statut) => {
    e.stopPropagation();
    setSavingId(`int-${id}`);
    try {
      const res = await fetch(`${API_BASE}/alertes/interne/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      });
      if (!res.ok) throw new Error();
      setIntAlerts(prev => prev.map(a => a.id === id ? { ...a, statut } : a));
      if (STATUTS_ARCHIVES.includes(statut)) showToast("Alerte déplacée vers l'Historique");
      else showToast('Statut mis à jour');
    } catch {
      showToast('Erreur lors de la mise à jour', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const url = deleteSource === 'int'
        ? `${API_BASE}/alertes/interne/${deleteTarget}`
        : `${API_BASE}/alertes/${deleteTarget}`;
      await fetch(url, { method: 'DELETE' });
      if (deleteSource === 'int') setIntAlerts(prev => prev.filter(x => x.id !== deleteTarget));
      else                        setExtAlerts(prev => prev.filter(x => x.id !== deleteTarget));
      showToast('Alerte supprimée');
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    } finally {
      setDeleteTarget(null);
      setDeleteSource(null);
    }
  };

  const resetFilters = () => {
    setFilterType('');
    setFilterTech('');
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

  // ── Rendu ──────────────────────────────────────────────────────────
  return (
    <div className="alert-container">

      {/* ── En-tête + switch 3 sources ─────────────────────────────── */}
      <div className="alert-header">
        <h1 className="alert-title">Alertes</h1>
        <div className="alertes-switch" style={{ margin: 0 }}>
          <button
            className={`switch-btn${source === 'externe' ? ' active' : ''}`}
            onClick={() => setSource('externe')}
          >
            <i className="fa-solid fa-triangle-exclamation"></i> Externes
          </button>
          <button
            className={`switch-btn${source === 'interne' ? ' active' : ''}`}
            onClick={() => setSource('interne')}
          >
            <i className="fa-solid fa-user-shield"></i> Internes
          </button>
        </div>
      </div>

      {/* ── Onglets En cours / Historique ──────────────────────────── */}
      <div className="mode-tabs">
        <button
          className={`mode-tab${mode === 'en_cours' ? ' active' : ''}`}
          onClick={() => setMode('en_cours')}
        >
          <i className="fa-solid fa-clock-rotate-left"></i>
          En cours
          {tabEnCours > 0 && <span className="mode-tab-count">{tabEnCours}</span>}
        </button>
        <button
          className={`mode-tab${mode === 'historique' ? ' active' : ''}`}
          onClick={() => setMode('historique')}
        >
          <i className="fa-solid fa-check-circle"></i>
          Historique
          {tabHistorique > 0 && <span className="mode-tab-count resolved">{tabHistorique}</span>}
        </button>
      </div>

      {/* ── Filtres ────────────────────────────────────────────────── */}
      <div className="alert-filters">
        <div className="filter-group">
          <label>Recherche</label>
          <input
            type="text"
            className="alert-search"
            placeholder="Nom, catégorie, description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filtre type — visible seulement pour externes/toutes */}
        {source !== 'interne' && (
          <div className="filter-group">
            <label>Type</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">Tous</option>
              <option value="type-panne">Panne ou dysfonctionnement</option>
              <option value="type-proposition">Proposition d'amélioration</option>
              <option value="type-autre">Autre</option>
            </select>
          </div>
        )}

        {/* Filtre technicien — visible seulement pour externes/toutes, hors historique */}
        {source !== 'interne' && !isHistorique && (
          <div className="filter-group">
            <label>Technicien</label>
            <select value={filterTech} onChange={e => setFilterTech(e.target.value)}>
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

      {/* ══════════════════════════════════════════════════════════════
          TABLEAU EXTERNES
      ══════════════════════════════════════════════════════════════ */}
      {source === 'externe' && (
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
              {extLoading ? (
                <tr><td colSpan={isHistorique ? 7 : 8}>
                  <div className="loading-container">
                    <div className="spinner" /><span className="loading-text">Chargement…</span>
                  </div>
                </td></tr>
              ) : extFiltered.length === 0 ? (
                <tr><td colSpan={isHistorique ? 7 : 8}
                      style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
                  {isHistorique ? "Aucune alerte dans l'historique" : 'Aucune alerte externe en cours'}
                </td></tr>
              ) : extFiltered.map(a => {
                const parsed   = parseAlerte(a);
                const uid      = `ext-${a.id}`;
                const isSaving = savingId === uid;
                const dateVal  = isHistorique
                  ? (a.date_mise_a_jour || a.date_creation)
                  : a.date_creation;

                return (
                  <tr key={uid}
                      className={`row-clickable${isSaving ? ' row-saving' : ''}`}
                      onClick={() => { setViewAlert(a); setViewSource('ext'); }}>
                    <td>{cap(a.nom_demandeur)}</td>
                    <td>{parsed.email || '-'}</td>
                    <td className="message-cell" title={parsed.message}>{parsed.message || '-'}</td>
                    <td>
                      <span className={`badge prio-${getPrioEffective(a)}`}>
                        {getPrioLabel(getPrioEffective(a))}
                      </span>
                    </td>
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
                          onChange={e => handleStatusExt(e, a.id, e.target.value)}
                        >
                          {STATUT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="date-cell">
                      {dateVal ? new Date(dateVal).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      }) : '-'}
                    </td>
                    {!isHistorique && (
                      <td onClick={e => e.stopPropagation()}>
                        <div className="action-btns">
                          <button
                            className="btn-action-sm delete"
                            title="Supprimer"
                            disabled={isSaving}
                            onClick={() => { setDeleteTarget(a.id); setDeleteSource('ext'); }}
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
      )}

      {/* ══════════════════════════════════════════════════════════════
          TABLEAU INTERNES
      ══════════════════════════════════════════════════════════════ */}
      {source === 'interne' && (
        <div className="table-wrapper">
          <table className="alert-table">
            <thead>
              <tr>
                <th>Créé par</th>
                <th>Catégorie</th>
                <th>Priorité</th>
                <th>Description</th>
                <th>Statut</th>
                <th>{isHistorique ? 'Date clôture' : 'Date'}</th>
                {!isHistorique && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {intLoading ? (
                <tr><td colSpan={isHistorique ? 6 : 7}>
                  <div className="loading-container">
                    <div className="spinner" /><span className="loading-text">Chargement…</span>
                  </div>
                </td></tr>
              ) : intFiltered.length === 0 ? (
                <tr><td colSpan={isHistorique ? 6 : 7}
                      style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
                  {isHistorique ? "Aucune alerte dans l'historique" : 'Aucune alerte interne en cours'}
                </td></tr>
              ) : intFiltered.map(a => {
                const uid      = `int-${a.id}`;
                const isSaving = savingId === uid;
                const dateVal  = isHistorique
                  ? (a.date_mise_a_jour || a.date_creation)
                  : a.date_creation;

                return (
                  <tr key={uid}
                      className={`row-clickable${isSaving ? ' row-saving' : ''}`}
                      onClick={() => { setViewAlert(a); setViewSource('int'); }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{cap(a.createur_nom)}</span>
                        {a.createur_role && (
                          <span className={`badge ${getRoleClass(a.createur_role)}`}>
                            {getRoleLabel(a.createur_role)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="message-cell" title={a.categorie}>{a.categorie || '-'}</td>
                    <td>
                      <span className={`badge prio-${a.priorite || 'basse'}`}>
                        {getPrioLabel(a.priorite)}
                      </span>
                    </td>
                    <td className="message-cell" title={a.description}>{a.description || '-'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      {isHistorique ? (
                        <span className={`badge statut-${a.statut || ''}`}>
                          {getStatutLabel(a.statut)}
                        </span>
                      ) : (
                        <select
                          className="inline-select status-select"
                          value={currentStatut(a)}
                          disabled={isSaving}
                          onChange={e => handleStatusInt(e, a.id, e.target.value)}
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
                    {!isHistorique && (
                      <td onClick={e => e.stopPropagation()}>
                        <div className="action-btns">
                          <button
                            className="btn-action-sm delete"
                            title="Supprimer"
                            disabled={isSaving}
                            onClick={() => { setDeleteTarget(a.id); setDeleteSource('int'); }}
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
      )}

      {/* ── Confirm suppression ───────────────────────────────────── */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer cette alerte ?"
        message="Cette alerte sera définitivement supprimée."
        onConfirm={handleDeleteConfirm}
        onCancel={() => { setDeleteTarget(null); setDeleteSource(null); }}
      />

      {/* ── Modal détail alerte externe ───────────────────────────── */}
      {viewAlert && viewSource === 'ext' && (() => {
        const parsed    = parseAlerte(viewAlert);
        const dateResol = viewAlert.date_mise_a_jour || viewAlert.date_creation;
        return (
          <>
            <div className="modal-overlay active" onClick={() => setViewAlert(null)} />
            <div className="alert-detail-modal active">
              <div className="modal-header">
                <h3><i className="fa-solid fa-circle-info"></i> Détail — alerte externe</h3>
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

      {/* ── Modal détail alerte interne ───────────────────────────── */}
      {viewAlert && viewSource === 'int' && (() => {
        const dateResol = viewAlert.date_mise_a_jour || viewAlert.date_creation;
        return (
          <>
            <div className="modal-overlay active" onClick={() => setViewAlert(null)} />
            <div className="alert-detail-modal active">
              <div className="modal-header">
                <h3><i className="fa-solid fa-circle-info"></i> Détail — alerte interne</h3>
                <button className="close-modal" onClick={() => setViewAlert(null)}>&times;</button>
              </div>
              <div className="modal-content">
                <div className="detail-grid">
                  <div className="detail-row">
                    <span className="detail-label">Créé par</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {cap(viewAlert.createur_nom)}
                      {viewAlert.createur_role && (
                        <span className={`badge ${getRoleClass(viewAlert.createur_role)}`}>
                          {getRoleLabel(viewAlert.createur_role)}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Catégorie</span>
                    <span>{viewAlert.categorie || '-'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Priorité</span>
                    <span className={`badge prio-${viewAlert.priorite || 'basse'}`}>
                      {getPrioLabel(viewAlert.priorite)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Statut</span>
                    <span className={`badge statut-${viewAlert.statut || ''}`}>
                      {getStatutLabel(viewAlert.statut)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Créée le</span>
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
                  <span className="detail-label">Description</span>
                  <p>{viewAlert.description || '-'}</p>
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
