import { useState, useEffect, useRef } from 'react';
import { useAuth, ORIGIN } from '../../context/AuthContext';
import { formatLabel } from '../../utils/helpers';
import '../../css/compterendu.css';

const TYPES = [
  'Rapport mensuel',
  'Analyse énergétique',
  'Bilan consommation',
  'Rapport incident',
  'Audit technique',
  'Autre',
];

function getFileIcon(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return { className: 'pdf', icon: 'fa-file-pdf' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { className: 'excel', icon: 'fa-file-excel' };
  if (['doc', 'docx'].includes(ext)) return { className: 'word', icon: 'fa-file-word' };
  return { className: 'other', icon: 'fa-file' };
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function DataCompteRendu() {
  const { user, API_BASE } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragover, setDragover] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [titre, setTitre] = useState('');
  const [type, setType] = useState(TYPES[0]);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const fetchReports = () => {
    fetch(`${API_BASE}/compte-rendus/mine?userId=${user?.id}`)
      .then(r => r.json())
      .then(data => setReports(Array.isArray(data) ? data : []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (user?.id) fetchReports(); }, [API_BASE, user?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const file = selectedFile;
    if (!file) { alert('Veuillez sélectionner un fichier.'); return; }
    if (!type) { alert('Veuillez choisir un type.'); return; }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('fichier', file);
      formData.append('titre', titre);
      formData.append('type', type);
      formData.append('created_by', user.id);

      const res = await fetch(`${API_BASE}/compte-rendus`, { method: 'POST', body: formData });
      if (res.ok) {
        setTitre('');
        setType(TYPES[0]);
        setSelectedFile(null);
        setFormOpen(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchReports();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || err.error || `Erreur serveur (${res.status}).`);
      }
    } catch (e) {
      console.error('Erreur réseau comptes-rendus:', e);
      alert('Erreur réseau. Vérifiez que le serveur est démarré.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragover(false);
    if (e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setFormOpen(true);
    }
  };

  const handleDownload = (report) => {
    const url = report.fichier_url?.startsWith('http') ? report.fichier_url : `${ORIGIN}${report.fichier_url}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = report.nom_fichier || 'fichier';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="compterendu-container">
      <div className="compterendu-header">
        <h1><i className="fa-solid fa-file-circle-plus"></i> Compte Rendu</h1>
        <button className="btn-add-report" onClick={() => setFormOpen(true)}>
          <i className="fa-solid fa-plus"></i> Ajouter un rapport
        </button>
      </div>

      {/* Formulaire d'ajout */}
      {formOpen && (
        <>
          <div className="modal-overlay active" onClick={() => setFormOpen(false)}></div>
          <div className="cr-modal active">
            <div className="cr-modal-header">
              <h3><i className="fa-solid fa-cloud-arrow-up"></i> Nouveau compte rendu</h3>
              <button className="close-modal" onClick={() => setFormOpen(false)}>&times;</button>
            </div>
            <form className="cr-modal-body" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Titre (optionnel)</label>
                <input type="text" placeholder="Ex: Rapport mensuel janvier" value={titre} onChange={e => setTitre(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Type de rapport *</label>
                <select value={type} onChange={e => setType(e.target.value)}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div
                className={`upload-zone${dragover ? ' dragover' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
                onDragLeave={() => setDragover(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <>
                    <i className="fa-solid fa-file-circle-check"></i>
                    <p><strong>{selectedFile.name}</strong></p>
                    <p className="upload-hint">Cliquez pour changer le fichier</p>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                    <p><strong>Glissez-déposez un fichier ici</strong></p>
                    <p className="upload-hint">ou cliquez pour parcourir</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  accept=".pdf,.xls,.xlsx,.csv,.doc,.docx"
                  onChange={e => { if (e.target.files[0]) setSelectedFile(e.target.files[0]); }}
                />
              </div>
              <div className="cr-modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setFormOpen(false)}>Annuler</button>
                <button type="submit" className="btn-save" disabled={uploading}>
                  {uploading ? 'Envoi en cours...' : 'Envoyer'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Historique */}
      <div className="cr-section-title">
        <h2><i className="fa-solid fa-clock-rotate-left"></i> Historique de mes rapports</h2>
      </div>

      {loading ? (
        <div className="empty-reports">
          <i className="fa-solid fa-spinner fa-spin"></i>
          <p>Chargement...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="empty-reports">
          <i className="fa-solid fa-folder-open"></i>
          <p>Aucun rapport envoyé pour le moment.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="cr-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Heure</th>
                <th>Type</th>
                <th>Titre</th>
                <th>Fichier</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(r => {
                const { className, icon } = getFileIcon(r.nom_fichier);
                return (
                  <tr key={r.id}>
                    <td>{formatDate(r.created_at)}</td>
                    <td>{formatTime(r.created_at)}</td>
                    <td><span className="type-badge">{formatLabel(r.type)}</span></td>
                    <td>{r.titre || <span className="text-muted">—</span>}</td>
                    <td>
                      <div className="file-cell">
                        <i className={`fa-solid ${icon} file-icon-${className}`}></i>
                        <span className="file-name-cell">{r.nom_fichier}</span>
                      </div>
                    </td>
                    <td>
                      <button className="btn-action-sm download" onClick={() => handleDownload(r)} title="Télécharger">
                        <i className="fa-solid fa-download"></i>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
