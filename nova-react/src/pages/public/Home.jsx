import { Link } from 'react-router-dom';
import voitImg from '../../assets/voit.png';

export default function Home() {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <div className="hero-text">
          <p className="hero-subtitle">Bienvenue dans le Futur</p>
          <h1>NOVA Smart City</h1>
          <p className="hero-tagline">La ville intelligente à portée de main</p>
          <div className="hero-buttons">
            <Link to="/about" className="btn-primary">À propos</Link>
            <Link to="/contact" className="btn-secondary">Nous Contacter</Link>
          </div>
        </div>
        <div className="hero-image">
          <img src={voitImg} alt="Illustration d'une ville intelligente NOVA" />
        </div>
      </div>
    </section>
  );
}
