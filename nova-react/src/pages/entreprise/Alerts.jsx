import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getStatutLabel } from '../../utils/helpers';
import { showToast } from '../../components/ConfirmModal';
import '../../css/alerts.css';

// Mêmes valeurs que le formulaire de contact public
const TYPE_OPTIONS = [
  { value: 'panne',       label: 'Panne ou dysfonctionnement' },
  { value: 'proposition', label: "Proposition d'amélioration" },
  { value: 'autre',       label: 'Autre'                      },
];

const EMPTY_FORM = { type_alerte: '', description: '', contact: '' };

// ── Helpers locaux ──────────────────────────────────────────────────────
function getCategorieClass(categorie) {
  const c = categorie || '';
  if (c === 'Panne ou dysfonctionnement') return 'type-panne';
  if (c === "Proposition d'amélioration") return 'type-proposition';
  return 'type-autre';
}

function getCategorieLabel(categorie) {
  return categorie || 'Autre';
}

// Dérive la priorité depuis categorie si priorite absent en DB
function getPrioEffective(a) {
  if (a.priorite === 'haute' || a.priorite === 'moyenne' || a.priorite === 'basse') return a.priorite;
  const c = a.categorie || '';
  if (c === 'Panne ou dysfonctionnement') return 'haute';
  if (c === "Proposition d'amélioration") return 'moyenne';
  return 'basse';
}

function getPrioLabel(p) {
  if (p === 'haute')   return 'Haute';
  if (p === 'moyenne') return 'Moyenne';
  return 'Basse';
}

export default function EntrepriseAlerts() {
  const { user, API_BASE } = useAuth();
  const [alerts,      setAlerts]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [submitting,  setSubmitting]  = useState(false);
  const [showForm,    setShowForm]    = useState(false);
  const [viewAlert,   setViewAlert]   = useState(null);

  const fetchAlerts = useCallback(() => {
    if (!user?.id) return;
    setLoading(true);
    fetch(`${API_BASE}/alertes/by-creator/${user.id}`)
      .then(r => r.json())
      .then(d => setAlerts(Array.isArray(d) ? d : []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [API_BASE, user?.id]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.type_alerte || !form.description.trim()) {
      showToast('Veuillez remplir tous les champs obligatoires.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/alertes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type:    'entreprise',
          nom_demandeur:  user.nom,
          nom_entreprise: user.nom,
          email:          user.email || form.contact,
          contact:        form.contact || user.email || '',
          type_alerte:    form.type_alerte,
          description:    form.description,
          cree_par:       user.id,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const created = await res.json();
      setAlerts(prev => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      showToast('Alerte soumise avec succès');
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="alert-container">
      <div className="alert-header">
        <div className="alert-title-wrap">
          <h1 className="alert-title">Mes alertes</h1>
          <span className="mode-badge">{alerts.length} soumise{alerts.length !== 1 ? 's' : ''}</span>
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

      {/* ── Formulaire de soumission ──────────────────────────────── */}
      {showForm && (
        <div className="alert-form-panel">
          <h3><i className="fa-solid fa-triangle-exclamation"></i> Soumettre une alerte</h3>
          <form onSubmit={handleSubmit} className="alert-form">
            <div className="form-row">
              <div className="form-group">
                <label>Type d'alerte <span className="required">*</span></label>
                <select
                  value={form.type_alerte}
                  onChange={e => setForm(f => ({ ...f, type_alerte: e.target.value }))}
                  required
                >
                  <option value="">-- Choisir --</option>
                  {TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Contact (email/téléphone)</label>
                <input
                  type="text"
                  placeholder={user?.email || 'votre@email.com'}
                  value={form.contact}
                  onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Description <span className="required">*</span></label>
              <textarea
                rows={4}
                placeholder="Décrivez le problème ou la suggestion..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Envoi...' : 'Soumettre'}
              </button>
              <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Liste des alertes ─────────────────────────────────────── */}
      <div className="table-wrapper">
        <table className="alert-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Priorité</th>
              <th>Statut</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4">
                  <div className="loading-container">
                    <div className="spinner"></div>
                    <span className="loading-text">Chargement...</span>
                  </div>
                </td>
              </tr>
            ) : alerts.length === 0 ? (
              <tr>
                <td colSpan="4" className="empty-row">
                  Aucune alerte soumise — cliquez sur "Nouvelle alerte" pour commencer.
                </td>
              </tr>
            ) : alerts.map(a => {
              const prio = getPrioEffective(a);
              return (
                <tr key={a.id} className="row-clickable" onClick={() => setViewAlert(a)}>
                  <td className="message-cell" title={a.description}>{a.description || '-'}</td>
                  <td>
                    <span className={`badge prio-${prio}`}>
                      {getPrioLabel(prio)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge statut-${a.statut || ''}`}>
                      {getStatutLabel(a.statut)}
                    </span>
                  </td>
                  <td className="date-cell">
                    {a.date_creation
                      ? new Date(a.date_creation).toLocaleDateString('fr-FR')
                      : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Modal détail ──────────────────────────────────────────── */}
      {viewAlert && (() => {
        const prio = getPrioEffective(viewAlert);
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
                    <span className="detail-label">Type</span>
                    <span className={`badge ${getTypeClass(viewAlert.type_alerte)}`}>
                      {getSujetLabel(viewAlert.type_alerte)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Priorité</span>
                    <span className={`badge prio-${prio}`}>
                      {getPrioLabel(prio)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Statut</span>
                    <span className={`badge statut-${viewAlert.statut || ''}`}>
                      {getStatutLabel(viewAlert.statut)}
                    </span>
                  </div>
                  {viewAlert.technicien_nom && (
                    <div className="detail-row">
                      <span className="detail-label">Technicien assigné</span>
                      <span>{viewAlert.technicien_nom}</span>
                    </div>
                  )}
                  <div className="detail-row">
                    <span className="detail-label">Soumise le</span>
                    <span className="date-cell">
                      {viewAlert.date_creation
                        ? new Date(viewAlert.date_creation).toLocaleString('fr-FR')
                        : '-'}
                    </span>
                  </div>
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
