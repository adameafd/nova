# NOVA Frontend

Application React pour la plateforme NOVA Smart City.

## Prerequis

- Node.js >= 18
- Backend API lance sur http://localhost:3000

## Installation

```bash
npm install
npm run dev
```

L'application demarre sur http://localhost:5173

## Scripts

| Commande          | Description                    |
|-------------------|--------------------------------|
| `npm run dev`     | Serveur de developpement       |
| `npm run build`   | Build de production            |
| `npm run preview` | Preview du build               |
| `npm run lint`    | Verification ESLint            |
| `npm test`        | Tests unitaires (watch)        |
| `npm run test:run`| Tests unitaires (CI)           |

## Structure

```
src/
├── context/        AuthContext (session, API), ThemeContext (dark/light)
├── components/     Composants reutilisables (Layout, Sidebar, TopBar, etc.)
├── pages/
│   ├── admin/      9 pages (Dashboard, Alertes, Stock, Users, etc.)
│   ├── tech/       6 pages (reutilise certaines pages admin)
│   ├── data/       4 pages (Dashboard, CompteRendu, Messagerie)
│   └── public/     Home, About, Contact, Login
├── css/            Styles par module
├── utils/          Fonctions utilitaires
├── test/           Tests vitest + testing-library
└── assets/         Images
```

## Technologies

- React 19 + Vite 7
- React Router 7
- Chart.js (graphiques)
- Socket.io-client (temps reel)
- Vitest + Testing Library (tests)
