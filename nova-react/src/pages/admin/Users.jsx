import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth, resolvePhotoUrl } from '../../context/AuthContext';
import ConfirmModal, { showToast } from '../../components/ConfirmModal';
import { tolerantSearch, getRoleLabel } from '../../utils/helpers';
import '../../css/users.css';

export default function AdminUsers() {
  const { API_BASE } = useAuth();
  const { globalSearch } = useOutletContext() || {};
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nom: '', email: '', mot_de_passe: '', role: 'technicien' });
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchUsers = useCallback(() => {
    fetch(`${API_BASE}/utilisateurs`).then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, [API_BASE]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Combine local search + global search
  const activeSearch = search || globalSearch || '';

  const filtered = users.filter(u => {
    if (roleFilter && u.role !== roleFilter) return false;
    return tolerantSearch(activeSearch, {
      nom: u.nom,
      email: u.email,
      role: u.role,
    });
  });

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    techs: users.filter(u => u.role === 'technicien' || u.role === 'tech').length,
    data: users.filter(u => u.role === 'data').length,
  };

  const getRoleBadge = (role) => {
    if (role === 'admin') return 'admin';
    if (role === 'technicien' || role === 'tech') return 'tech';
    return 'data';
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ nom: '', email: '', mot_de_passe: '', role: 'technicien' });
    setFormError('');
    setModalOpen(true);
  };

  const validateForm = () => {
    if (!form.nom.trim()) return 'Le nom est requis.';
    if (!form.email.trim()) return "L'email est requis.";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) return "Format d'email invalide.";
    if (!editId && !form.mot_de_passe.trim()) return 'Le mot de passe est requis.';
    if (!editId && form.mot_de_passe.trim().length < 4) return 'Le mot de passe doit contenir au moins 4 caractères.';
    return null;
  };

  const handleSave = async () => {
    const error = validateForm();
    if (error) { setFormError(error); return; }
    setFormError('');

    try {
      let res;
      if (editId) {
        res = await fetch(`${API_BASE}/utilisateurs/${editId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nom: form.nom, email: form.email, role: form.role }),
        });
      } else {
        res = await fetch(`${API_BASE}/utilisateurs`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nom: form.nom, email: form.email, mot_de_passe: form.mot_de_passe, role: form.role }),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || data.message || `Erreur serveur (${res.status})`;
        setFormError(msg);
        return;
      }

      showToast(editId ? 'Utilisateur modifié' : 'Utilisateur ajouté');
      fetchUsers();
      setModalOpen(false);
    } catch {
      setFormError('Erreur réseau. Vérifiez que le serveur est démarré.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${API_BASE}/utilisateurs/${deleteTarget}`, { method: 'DELETE' });
      if (!res.ok) {
        showToast('Erreur lors de la suppression', 'error');
        return;
      }
      showToast('Supprimé');
      fetchUsers();
    } catch {
      showToast('Erreur réseau', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="users-container">
      <div className="users-header">
        <h1 className="users-title">Utilisateurs</h1>
        <button className="btn-add" onClick={openAdd}><i className="fa-solid fa-plus"></i> Ajouter un utilisateur</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Total utilisateurs</div><div className="stat-value">{stats.total}</div></div>
        <div className="stat-card"><div className="stat-label">Administrateurs</div><div className="stat-value stat-warning">{stats.admins}</div></div>
        <div className="stat-card"><div className="stat-label">Techniciens</div><div className="stat-value stat-info">{stats.techs}</div></div>
        <div className="stat-card"><div className="stat-label">Équipe Data</div><div className="stat-value stat-success">{stats.data}</div></div>
      </div>

      <div className="search-filter-bar">
        <div className="search-box">
          <i className="fa-solid fa-search"></i>
          <input placeholder="Rechercher un utilisateur (nom, email, rôle)..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">Tous les rôles</option>
          <option value="admin">Administrateur</option>
          <option value="technicien">Technicien</option>
          <option value="data">Équipe Data</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table className="users-table">
          <thead><tr><th>Utilisateur</th><th>Email</th><th>Rôle</th><th>Inscription</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5"><div className="loading-container"><div className="spinner"></div><span className="loading-text">Chargement...</span></div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Aucun utilisateur</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="user-cell">
                    <img className="user-avatar" src={resolvePhotoUrl(u.photo_url)} alt="" />
                    <div className="user-info-cell">
                      <div className="user-name">{u.nom}</div>
                      <div className="user-id">#{u.id}</div>
                    </div>
                  </div>
                </td>
                <td>{u.email}</td>
                <td><span className={`role-badge ${getRoleBadge(u.role)}`}>{getRoleLabel(u.role)}</span></td>
                <td>{u.date_creation ? new Date(u.date_creation).toLocaleDateString('fr-FR') : '-'}</td>
                <td className="action-cell">
                  <button className="action-btn btn-edit" onClick={() => { setEditId(u.id); setForm({ nom: u.nom, email: u.email, mot_de_passe: '', role: u.role }); setFormError(''); setModalOpen(true); }}>
                    <i className="fa-solid fa-pen"></i>
                  </button>
                  <button className="action-btn btn-delete" onClick={() => setDeleteTarget(u.id)}><i className="fa-solid fa-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal ajout/edit */}
      {modalOpen && (
        <>
          <div className="modal-overlay active" onClick={() => setModalOpen(false)}></div>
          <div className="add-modal active">
            <div className="modal-header">
              <h3><i className="fa-solid fa-user-plus"></i> {editId ? 'Modifier' : 'Ajouter'} un utilisateur</h3>
              <button className="close-modal" onClick={() => setModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-content">
              {formError && <div className="form-error">{formError}</div>}
              <div className="form-group"><label>Nom complet *</label><input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="Nom complet" /></div>
              <div className="form-group"><label>Email *</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="exemple@domaine.com" /></div>
              {!editId && <div className="form-group"><label>Mot de passe *</label><input type="password" value={form.mot_de_passe} onChange={e => setForm({ ...form, mot_de_passe: e.target.value })} placeholder="Minimum 4 caractères" /></div>}
              <div className="form-group">
                <label>Rôle *</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="admin">Administrateur</option>
                  <option value="technicien">Technicien</option>
                  <option value="data">Équipe Data</option>
                </select>
              </div>
              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setModalOpen(false)}>Annuler</button>
                <button className="btn-save" onClick={handleSave}>Enregistrer</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal confirmation suppression */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer cet utilisateur ?"
        message="Cette action est irréversible. L'utilisateur sera définitivement supprimé."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
