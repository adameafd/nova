import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal, { showToast } from '../../components/ConfirmModal';
import { getPriorityLabel, getStatutLabel, sortAlertsByPriority } from '../../utils/helpers';
import '../../css/alerts.css';

export default function AdminAlerts() {
  const { API_BASE } = useAuth();
  const { globalSearch } = useOutletContext() || {};
  const [alerts, setAlerts] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [activeTab, setActiveTab] = useState('citoyen');
  const [filters, setFilters] = useState({ priority: '', status: '', technician: '' });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewAlert, setViewAlert] = useState(null);
  const [editAlert, setEditAlert] = useState(null);

  const fetchAlerts = useCallback(() => {
    setLoading(true);
    const url = activeTab === 'historique'
      ? `${API_BASE}/alertes/historique`
      : `${API_BASE}/alertes?source_type=${activeTab}`;
    fetch(url)
      .then(r => r.json())
      .then(data => setAlerts(Array.isArray(data) ? data : []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [API_BASE, activeTab]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    fetch(`${API_BASE}/utilisateurs`)
      .then(r => r.json())
      .then(data => {
        const techs = (Array.isArray(data) ? data : []).filter(u =>
          u.role === 'technicien' || u.role === 'tech' || u.role_id === 2
        );
        setTechnicians(techs);
      })
      .catch(() => setTechnicians([]));
  }, [API_BASE]);

  const activeSearch = search || globalSearch || '';

  const filtered = sortAlertsByPriority(alerts.filter(a => {
    if (filters.priority && a.priorite !== filters.priority) return false;
    if (filters.status && a.statut !== filters.status) return false;
    if (filters.technician && String(a.technicien_id) !== filters.technician) return false;
    if (activeSearch) {
      const s = activeSearch.toLowerCase();
      const matchName = (a.nom_demandeur || '').toLowerCase().includes(s);
      const matchEmail = (a.email || '').toLowerCase().includes(s);
      const matchMsg = (a.description || '').toLowerCase().includes(s);
      if (!matchName && !matchEmail && !matchMsg) return false;
    }
    return true;
  }));

  const handleAssign = async (id, technicien_id) => {
    try {
      await fetch(`${API_BASE}/alertes/${id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicien_id: technicien_id || null }),
      });
      setAlerts(prev => prev.map(a =>
        a.id === id ? { ...a, technicien_id: technicien_id ? Number(technicien_id) : null, technicien_nom: technicians.find(t => t.id === Number(technicien_id))?.nom || null } : a
      ));
    } catch { /* ignore */ }
  };

  const handleStatus = async (id, statut) => {
    try {
      await fetch(`${API_BASE}/alertes/${id}/statut`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      });
      if (statut === 'resolue') {
        setAlerts(prev => prev.filter(a => a.id !== id));
      } else {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, statut } : a));
      }
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`${API_BASE}/alertes/${deleteTarget}`, { method: 'DELETE' });
      setAlerts(prev => prev.filter(x => x.id !== deleteTarget));
      showToast('Supprimé');
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const openEditModal = (a) => {
    setEditAlert({ ...a, technicien_id: a.technicien_id || '', statut: a.statut || 'nouveau' });
  };

  const handleEditSave = async () => {
    if (!editAlert) return;
    try {
      await fetch(`${API_BASE}/alertes/${editAlert.id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicien_id: editAlert.technicien_id || null }),
      });
      const newStatut = editAlert.statut;
      await fetch(`${API_BASE}/alertes/${editAlert.id}/statut`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: newStatut }),
      });
      if (newStatut === 'resolue') {
        setAlerts(prev => prev.filter(a => a.id !== editAlert.id));
      } else {
        setAlerts(prev => prev.map(a =>
          a.id === editAlert.id
            ? { ...a, technicien_id: editAlert.technicien_id ? Number(editAlert.technicien_id) : null, technicien_nom: technicians.find(t => t.id === Number(editAlert.technicien_id))?.nom || null, statut: newStatut }
            : a
        ));
      }
      showToast('Alerte modifiée');
      setEditAlert(null);
    } catch {
      showToast('Erreur lors de la modification', 'error');
    }
  };

  const resetFilters = () => {
    setFilters({ priority: '', status: '', technician: '' });
    setSearch('');
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

  const isHistorique = activeTab === 'historique';

  return (
    <div className="alert-container">
      <div className="alert-header">
        <div className="alert-title-wrap">
          <h1 className="alert-title">Alertes</h1>
          <span className="mode-badge">{isHistorique ? 'Historique' : 'En direct'}</span>
        </div>
      </div>

      <div className="alertes-switch">
        <button className={`switch-btn${activeTab === 'citoyen' ? ' active' : ''}`} onClick={() => setActiveTab('citoyen')}>
          Citoyen
        </button>
        <button className={`switch-btn${activeTab === 'entreprise' ? ' active' : ''}`} onClick={() => setActiveTab('entreprise')}>
          Entreprise
        </button>
        <button className={`switch-btn${activeTab === 'historique' ? ' active' : ''}`} onClick={() => setActiveTab('historique')}>
          Historique
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
            {isHistorique && <option value="resolue">Résolue</option>}
          </select>
        </div>
        {!isHistorique && (
          <div className="filter-group">
            <label>Technicien</label>
            <select value={filters.technician} onChange={e => setFilters({ ...filters, technician: e.target.value })}>
              <option value="">Tous</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>{t.nom}</option>
              ))}
            </select>
          </div>
        )}
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
              <th>Technicien</th>
              <th>Statut</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8"><div className="loading-container"><div className="spinner"></div><span className="loading-text">Chargement...</span></div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Aucune alerte trouvée</td></tr>
            ) : filtered.map(a => {
              const parsed = parseAlerte(a);
              return (
              <tr key={a.id}>
                <td>{a.nom_demandeur || '-'}</td>
                <td>{parsed.email || '-'}</td>
                <td className="message-cell" title={parsed.message}>{parsed.message || '-'}</td>
                <td><span className={`badge ${a.priorite || ''}`}>{getPriorityLabel(a.priorite)}</span></td>
                <td>{a.technicien_nom || <span className="text-muted">Non assigné</span>}</td>
                <td><span className={`badge statut-${a.statut || ''}`}>{getStatutLabel(a.statut)}</span></td>
                <td>{a.date_creation ? new Date(a.date_creation).toLocaleString('fr-FR') : '-'}</td>
                <td>
                  <div className="action-btns">
                    <button className="btn-action-sm view" onClick={() => setViewAlert(a)} title="Voir">
                      <i className="fa-solid fa-eye"></i>
                    </button>
                    {!isHistorique && (
                      <button className="btn-action-sm edit" onClick={() => openEditModal(a)} title="Modifier">
                        <i className="fa-solid fa-pen"></i>
                      </button>
                    )}
                    <button className="btn-action-sm delete" onClick={() => setDeleteTarget(a.id)} title="Supprimer">
                      <i className="fa-solid fa-trash"></i>
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
                  <div className="detail-row"><span className="detail-label">Technicien</span><span>{viewAlert.technicien_nom || 'Non assigné'}</span></div>
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

      {/* Modal Modifier */}
      {editAlert && (
        <>
          <div className="modal-overlay active" onClick={() => setEditAlert(null)}></div>
          <div className="alert-edit-modal active">
            <div className="modal-header">
              <h3><i className="fa-solid fa-pen"></i> Modifier l'alerte</h3>
              <button className="close-modal" onClick={() => setEditAlert(null)}>&times;</button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>Technicien</label>
                <select value={editAlert.technicien_id || ''} onChange={e => setEditAlert({ ...editAlert, technicien_id: e.target.value })}>
                  <option value="">-- Aucun --</option>
                  {technicians.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Statut</label>
                <select value={editAlert.statut || ''} onChange={e => setEditAlert({ ...editAlert, statut: e.target.value })}>
                  <option value="nouveau">Nouveau</option>
                  <option value="en_cours">En cours</option>
                  <option value="resolue">Résolue</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setEditAlert(null)}>Annuler</button>
              <button className="btn-save" onClick={handleEditSave}>Enregistrer</button>
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer cette alerte ?"
        message="L'alerte sera définitivement supprimée."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
