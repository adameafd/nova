import '../../css/accueil.css';

export default function ControlUnit() {
  return (
    <div className="control-unit-page">
      <div className="welcome-section" style={{ textAlign: 'center' }}>
        <h1><i className="fa-solid fa-cogs"></i> Unite de controle</h1>
        <p style={{ opacity: 0.85, marginTop: 8 }}>
          Cette fonctionnalite est en cours de developpement et sera disponible prochainement.
        </p>
      </div>
      <div style={{ padding: '40px 30px', textAlign: 'center' }}>
        <div className="stat-card" style={{ maxWidth: 500, margin: '0 auto', padding: 40 }}>
          <i className="fa-solid fa-gears" style={{ fontSize: 64, color: 'var(--green)', marginBottom: 16 }}></i>
          <h2 style={{ marginBottom: 12, color: 'var(--text)' }}>En construction</h2>
          <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
            Le module Unite de controle vous permettra de gerer et surveiller les unites de votre infrastructure Smart City en temps reel.
          </p>
        </div>
      </div>
    </div>
  );
}
