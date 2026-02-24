import { useState, useEffect, useCallback } from 'react';
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

function cap(str) {
  if (!str) return '-';
  const s = String(str);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getRoleLabel(role) {
  if (role === 'admin')                         return 'Admin';
  if (role === 'tech' || role === 'technicien') return 'Technicien';
  if (role === 'data')                          return 'Data';
  if (role === 'entreprise')                    return 'Entreprise';
  return cap(role);
}

function getRoleClass(role) {
  if (role === 'admin')                         return 'role-admin';
  if (role === 'tech' || role === 'technicien') return 'role-tech';
  if (role === 'data')                          return 'role-data';
  return 'role-autre';
}

const STATUTS_ARCHIVES = ['traitee', 'annulee', 'resolue'];

const STATUT_OPTIONS = [
  { value: 'en_cours', label: 'En cours' },
  { value: 'traitee',  label: 'Traitée'  },
  { value: 'annulee',  label: 'Annulée'  },
];

const PRIO_OPTIONS = [
  { value: 'haute',   label: 'Haute'   },
  { value: 'moyenne', label: 'Moyenne' },
  { value: 'basse',   label: 'Basse'   },
];

const EMPTY_FORM = { categorie: '', priorite: 'basse', description: '' };

// ── Composant ──────────────────────────────────────────────────────────
export default function TechAlertesInternes() {
  const { user, API_BASE } = useAuth();

  const [allAlerts,    setAllAlerts]    = useState([]);
  const [mode,         setMode]         = useState('en_cours');
  const [search,       setSearch]       = useState('');
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [submitting,   setSubmitting]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [savingId,     setSavingId]     = useState(null);
  const [viewAlert,    setViewAlert]    = useState(null);

  const fetchAlerts = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/alertes/interne`)
      .then(r => r.json())
      .then(d => setAllAlerts(Array.isArray(d) ? d : []))
      .catch(() => setAllAlerts([]))
      .finally(() => setLoading(false));
  }, [API_BASE]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // ── Partition ────────────────────────────────────────────────────────
  const enCoursAlerts    = allAlerts.filter(a => !STATUTS_ARCHIVES.includes(a.statut));
  const historiqueAlerts = allAlerts.filter(a =>  STATUTS_ARCHIVES.includes(a.statut));
  const modeAlerts       = mode === 'historique' ? historiqueAlerts : enCoursAlerts;
  const isHistorique     = mode === 'historique';

  const filtered = sortAlertsByPriority(
    modeAlerts.filter(a => {
      if (search) {
        const s = search.toLowerCase();
        if (
          !(a.createur_nom  || a.nom_demandeur || '').toLowerCase().includes(s) &&
          !(a.categorie     || '').toLowerCase().includes(s) &&
          !(a.description   || '').toLowerCase().includes(s)
        ) return false;
      }
      return true;
    })
  );

  // ── Créer ────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.categorie.trim() || !form.description.trim()) {
      showToast('Veuillez remplir tous les champs obligatoires.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/alertes/interne`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categorie:   form.categorie,
          priorite:    form.priorite,
          description: form.description,
          cree_par:    user.id,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const created = await res.json();
      setAllAlerts(prev => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      showToast('Alerte interne créée');
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Statut (uniquement ses propres alertes) ──────────────────────────
  const handleStatus = async (e, id, statut) => {
    e.stopPropagation();
    setSavingId(id);
    try {
      const res = await fetch(`${API_BASE}/alertes/interne/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      });
      if (!res.ok) throw new Error();
      setAllAlerts(prev => prev.map(a => a.id === id ? { ...a, statut } : a));
      if (STATUTS_ARCHIVES.includes(statut)) showToast("Alerte déplacée vers l'Historique");
      else showToast('Statut mis à jour');
    } catch {
      showToast('Erreur lors de la mise à jour', 'error');
    } finally {
      setSavingId(null);
    }
  };

  // ── Supprimer (uniquement ses propres alertes) ───────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`${API_BASE}/alertes/interne/${deleteTarget}`, { method: 'DELETE' });
      setAllAlerts(prev => prev.filter(x => x.id !== deleteTarget));
      showToast('Alerte supprimée');
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const currentStatut = (a) =>
    STATUT_OPTIONS.some(o => o.value === a.statut) ? a.statut : 'en_cours';

  // ── Rendu ──────────────────────────────────────────────────────────
  return (
    <div className="alert-container">

      {/* En-tête */}
      <div className="alert-header">
        <div className="alert-title-wrap">
          <h1 className="alert-title">Alertes internes</h1>
          <span className="mode-badge interne">Interne</span>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowForm(v => !v)}
          style={{ marginLeft: 'auto' }}
        >
          <i className={`fa-solid ${showForm ? 'fa-xmark' : 'fa-plus'}`}></i>
          {showForm ? ' Annuler' : ' Nouvelle alerte'}
        </button>
      </div>

      {/* ── Formulaire de création ─────────────────────────────────── */}
      {showForm && (
        <div className="alert-form-panel">
          <h3><i className="fa-solid fa-triangle-exclamation"></i> Créer une alerte interne</h3>
          <form onSubmit={handleSubmit} className="alert-form">
            <div className="form-row">
              <div className="form-group">
                <label>Catégorie <span className="required">*</span></label>
                <input
                  type="text"
                  placeholder="Ex : Problème réseau, Matériel manquant..."
                  value={form.categorie}
                  onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Priorité</label>
                <select
                  value={form.priorite}
                  onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))}
                >
                  {PRIO_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Description <span className="required">*</span></label>
              <textarea
                rows={4}
                placeholder="Décrivez le problème ou la demande interne..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Création...' : 'Créer'}
              </button>
              <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Onglets ────────────────────────────────────────────────── */}
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

      {/* ── Filtres ────────────────────────────────────────────────── */}
      <div className="alert-filters">
        <div className="filter-group">
          <label>Recherche</label>
          <input
            type="text"
            className="alert-search"
            placeholder="Auteur, catégorie, description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>&nbsp;</label>
          <button className="btn-reset-filter" onClick={() => setSearch('')}>Réinitialiser</button>
        </div>
      </div>

      {/* ── Tableau ────────────────────────────────────────────────── */}
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
            {loading ? (
              <tr>
                <td colSpan={isHistorique ? 6 : 7}>
                  <div className="loading-container">
                    <div className="spinner" />
                    <span className="loading-text">Chargement…</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={isHistorique ? 6 : 7}
                  style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}
                >
                  {isHistorique ? "Aucune alerte dans l'historique" : 'Aucune alerte interne en cours'}
                </td>
              </tr>
            ) : filtered.map(a => {
              const isSaving   = savingId === a.id;
              const isOwn      = Number(a.cree_par) === Number(user?.id);
              const isArchived = STATUTS_ARCHIVES.includes(a.statut);
              const dateVal    = isHistorique
                ? (a.date_mise_a_jour || a.date_creation)
                : a.date_creation;

              return (
                <tr
                  key={a.id}
                  className={`row-clickable${isSaving ? ' row-saving' : ''}`}
                  onClick={() => setViewAlert(a)}
                >
                  {/* Créé par : nom + badge rôle */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span>{cap(a.createur_nom || a.nom_demandeur)}</span>
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

                  {/* Statut — select uniquement pour ses propres alertes */}
                  <td onClick={e => e.stopPropagation()}>
                    {isHistorique || !isOwn ? (
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

                  {!isHistorique && (
                    <td onClick={e => e.stopPropagation()}>
                      <div className="action-btns">
                        {isOwn && !isArchived && (
                          <button
                            className="btn-action-sm delete"
                            title="Supprimer"
                            disabled={isSaving}
                            onClick={() => setDeleteTarget(a.id)}
                          >
                            <i className="fa-solid fa-trash" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Confirm suppression ──────────────────────────────────── */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer cette alerte interne ?"
        message="Cette alerte sera définitivement supprimée."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ── Modal détail ─────────────────────────────────────────── */}
      {viewAlert && (() => {
        const dateResol = viewAlert.date_mise_a_jour || viewAlert.date_creation;
        return (
          <>
            <div className="modal-overlay active" onClick={() => setViewAlert(null)} />
            <div className="alert-detail-modal active">
              <div className="modal-header">
                <h3><i className="fa-solid fa-circle-info"></i> Détail de l'alerte interne</h3>
                <button className="close-modal" onClick={() => setViewAlert(null)}>&times;</button>
              </div>
              <div className="modal-content">
                <div className="detail-grid">
                  <div className="detail-row">
                    <span className="detail-label">Créé par</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {cap(viewAlert.createur_nom || viewAlert.nom_demandeur)}
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
