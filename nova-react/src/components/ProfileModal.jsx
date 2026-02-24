import { useState } from 'react';
import { useAuth, resolvePhotoUrl } from '../context/AuthContext';

export default function ProfileModal({ open, onClose }) {
  const { user, updateUser, API_BASE } = useAuth();
  const [editing, setEditing] = useState(false);
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!open || !user) return null;

  const startEdit = () => {
    setNom(user.nom || '');
    setEmail(user.email || '');
    setPhotoFile(null);
    setPhotoPreview(null);
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!nom.trim() || !email.trim()) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('nom', nom);
      fd.append('email', email);
      fd.append('role', user.role);
      if (photoFile) fd.append('photo', photoFile);

      const res = await fetch(`${API_BASE}/utilisateurs/${user.id}`, {
        method: 'PUT',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Impossible de modifier le profil'); return; }
      updateUser(data);
      setEditing(false);
    } catch {
      alert('Erreur réseau.');
    } finally {
      setSaving(false);
    }
  };

  const imgSrc = photoPreview || resolvePhotoUrl(user.photo_url);

  return (
    <>
      <div className={`profile-overlay${open ? ' active' : ''}`} onClick={onClose}></div>
      <div className={`profile-modal${open ? ' active' : ''}`}>
        <div className="profile-header">
          <h3><i className="fa-solid fa-user"></i> Mon Profil</h3>
          <button className="close-profile" onClick={onClose}>&times;</button>
        </div>
        <div className="profile-content">
          <div className="profile-picture">
            <img src={imgSrc} alt="Photo de profil" />
            {editing && (
              <div style={{ marginTop: 10, textAlign: 'center' }}>
                <input type="file" accept="image/*" onChange={handlePhotoChange} />
              </div>
            )}
          </div>
          <div className="profile-info">
            <p>
              <strong>Nom : </strong>
              {editing ? (
                <input value={nom} onChange={(e) => setNom(e.target.value)} />
              ) : (
                <span>{user.nom}</span>
              )}
            </p>
            <p>
              <strong>Email : </strong>
              {editing ? (
                <input value={email} onChange={(e) => setEmail(e.target.value)} />
              ) : (
                <span>{user.email}</span>
              )}
            </p>
            <p><strong>Rôle : </strong><span style={{ textTransform: 'capitalize' }}>{user.role}</span></p>
            <p><strong>Inscription : </strong>
              <span>{user.date_creation ? new Date(user.date_creation).toLocaleDateString('fr-FR') : '-'}</span>
            </p>
          </div>
          <div className="profile-footer">
            {editing ? (
              <>
                <button onClick={cancelEdit} style={{ background: 'var(--muted)' }}>Annuler</button>
                <button onClick={handleSave} disabled={saving}>
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </>
            ) : (
              <button onClick={startEdit}><i className="fa-solid fa-pen"></i> Modifier</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
