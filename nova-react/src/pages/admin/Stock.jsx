import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal, { showToast } from '../../components/ConfirmModal';
import { getCategoryLabel } from '../../utils/helpers';
import '../../css/stock.css';

function getStatus(item) {
  if (item.quantite === 0) return { label: 'Rupture', cls: 'danger', icon: 'times-circle' };
  if (item.quantite < 5) return { label: 'Faible', cls: 'warning', icon: 'exclamation-circle' };
  return { label: 'En stock', cls: 'success', icon: 'check-circle' };
}

export default function AdminStock() {
  const { API_BASE } = useAuth();
  const [stock, setStock] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nom: '', quantite: '', categorie: 'energie' });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchStock = () => {
    fetch(`${API_BASE}/stock`).then(r => r.json()).then(d => setStock(Array.isArray(d) ? d : [])).catch(() => {});
  };

  useEffect(() => { fetchStock(); }, [API_BASE]);

  const filtered = stock.filter(item => {
    const s = getStatus(item);
    const statusKey = s.cls === 'success' ? 'en stock' : s.cls === 'warning' ? 'faible' : 'rupture';
    if (categoryFilter && item.categorie !== categoryFilter) return false;
    if (statusFilter && statusKey !== statusFilter) return false;
    if (search && !item.nom?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalProducts = stock.length;
  const usedProducts = stock.reduce((sum, i) => sum + (i.total_utilise || 0), 0);

  const openAdd = () => { setEditId(null); setForm({ nom: '', quantite: '', categorie: 'energie' }); setModalOpen(true); };
  const openEdit = (item) => { setEditId(item.id); setForm({ nom: item.nom, quantite: item.quantite, categorie: item.categorie }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.nom.trim()) { alert('Nom requis'); return; }
    const body = { nom: form.nom, categorie: form.categorie, quantite: parseInt(form.quantite) || 0 };
    try {
      if (editId) {
        await fetch(`${API_BASE}/stock/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      } else {
        await fetch(`${API_BASE}/stock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }
      showToast(editId ? 'Produit modifié' : 'Produit ajouté');
      fetchStock();
      setModalOpen(false);
    } catch { alert('Erreur'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`${API_BASE}/stock/${deleteTarget}`, { method: 'DELETE' });
      showToast('Supprimé');
      fetchStock();
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const adjustQty = async (item, delta) => {
    const newQty = item.quantite + delta;
    if (newQty < 0) { alert('Stock épuisé !'); return; }
    await fetch(`${API_BASE}/stock/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: item.nom, categorie: item.categorie, quantite: newQty, total_utilise: (item.total_utilise || 0) + (delta < 0 ? Math.abs(delta) : 0) }),
    }).catch(() => {});
    fetchStock();
  };

  return (
    <div className="stock-container">
      <div className="stock-header">
        <h1 className="stock-title">Stock</h1>
        <button className="btn-add" onClick={openAdd}><i className="fa-solid fa-plus"></i> Ajouter un produit</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Total produits</div><div className="stat-value">{totalProducts}</div></div>
        <div className="stat-card"><div className="stat-label">Ajoutés ce mois</div><div className="stat-value stat-success">0</div></div>
        <div className="stat-card"><div className="stat-label">Produits utilisés</div><div className="stat-value stat-danger">{usedProducts}</div></div>
      </div>

      <div className="search-filter-bar">
        <div className="search-box">
          <i className="fa-solid fa-search"></i>
          <input placeholder="Rechercher un produit..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">Catégorie</option>
          <option value="energie">Énergie</option>
          <option value="capteurs">Capteurs</option>
          <option value="iot">IoT</option>
          <option value="autre">Autre</option>
        </select>
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Statut</option>
          <option value="en stock">En stock</option>
          <option value="faible">Faible</option>
          <option value="rupture">Rupture</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table className="stock-table">
          <thead><tr><th>Produit</th><th>Catégorie</th><th>Quantité</th><th>Statut</th><th>Gestion</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Aucun produit</td></tr>
            ) : filtered.map(item => {
              const status = getStatus(item);
              return (
                <tr key={item.id}>
                  <td>
                    <div className="product-cell">
                      <div className="product-code">{(item.code || item.nom?.[0] || 'P').toUpperCase()}</div>
                      <div className="product-info">
                        <div className="product-name">{item.nom}</div>
                        <div className="product-id">#{item.id}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="category-badge">{getCategoryLabel(item.categorie)}</span></td>
                  <td><strong>{item.quantite}</strong></td>
                  <td><span className={`status-badge status-${status.cls}`}><i className={`fa-solid fa-${status.icon}`}></i> {status.label}</span></td>
                  <td className="gestion-cell">
                    <div className="gestion-controls">
                      <button className="gestion-btn minus" onClick={() => adjustQty(item, -1)}><i className="fa-solid fa-minus"></i></button>
                      <span className="gestion-value">{item.quantite}</span>
                      <button className="gestion-btn plus" onClick={() => adjustQty(item, 1)}><i className="fa-solid fa-plus"></i></button>
                    </div>
                  </td>
                  <td className="action-cell">
                    <button className="action-btn btn-edit" onClick={() => openEdit(item)}><i className="fa-solid fa-pen"></i></button>
                    <button className="action-btn btn-delete" onClick={() => setDeleteTarget(item.id)}><i className="fa-solid fa-trash"></i></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <>
          <div className="modal-overlay active" onClick={() => setModalOpen(false)}></div>
          <div className="add-modal active">
            <div className="modal-header">
              <h3><i className="fa-solid fa-box"></i> {editId ? 'Modifier' : 'Ajouter'} un produit</h3>
              <button className="close-modal" onClick={() => setModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-content">
              <div className="form-group"><label>Nom</label><input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} /></div>
              <div className="form-group"><label>Quantité</label><input type="number" value={form.quantite} onChange={e => setForm({ ...form, quantite: e.target.value })} /></div>
              <div className="form-group">
                <label>Catégorie</label>
                <select value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })}>
                  <option value="energie">Énergie</option><option value="capteurs">Capteurs</option><option value="iot">IoT</option><option value="autre">Autre</option>
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

      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer ce produit ?"
        message="Le produit sera définitivement supprimé du stock."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
