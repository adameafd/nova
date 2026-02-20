import { useState, useEffect } from 'react';
import { useAuth, ORIGIN } from '../../context/AuthContext';
import ConfirmModal, { showToast } from '../../components/ConfirmModal';
import { formatLabel } from '../../utils/helpers';
import '../../css/compterendu.css';

function getFileIcon(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return { className: 'pdf', icon: 'fa-file-pdf' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { className: 'excel', icon: 'fa-file-excel' };
  if (['doc', 'docx'].includes(ext)) return { className: 'word', icon: 'fa-file-word' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return { className: 'image', icon: 'fa-file-image' };
  return { className: 'other', icon: 'fa-file' };
}

function getFileExt(filename) {
  return (filename || '').split('.').pop().toLowerCase();
}

function isPreviewable(filename) {
  const ext = getFileExt(filename);
  return ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminCompteRendu() {
  const { API_BASE } = useAuth();
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewReport, setPreviewReport] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchReports = () => {
    fetch(`${API_BASE}/compte-rendus`)
      .then(r => r.json())
      .then(data => setReports(Array.isArray(data) ? data : []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReports(); }, [API_BASE]);

  const types = [...new Set(reports.map(r => r.type).filter(Boolean))];

  const filtered = reports.filter(r => {
    if (typeFilter && r.type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !r.nom_fichier?.toLowerCase().includes(s) &&
        !r.titre?.toLowerCase().includes(s) &&
        !r.auteur_nom?.toLowerCase().includes(s) &&
        !r.type?.toLowerCase().includes(s)
      ) return false;
    }
    return true;
  });

  const getFileUrl = (report) => {
    return report.fichier_url?.startsWith('http') ? report.fichier_url : `${ORIGIN}${report.fichier_url}`;
  };

  const handleDownload = (report) => {
    const url = getFileUrl(report);
    const a = document.createElement('a');
    a.href = url;
    a.download = report.nom_fichier || 'fichier';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleView = (report) => {
    if (isPreviewable(report.nom_fichier)) {
      setPreviewReport(report);
    } else {
      // Non-previewable files: open download or new tab
      window.open(getFileUrl(report), '_blank');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`${API_BASE}/compte-rendus/${deleteTarget}`, { method: 'DELETE' });
      showToast('Supprimé');
      fetchReports();
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const stats = {
    total: reports.length,
    thisMonth: reports.filter(r => {
      const d = new Date(r.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
  };

  return (
    <div className="compterendu-container">
      <div className="compterendu-header">
        <h1><i className="fa-solid fa-folder-open"></i> Comptes Rendus</h1>
      </div>

      {/* Statistiques */}
      <div className="cr-stats">
        <div className="cr-stat-card">
          <i className="fa-solid fa-file-lines"></i>
          <div>
            <div className="cr-stat-value">{stats.total}</div>
            <div className="cr-stat-label">Total rapports</div>
          </div>
        </div>
        <div className="cr-stat-card">
          <i className="fa-solid fa-calendar-check"></i>
          <div>
            <div className="cr-stat-value">{stats.thisMonth}</div>
            <div className="cr-stat-label">Ce mois-ci</div>
          </div>
        </div>
        <div className="cr-stat-card">
          <i className="fa-solid fa-users"></i>
          <div>
            <div className="cr-stat-value">{new Set(reports.map(r => r.created_by)).size}</div>
            <div className="cr-stat-label">Contributeurs</div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="cr-filters">
        <div className="search-box">
          <i className="fa-solid fa-search"></i>
          <input
            placeholder="Rechercher par nom, titre, auteur..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">Tous les types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="empty-reports">
          <i className="fa-solid fa-spinner fa-spin"></i>
          <p>Chargement...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-reports">
          <i className="fa-solid fa-folder-open"></i>
          <p>{search || typeFilter ? 'Aucun rapport trouvé.' : 'Aucun rapport publié.'}</p>
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
                <th>Ajouté par</th>
                <th>Fichier</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const { className, icon } = getFileIcon(r.nom_fichier);
                return (
                  <tr key={r.id}>
                    <td>{formatDate(r.created_at)}</td>
                    <td>{formatTime(r.created_at)}</td>
                    <td><span className="type-badge">{formatLabel(r.type)}</span></td>
                    <td>{r.titre || <span className="text-muted">—</span>}</td>
                    <td>
                      <div className="author-cell">
                        <span className="author-name">{r.auteur_nom || 'Inconnu'}</span>
                        <span className="author-id">#{r.created_by}</span>
                      </div>
                    </td>
                    <td>
                      <div className="file-cell">
                        <i className={`fa-solid ${icon} file-icon-${className}`}></i>
                        <span className="file-name-cell">{r.nom_fichier}</span>
                      </div>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-action-sm view" onClick={() => handleView(r)} title="Consulter">
                          <i className="fa-solid fa-eye"></i>
                        </button>
                        <button className="btn-action-sm download" onClick={() => handleDownload(r)} title="Télécharger">
                          <i className="fa-solid fa-download"></i>
                        </button>
                        <button className="btn-action-sm delete" onClick={() => setDeleteTarget(r.id)} title="Supprimer">
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
      )}

      {/* Modal preview fichier */}
      {previewReport && (
        <>
          <div className="modal-overlay active" onClick={() => setPreviewReport(null)}></div>
          <div className="preview-modal active">
            <div className="preview-modal-header">
              <h3><i className="fa-solid fa-eye"></i> {previewReport.titre || previewReport.nom_fichier}</h3>
              <button className="close-modal" onClick={() => setPreviewReport(null)}>&times;</button>
            </div>
            <div className="preview-modal-body">
              {getFileExt(previewReport.nom_fichier) === 'pdf' ? (
                <iframe
                  src={getFileUrl(previewReport)}
                  title={previewReport.nom_fichier}
                />
              ) : ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(getFileExt(previewReport.nom_fichier)) ? (
                <img src={getFileUrl(previewReport)} alt={previewReport.nom_fichier} />
              ) : (
                <div className="preview-unsupported">
                  <i className="fa-solid fa-file-circle-question"></i>
                  <p>Aperçu non disponible pour ce type de fichier.</p>
                  <button className="btn-save" onClick={() => handleDownload(previewReport)}>
                    <i className="fa-solid fa-download"></i> Télécharger
                  </button>
                </div>
              )}
            </div>
            <div className="preview-modal-footer">
              <button className="btn-cancel" onClick={() => setPreviewReport(null)}>Fermer</button>
              <button className="btn-save" onClick={() => handleDownload(previewReport)}>
                <i className="fa-solid fa-download"></i> Télécharger
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal confirmation suppression */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer ce rapport ?"
        message="Le rapport et son fichier seront définitivement supprimés."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
