import { useState, useEffect, useCallback } from 'react';

// ── Toast notification ──
let toastTimeout = null;

export function showToast(message, type = 'success') {
  // Remove existing toast
  const existing = document.querySelector('.nova-toast');
  if (existing) existing.remove();
  if (toastTimeout) clearTimeout(toastTimeout);

  const toast = document.createElement('div');
  toast.className = `nova-toast nova-toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle'}"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('show'));

  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Confirm Modal Component ──
export default function ConfirmModal({ open, title, message, onConfirm, onCancel, confirmText = 'Supprimer', cancelText = 'Annuler', danger = true }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }, [onConfirm]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <>
      <div className="modal-overlay active" onClick={onCancel}></div>
      <div className="confirm-modal active">
        <div className="confirm-modal-icon">
          <i className={`fa-solid ${danger ? 'fa-triangle-exclamation' : 'fa-circle-question'}`}></i>
        </div>
        <h3 className="confirm-modal-title">{title || 'Confirmation'}</h3>
        <p className="confirm-modal-message">{message || 'Cette action est irréversible.'}</p>
        <div className="confirm-modal-actions">
          <button className="btn-cancel" onClick={onCancel} disabled={loading}>{cancelText}</button>
          <button className={`btn-confirm-delete${danger ? ' danger' : ''}`} onClick={handleConfirm} disabled={loading}>
            {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Suppression...</> : <><i className="fa-solid fa-trash"></i> {confirmText}</>}
          </button>
        </div>
      </div>
    </>
  );
}
