// ── Synonymes de rôles ──
const ROLE_SYNONYMS = {
  tech: ['technicien', 'technician', 'tech'],
  technicien: ['technicien', 'technician', 'tech'],
  admin: ['administrateur', 'administrator', 'admin'],
  data: ['équipe data', 'equipe data', 'data analyst', 'data'],
};

// Libellés affichés pour chaque rôle
const ROLE_LABELS = {
  admin: 'Administrateur',
  tech: 'Technicien',
  technicien: 'Technicien',
  data: 'Équipe Data',
};

/**
 * Capitalize la première lettre d'une chaîne.
 * Gère les accents (é, è, à, ç…) et les null/undefined.
 */
export function capitalize(str) {
  if (!str) return '';
  const s = String(str).trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Formate un libellé pour l'affichage UI :
 * 1. Remplace les underscores par des espaces
 * 2. Met la première lettre en majuscule (une seule fois, pas chaque mot)
 * 3. Garde les accents intacts
 * 4. Retourne '' si null/undefined
 *
 * Exemples :
 *   "en_cours"          → "En cours"
 *   "panne"             → "Panne"
 *   "proposition faible" → "Proposition faible"
 *   "énergie"           → "Énergie"
 *   "équipe data"       → "Équipe data"
 *   null                → ""
 */
export function formatLabel(str) {
  if (str == null) return '';
  const s = String(str).trim();
  if (!s) return '';
  const spaced = s.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Retourne le libellé affiché pour un rôle
 */
export function getRoleLabel(role) {
  if (!role) return '';
  return ROLE_LABELS[role] || formatLabel(role);
}

/**
 * Recherche tolérante avec synonymes de rôles.
 * Retourne true si `query` matche l'un des champs fournis (nom, email, role...).
 */
export function tolerantSearch(query, fields = {}) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;

  // Recherche directe sur les champs texte
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'role') continue; // traité séparément
    if (value && String(value).toLowerCase().includes(q)) return true;
  }

  // Recherche sur le rôle avec synonymes
  if (fields.role) {
    const role = fields.role.toLowerCase();
    // Match direct sur le rôle
    if (role.includes(q)) return true;
    // Match sur le libellé affiché
    const label = (ROLE_LABELS[role] || '').toLowerCase();
    if (label.includes(q)) return true;
    // Match via synonymes
    const synonyms = ROLE_SYNONYMS[role] || [];
    if (synonyms.some((s) => s.includes(q))) return true;
    // Recherche inversée : si la query est un synonyme, vérifier si ça matche le rôle
    for (const [roleKey, syns] of Object.entries(ROLE_SYNONYMS)) {
      if (syns.some((s) => s.includes(q)) && (role === roleKey || syns.includes(role))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Labels de priorité pour les alertes
 */
export const PRIORITY_LABELS = {
  haute: 'Panne',
  moyenne: 'Autre',
  basse: 'Proposition faible',
};

export function getPriorityLabel(p) {
  return PRIORITY_LABELS[p] || formatLabel(p) || '-';
}

/**
 * Ordre de tri des priorités (plus haut = plus urgent)
 */
const PRIORITY_ORDER = { haute: 3, moyenne: 2, basse: 1 };

/**
 * Trie les alertes par priorité (haute > moyenne > basse) puis par date (plus récent d'abord)
 */
export function sortAlertsByPriority(alerts) {
  return [...alerts].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priorite] || 0;
    const pb = PRIORITY_ORDER[b.priorite] || 0;
    if (pb !== pa) return pb - pa;
    return new Date(b.date_creation || 0) - new Date(a.date_creation || 0);
  });
}

/**
 * Labels de sujet d'alerte
 */
export function getSujetLabel(s) {
  const map = { panne: 'Panne', proposition: 'Proposition', autre: 'Autre' };
  return map[s] || formatLabel(s) || '-';
}

/**
 * Labels de statut
 */
export function getStatutLabel(s) {
  const map = {
    nouveau: 'Nouveau',
    en_cours: 'En cours',
    resolue: 'Résolue',
    en_attente: 'En attente',
    annulee: 'Annulée',
    terminee: 'Terminée',
  };
  return map[s] || formatLabel(s) || '-';
}

/**
 * Labels de catégorie (stock)
 */
const CATEGORY_LABELS = {
  energie: 'Énergie',
  capteurs: 'Capteurs',
  iot: 'IoT',
  autre: 'Autre',
};

export function getCategoryLabel(cat) {
  if (!cat) return '';
  return CATEGORY_LABELS[cat] || formatLabel(cat);
}
