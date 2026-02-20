import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function Contact() {
  const { API_BASE } = useAuth();
  const [userType, setUserType] = useState('citoyen');
  const [form, setForm] = useState({ nom_complet: '', nom_entreprise: '', nom_responsable: '', email: '', sujet: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  const autoSetPriority = (sujet) => {
    switch (sujet) {
      case 'panne': return 'haute';
      case 'proposition': return 'basse';
      case 'autre': return 'moyenne';
      default: return 'moyenne';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccess('');

    let nom_demandeur = '';
    if (userType === 'citoyen') {
      nom_demandeur = form.nom_complet;
    } else {
      nom_demandeur = form.nom_responsable || 'Responsable';
    }

    const payload = {
      source_type: userType,
      nom_demandeur,
      nom_entreprise: userType === 'entreprise' ? form.nom_entreprise : undefined,
      email: form.email,
      type_alerte: form.sujet,
      priorite: autoSetPriority(form.sujet),
      description: form.message,
    };

    try {
      const res = await fetch(`${API_BASE}/alertes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { alert('Erreur : ' + (data.error || "Impossible d'envoyer l'alerte.")); return; }
      setSuccess(`Votre alerte a été envoyée (N° ${data.id}). Merci !`);
      setForm({ nom_complet: '', nom_entreprise: '', nom_responsable: '', email: '', sujet: '', message: '' });
      setUserType('citoyen');
    } catch {
      alert('Erreur réseau, veuillez réessayer plus tard.');
    } finally {
      setSubmitting(false);
    }
  };

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <section className="contact-section">
      <div className="contact-container">
        <h1><i className="fa-solid fa-envelope"></i> Contactez-nous</h1>

        <div className="user-type">
          <label>
            <input type="radio" name="type" value="citoyen" checked={userType === 'citoyen'} onChange={() => setUserType('citoyen')} /> Particulier
          </label>
          <label>
            <input type="radio" name="type" value="entreprise" checked={userType === 'entreprise'} onChange={() => setUserType('entreprise')} /> Entreprise
          </label>
        </div>

        {success && <div className="success-msg">{success}</div>}

        <form onSubmit={handleSubmit}>
          {userType === 'citoyen' && (
            <div className="form-group">
              <label>Nom complet</label>
              <input type="text" placeholder="Entrez votre nom complet" required value={form.nom_complet} onChange={e => set('nom_complet', e.target.value)} />
            </div>
          )}

          {userType === 'entreprise' && (
            <>
              <div className="form-group">
                <label>Nom de l'entreprise</label>
                <input type="text" placeholder="Entrez le nom de votre entreprise" required value={form.nom_entreprise} onChange={e => set('nom_entreprise', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Nom du responsable</label>
                <input type="text" placeholder="Nom du responsable" value={form.nom_responsable} onChange={e => set('nom_responsable', e.target.value)} />
              </div>
            </>
          )}

          <div className="form-group">
            <label>Email</label>
            <input type="email" placeholder="exemple@domaine.com" required value={form.email} onChange={e => set('email', e.target.value)} />
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
            <textarea placeholder="Décrivez votre problème ou message..." required value={form.message} onChange={e => set('message', e.target.value)}></textarea>
          </div>

          <button type="submit" className="btn-submit" disabled={submitting}>
            {submitting ? 'Envoi en cours...' : 'Envoyer'}
          </button>
        </form>
      </div>
    </section>
  );
}
