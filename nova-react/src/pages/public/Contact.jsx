import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function Contact() {
  const { API_BASE } = useAuth();
  const [form, setForm] = useState({ nom_complet: '', email: '', sujet: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccess('');

    const payload = {
      source_type: 'citoyen',
      nom_demandeur: form.nom_complet,
      email: form.email,
      type_alerte: form.sujet,
      description: form.message,
    };

    try {
      const res = await fetch(`${API_BASE}/alertes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSuccess('');
        const msg = data.error || "Impossible d'envoyer l'alerte.";
        setSuccess(`❌ Erreur : ${msg}`);
        return;
      }
      setSuccess(`✅ Votre alerte a été envoyée (N° ${data.id}). Merci !`);
      setForm({ nom_complet: '', email: '', sujet: '', message: '' });
    } catch (err) {
      setSuccess(`❌ Erreur réseau : ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <section className="contact-section">
      <div className="contact-container">
        <h1><i className="fa-solid fa-envelope"></i> Contactez-nous</h1>

        {success && <div className="success-msg">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nom complet</label>
            <input
              type="text"
              placeholder="Entrez votre nom complet"
              required
              value={form.nom_complet}
              onChange={e => set('nom_complet', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="exemple@domaine.com"
              required
              value={form.email}
              onChange={e => set('email', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Sujet</label>
            <select required value={form.sujet} onChange={e => set('sujet', e.target.value)}>
              <option value="">-- Sélectionnez un sujet --</option>
              <option value="panne">Panne ou dysfonctionnement</option>
              <option value="proposition">Proposition d'amélioration</option>
              <option value="autre">Autre</option>
            </select>
          </div>

          <div className="form-group">
            <label>Message / Problème</label>
            <textarea
              placeholder="Décrivez votre problème ou message..."
              required
              value={form.message}
              onChange={e => set('message', e.target.value)}
            ></textarea>
          </div>

          <button type="submit" className="btn-submit" disabled={submitting}>
            {submitting ? 'Envoi en cours...' : 'Envoyer'}
          </button>
        </form>
      </div>
    </section>
  );
}
