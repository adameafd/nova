import { describe, it, expect } from 'vitest';
import {
  capitalize,
  formatLabel,
  getRoleLabel,
  getPriorityLabel,
  getStatutLabel,
  getCategoryLabel,
  sortAlertsByPriority,
  tolerantSearch,
} from '../utils/helpers';

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });
  it('handles empty/null', () => {
    expect(capitalize(null)).toBe('');
    expect(capitalize('')).toBe('');
  });
  it('handles accented characters', () => {
    expect(capitalize('énergie')).toBe('Énergie');
  });
});

describe('formatLabel', () => {
  it('replaces underscores and capitalizes', () => {
    expect(formatLabel('en_cours')).toBe('En cours');
  });
  it('capitalizes single word', () => {
    expect(formatLabel('panne')).toBe('Panne');
  });
  it('returns empty for null', () => {
    expect(formatLabel(null)).toBe('');
  });
});

describe('getRoleLabel', () => {
  it('returns correct label for admin', () => {
    expect(getRoleLabel('admin')).toBe('Administrateur');
  });
  it('returns correct label for technicien', () => {
    expect(getRoleLabel('technicien')).toBe('Technicien');
  });
  it('returns correct label for data', () => {
    expect(getRoleLabel('data')).toBe('Équipe Data');
  });
  it('falls back to formatLabel for unknown', () => {
    expect(getRoleLabel('manager')).toBe('Manager');
  });
});

describe('getPriorityLabel', () => {
  it('returns Panne for haute', () => {
    expect(getPriorityLabel('haute')).toBe('Panne');
  });
  it('returns Autre for moyenne', () => {
    expect(getPriorityLabel('moyenne')).toBe('Autre');
  });
  it('returns dash for unknown', () => {
    expect(getPriorityLabel(null)).toBe('-');
  });
});

describe('getStatutLabel', () => {
  it('returns Nouveau for nouveau', () => {
    expect(getStatutLabel('nouveau')).toBe('Nouveau');
  });
  it('returns En cours for en_cours', () => {
    expect(getStatutLabel('en_cours')).toBe('En cours');
  });
  it('returns Résolue for resolue', () => {
    expect(getStatutLabel('resolue')).toBe('Résolue');
  });
});

describe('getCategoryLabel', () => {
  it('returns Énergie for energie', () => {
    expect(getCategoryLabel('energie')).toBe('Énergie');
  });
  it('returns empty for null', () => {
    expect(getCategoryLabel(null)).toBe('');
  });
});

describe('sortAlertsByPriority', () => {
  it('sorts haute before moyenne before basse', () => {
    const alerts = [
      { priorite: 'basse', date_creation: '2025-01-01' },
      { priorite: 'haute', date_creation: '2025-01-01' },
      { priorite: 'moyenne', date_creation: '2025-01-01' },
    ];
    const sorted = sortAlertsByPriority(alerts);
    expect(sorted[0].priorite).toBe('haute');
    expect(sorted[1].priorite).toBe('moyenne');
    expect(sorted[2].priorite).toBe('basse');
  });

  it('sorts by date DESC within same priority', () => {
    const alerts = [
      { priorite: 'haute', date_creation: '2025-01-01' },
      { priorite: 'haute', date_creation: '2025-06-01' },
    ];
    const sorted = sortAlertsByPriority(alerts);
    expect(new Date(sorted[0].date_creation).getTime())
      .toBeGreaterThan(new Date(sorted[1].date_creation).getTime());
  });

  it('does not mutate original array', () => {
    const alerts = [
      { priorite: 'basse', date_creation: '2025-01-01' },
      { priorite: 'haute', date_creation: '2025-01-01' },
    ];
    sortAlertsByPriority(alerts);
    expect(alerts[0].priorite).toBe('basse');
  });
});

describe('tolerantSearch', () => {
  it('returns true when no query', () => {
    expect(tolerantSearch('', {})).toBe(true);
    expect(tolerantSearch(null, {})).toBe(true);
  });

  it('matches on text fields', () => {
    expect(tolerantSearch('dupont', { nom: 'Jean Dupont' })).toBe(true);
  });

  it('does not match unrelated query', () => {
    expect(tolerantSearch('xyz', { nom: 'Jean Dupont' })).toBe(false);
  });

  it('matches role synonyms', () => {
    expect(tolerantSearch('technicien', { role: 'tech' })).toBe(true);
  });
});
