import smartcityImg from '../../assets/smartcity.png';
import monkeyImg from '../../assets/monkey.jpeg';

export default function About() {
  return (
    <>
      <section className="hero">
        <h1>À propos de NOVA</h1>
        <p>
          NOVA est un projet innovant qui combine durabilité, énergie intelligente et technologie
          pour rendre les villes plus sûres, autonomes et écologiques.
        </p>
      </section>

      <section className="about">
        <div className="about-text">
          <h2>Notre mission</h2>
          <p>
            Grâce à la récupération d'énergie cinétique issue des chocs des véhicules avec la chaussée, notre Smart City
            utilise cette énergie pour alimenter l'éclairage public de manière durable.
          </p>
          <p>
            Nous intégrons ensuite un système de supervision intelligent permettant aux techniciens et aux équipes
            d'analyser les performances énergétiques et d'optimiser la gestion urbaine en temps réel.
          </p>
        </div>
        <div className="about-img">
          <img src={smartcityImg} alt="Smart City NOVA" />
        </div>
      </section>

      <section className="team">
        <h2>Notre équipe</h2>
        <div className="team-members">
          {[
            { name: 'Adame', role: 'Partie web' },
            { name: 'Mariam', role: 'Partie web' },
            { name: 'Yasmine', role: 'Partie web' },
            { name: 'Anass', role: 'Partie maquette' },
            { name: 'Imrane', role: 'Partie maquette' },
          ].map(m => (
            <div className="member" key={m.name}>
              <img src={monkeyImg} alt={m.name} />
              <h3>{m.name}</h3>
              <p>{m.role}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
