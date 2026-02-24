import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth, resolvePhotoUrl, API_BASE } from '../../context/AuthContext';
import ConfirmModal, { showToast } from '../../components/ConfirmModal';
import { tolerantSearch, getRoleLabel } from '../../utils/helpers';
import '../../css/users.css';

function generateEmail(nom, role) {
  const normalized = nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');
  const domain = role === 'admin' ? 'admin' : role === 'data' ? 'data' : role === 'entreprise' ? 'entreprise' : 'technicien';
  return normalized ? `${normalized}@${domain}.nova.com` : '';
}

const ROLE_BADGE = {
  admin:      'admin',
  technicien: 'tech',
  tech:       'tech',
  data:       'data',
  entreprise: 'entreprise',
};

export default function AdminUsers() {
  useAuth(); // garde la session active
  const { globalSearch } = useOutletContext() || {};
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nom: '', email: '', mot_de_passe: '', role: 'admin', emailEdited: false });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const fetchRef = useRef(0); // compteur pour ignorer les réponses obsolètes

  // Fetch initial — s'exécute une seule fois au montage
  useEffect(() => {
    const controller = new AbortController();
    const id = ++fetchRef.current;
    setLoading(true);

    fetch(`${API_BASE}/utilisateurs`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { if (id === fetchRef.current) setUsers(Array.isArray(d) ? d : []); })
      .catch(err => { if (err.name !== 'AbortError') console.error('[Users] fetch:', err.message); })
      .finally(() => { if (id === fetchRef.current) setLoading(false); });

    return () => controller.abort();
  }, []);

  // Re-fetch explicite (après ajout / modification / suppression)
  const refetch = () => {
    const id = ++fetchRef.current;
    fetch(`${API_BASE}/utilisateurs`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { if (id === fetchRef.current) setUsers(Array.isArray(d) ? d : []); })
      .catch(err => {
        console.error('[Users] refetch:', err.message);
        showToast('Erreur lors du rechargement de la liste', 'error');
      });
  };

  const activeSearch = search || globalSearch || '';
  const filtered = users.filter(u => {
    if (roleFilter && u.role !== roleFilter) return false;
    return tolerantSearch(activeSearch, { nom: u.nom, email: u.email, role: u.role });
  });

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    techs: users.filter(u => u.role === 'technicien' || u.role === 'tech').length,
    data: users.filter(u => u.role === 'data').length,
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ nom: '', email: '', mot_de_passe: '', role: 'admin', emailEdited: false });
    setPhotoFile(null);
    setPhotoPreview(null);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setEditId(u.id);
    // normalise "technicien" → "tech" pour coller à la DB
    const role = u.role === 'technicien' ? 'tech' : (u.role || 'tech');
    setForm({ nom: u.nom, email: u.email, mot_de_passe: '', role, emailEdited: true });
    setPhotoFile(null);
    setPhotoPreview(resolvePhotoUrl(u.photo_url));
    setFormError('');
    setModalOpen(true);
  };

  const handleNomChange = (e) => {
    const nom = e.target.value;
    setForm(prev => ({
      ...prev,
      nom,
      email: prev.emailEdited ? prev.email : generateEmail(nom, prev.role),
    }));
  };

  const handleRoleChange = (e) => {
    const role = e.target.value;
    setForm(prev => ({
      ...prev,
      role,
      email: prev.emailEdited ? prev.email : generateEmail(prev.nom, role),
    }));
  };

  const validateForm = () => {
    if (!form.nom.trim()) return 'Le nom est requis.';
    if (!form.email.trim()) return "L'email est requis.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Format d'email invalide.";
    if (!editId && !form.mot_de_passe.trim()) return 'Le mot de passe est requis.';
    if (!editId && form.mot_de_passe.trim().length < 4) return 'Minimum 4 caractères.';
    return null;
  };

  const handleSave = async () => {
    const err = validateForm();
    if (err) { setFormError(err); return; }
    setFormError('');

    try {
      const fd = new FormData();
      fd.append('nom', form.nom.trim());
      fd.append('email', form.email.trim());
      fd.append('role', form.role);
      if (!editId) fd.append('mot_de_passe', form.mot_de_passe);
      if (photoFile) fd.append('photo', photoFile);

      const res = await fetch(
        editId ? `${API_BASE}/utilisateurs/${editId}` : `${API_BASE}/utilisateurs`,
        { method: editId ? 'PUT' : 'POST', body: fd }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setFormError(body.error || body.message || `Erreur ${res.status}`);
        return;
      }

      setModalOpen(false);
      showToast(editId ? 'Utilisateur modifié ✓' : 'Utilisateur ajouté ✓');
      refetch();
    } catch {
      setFormError('Erreur réseau.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`${API_BASE}/utilisateurs/${deleteTarget}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(u => u.id !== deleteTarget));
      showToast('Supprimé');
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
        <button className="btn-add" onClick={openAdd}>
          <i className="fa-solid fa-plus"></i> Ajouter un utilisateur
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Total</div><div className="stat-value">{stats.total}</div></div>
        <div className="stat-card"><div className="stat-label">Administrateurs</div><div className="stat-value stat-warning">{stats.admins}</div></div>
        <div className="stat-card"><div className="stat-label">Techniciens</div><div className="stat-value stat-info">{stats.techs}</div></div>
        <div className="stat-card"><div className="stat-label">Équipe Data</div><div className="stat-value stat-success">{stats.data}</div></div>
      </div>

      <div className="search-filter-bar">
        <div className="search-box">
          <i className="fa-solid fa-search"></i>
          <input
            placeholder="Rechercher (nom, email, rôle)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="filter-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">Tous les rôles</option>
          <option value="admin">Administrateur</option>
          <option value="tech">Technicien</option>
          <option value="data">Équipe Data</option>
          <option value="entreprise">Entreprise</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table className="users-table">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Inscription</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5">
                <div className="loading-container">
                  <div className="spinner"></div>
                  <span className="loading-text">Chargement...</span>
                </div>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
                Aucun utilisateur
              </td></tr>
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
                <td>
                  <span className={`role-badge ${ROLE_BADGE[u.role] || 'data'}`}>
                    {getRoleLabel(u.role) || u.role || '—'}
                  </span>
                </td>
                <td>{u.date_creation ? new Date(u.date_creation).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="action-cell">
                  <button className="action-btn btn-edit" onClick={() => openEdit(u)} title="Modifier">
                    <i className="fa-solid fa-pen"></i>
                  </button>
                  <button className="action-btn btn-delete" onClick={() => setDeleteTarget(u.id)} title="Supprimer">
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal ajout / édition */}
      {modalOpen && (
        <>
          <div className="modal-overlay active" onClick={() => setModalOpen(false)} />
          <div className="add-modal active">
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-user-plus"></i>{' '}
                {editId ? 'Modifier' : 'Ajouter'} un utilisateur
              </h3>
              <button className="close-modal" onClick={() => setModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-content">
              {formError && <div className="form-error">{formError}</div>}

              {/* Photo */}
              <div className="form-group photo-picker-group">
                <label>Photo de profil</label>
                <div className="photo-picker">
                  <div className="photo-preview">
                    {photoPreview
                      ? <img src={photoPreview} alt="Aperçu" />
                      : <i className="fa-solid fa-user"></i>
                    }
                  </div>
                  <label className="photo-upload-btn" htmlFor="photo-input">
                    <i className="fa-solid fa-upload"></i>
                    {photoFile ? photoFile.name : 'Choisir une photo'}
                  </label>
                  <input
                    id="photo-input"
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const f = e.target.files[0];
                      if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); }
                    }}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Nom complet *</label>
                <input autoComplete="off" value={form.nom} onChange={handleNomChange} placeholder="Nom complet" />
              </div>

              <div className="form-group">
                <label>Rôle *</label>
                <select value={form.role} onChange={handleRoleChange}>
                  <option value="admin">Administrateur</option>
                  <option value="tech">Technicien</option>
                  <option value="data">Équipe Data</option>
                  <option value="entreprise">Entreprise</option>
                </select>
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="text"
                  autoComplete="new-password"
                  value={form.email}
                  onChange={e => {
                    const val = e.target.value;
                    setForm(prev => ({
                      ...prev,
                      email: val,
                      // Si l'utilisateur vide le champ, on réactive la génération auto
                      emailEdited: val !== '',
                    }));
                  }}
                  placeholder="généré automatiquement"
                />
                {!editId && !form.emailEdited && form.email && (
                  <span className="email-auto-hint">
                    <i className="fa-solid fa-bolt"></i> Généré automatiquement
                  </span>
                )}
                {!editId && form.emailEdited && (
                  <button
                    type="button"
                    className="email-reset-btn"
                    onClick={() => setForm(prev => ({
                      ...prev,
                      email: generateEmail(prev.nom, prev.role),
                      emailEdited: false,
                    }))}
                  >
                    <i className="fa-solid fa-rotate-left"></i> Régénérer
                  </button>
                )}
              </div>

              {!editId && (
                <div className="form-group">
                  <label>Mot de passe *</label>
                  <input
                    type="password"
                    value={form.mot_de_passe}
                    onChange={e => setForm(prev => ({ ...prev, mot_de_passe: e.target.value }))}
                    placeholder="Minimum 4 caractères"
                  />
                </div>
              )}

              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setModalOpen(false)}>Annuler</button>
                <button className="btn-save" onClick={handleSave}>Enregistrer</button>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer cet utilisateur ?"
        message="Cette action est irréversible."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
