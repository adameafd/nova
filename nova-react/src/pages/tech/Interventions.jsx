import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal, { showToast } from '../../components/ConfirmModal';
import { getStatutLabel, capitalize } from '../../utils/helpers';
import '../../css/interventions.css';

const EN_COURS_STATUTS = ['en_attente', 'en_cours'];
const HISTORIQUE_STATUTS = ['resolue', 'annulee'];
const STATUT_CHANGE_OPTIONS = [
  { value: 'en_attente', label: 'En attente' },
  { value: 'en_cours',   label: 'En cours'   },
  { value: 'resolue',    label: 'Résolue'    },
  { value: 'annulee',    label: 'Annulée'    },
];

export default function TechInterventions() {
  const { user, API_BASE } = useAuth();
  const [interventions, setInterventions] = useState([]);
  const [mode, setMode] = useState('en_cours');
  const [filters, setFilters] = useState({ priority: '', status: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ description: '', priority: 'basse', status: 'en_attente' });
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const currentUserId = user?.id;

  useEffect(() => {
    if (!currentUserId) return;
    fetch(`${API_BASE}/interventions?technicien_id=${currentUserId}`)
      .then(r => r.json()).then(d => setInterventions(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, [API_BASE, currentUserId]);

  // Partition en_cours / historique
  const enCoursInterventions    = interventions.filter(i => EN_COURS_STATUTS.includes(i.statut));
  const historiqueInterventions = interventions.filter(i => HISTORIQUE_STATUTS.includes(i.statut));
  const modeInterventions       = mode === 'historique' ? historiqueInterventions : enCoursInterventions;

  const filtered = modeInterventions.filter(i => {
    if (filters.priority && i.priorite !== filters.priority) return false;
    if (filters.status && i.statut !== filters.status) return false;
    return true;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`${API_BASE}/interventions/${deleteTarget}`, { method: 'DELETE' });
      setInterventions(prev => prev.filter(i => i.id !== deleteTarget));
      showToast('Supprimé');
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleSave = async () => {
    if (!form.description.trim()) { alert('Description requise'); return; }
    try {
      const res = await fetch(`${API_BASE}/interventions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre: form.description, description: form.description, priorite: form.priority, statut: form.status, technicien_id: currentUserId }),
      });
      if (res.ok) {
        const saved = await res.json();
        setInterventions(prev => [saved, ...prev]);
        setModalOpen(false);
        setForm({ description: '', priority: 'basse', status: 'en_attente' });
        showToast('Intervention ajoutée');
      }
    } catch { alert('Erreur réseau'); }
  };

  const handleStatusChange = async (id, statut) => {
    try {
      const res = await fetch(`${API_BASE}/interventions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setInterventions(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));
      showToast('Statut mis à jour');
    } catch {
      showToast('Erreur réseau', 'error');
    }
  };

  return (
    <div className="interventions-container">
      <div className="interventions-header">
        <h1 className="interventions-title">Mes Interventions</h1>
        <button className="btn-add" onClick={() => setModalOpen(true)}><i className="fa-solid fa-plus"></i> Ajouter</button>
      </div>

      {/* Onglets */}
      <div className="interventions-tabs">
        <button
          className={`interventions-tab${mode === 'en_cours' ? ' active' : ''}`}
          onClick={() => setMode('en_cours')}
        >
          <i className="fa-solid fa-clock-rotate-left"></i>
          En cours
          {enCoursInterventions.length > 0 && (
            <span className="interventions-tab-count">{enCoursInterventions.length}</span>
          )}
        </button>
        <button
          className={`interventions-tab${mode === 'historique' ? ' active' : ''}`}
          onClick={() => setMode('historique')}
        >
          <i className="fa-solid fa-check-circle"></i>
          Historique
          {historiqueInterventions.length > 0 && (
            <span className="interventions-tab-count">{historiqueInterventions.length}</span>
          )}
        </button>
      </div>

      <div className="interventions-filters">
        <div className="filter-group">
          <label>Priorité</label>
          <select value={filters.priority} onChange={e => setFilters({ ...filters, priority: e.target.value })}>
            <option value="">Toutes</option><option value="basse">Basse</option><option value="moyenne">Moyenne</option><option value="haute">Haute</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Statut</label>
          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Tous</option><option value="en_attente">En attente</option><option value="en_cours">En cours</option><option value="resolue">Résolue</option><option value="annulee">Annulée</option>
          </select>
        </div>
        <div className="filter-group"><label>&nbsp;</label><button className="btn-reset-filter" onClick={() => setFilters({ priority: '', status: '' })}>Réinitialiser</button></div>
      </div>

      <div className="table-wrapper">
        <table className="alert-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Description</th>
              <th>Date</th>
              <th>Statut</th>
              <th>Priorité</th>
              {mode === 'en_cours' && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6"><div className="loading-container"><div className="spinner"></div><span className="loading-text">Chargement...</span></div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
                {mode === 'historique' ? "Aucune intervention dans l'historique" : 'Aucune intervention en cours'}
              </td></tr>
            ) : filtered.map(item => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>
                  {item.source_type === 'alerte' && (
                    <span className="badge-alerte-src">ALERTE #{item.alerte_id}</span>
                  )}
                  {item.description}
                </td>
                <td>{item.date_creation ? new Date(item.date_creation).toLocaleString('fr-FR') : '-'}</td>
                <td>
                  {mode === 'en_cours' ? (
                    <select
                      className="inline-select status-select"
                      value={item.statut}
                      onChange={e => handleStatusChange(item.id, e.target.value)}
                    >
                      {STATUT_CHANGE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`status-badge ${item.statut}`}>{getStatutLabel(item.statut)}</span>
                  )}
                </td>
                <td><span className={`badge ${item.priorite}`}>{capitalize(item.priorite)}</span></td>
                {mode === 'en_cours' && (
                  <td><button className="btn-delete" onClick={() => setDeleteTarget(item.id)}><i className="fa-solid fa-trash"></i></button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <>
          <div className="modal-overlay active" onClick={() => setModalOpen(false)}></div>
          <div className="add-modal active">
            <div className="modal-header"><h3><i className="fa-solid fa-plus"></i> Nouvelle intervention</h3><button className="close-modal" onClick={() => setModalOpen(false)}>&times;</button></div>
            <div className="modal-content">
              <div className="form-group"><label>Description</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="form-group"><label>Priorité</label><select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option value="basse">Basse</option><option value="moyenne">Moyenne</option><option value="haute">Haute</option></select></div>
              <div className="form-group"><label>Statut</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="en_attente">En attente</option><option value="en_cours">En cours</option><option value="resolue">Résolue</option></select></div>
              <div className="modal-footer"><button className="btn-cancel" onClick={() => setModalOpen(false)}>Annuler</button><button className="btn-save" onClick={handleSave}>Enregistrer</button></div>
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer cette intervention ?"
        message="L'intervention sera définitivement supprimée."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
