/**
 * @file variants.ts — Catalogue de toutes les variantes Poker.
 * Multi >1 joueur : socket+STUN/TURN+Jitsi via /room/create. Solo vs-ai sans socket.
 */

export type VariantKey =
  | 'texas-holdem-nlh' | 'texas-holdem-pot-limit' | 'texas-holdem-fixed-limit'
  | 'omaha' | 'omaha-hi-lo'
  | 'stud-7-card' | 'razz' | 'short-deck-6plus' | 'chinese-poker-ofc'
  | 'sit-n-go-9' | 'mtt-tournament'
  | 'cash-game-1-2' | 'cash-game-2-5'
  | 'heads-up' | 'vs-ai';

export interface Variant {
  key: VariantKey;
  engine: 'holdem' | 'omaha' | 'stud' | 'razz' | 'shortdeck' | 'ofc' | 'vs-ai';
  emoji: string;
  name: string;
  shortDesc: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  winRate: string;
  duration: string;
  cards: number;
  rules: { title: string; body: string }[];
  available: boolean;
  options?: {
    players?: number;             // 2-10
    limit?: 'no-limit' | 'pot-limit' | 'fixed' | 'spread';
    blinds?: { sb: number; bb: number };
    format?: 'cash' | 'sng' | 'mtt';
    deckSize?: 36 | 52;
    holeCards?: 2 | 4 | 13;
    splitPot?: boolean;
    multi?: boolean;
  };
}

export const VARIANTS: Variant[] = [
  {
    key: 'texas-holdem-nlh', engine: 'holdem', emoji: '♠️', name: 'Texas Hold\'em No Limit',
    shortDesc: 'Le poker le plus joué au monde — NLH 2-10 joueurs.',
    difficulty: 4, winRate: 'Variable', duration: '~1h+', cards: 52, available: true,
    options: { players: 9, limit: 'no-limit', deckSize: 52, holeCards: 2, format: 'cash', multi: true },
    rules: [
      { title: 'Vue d\'ensemble', body: 'Variante de poker la plus populaire. 2 cartes privées + 5 communes. Combinaison de 5 cartes parmi les 7.' },
      { title: 'Hiérarchie des mains', body: 'Quinte Flush Royale > Quinte Flush > Carré > Full > Couleur > Quinte > Brelan > 2 Paires > Paire > Carte Haute.' },
      { title: 'Blindes', body: 'Petite Blinde (SB) à gauche du bouton, Grosse Blinde (BB) à gauche de la SB. Mises forcées avant la donne.' },
      { title: 'Pre-flop', body: 'Chaque joueur reçoit 2 cartes. Action commence à gauche de la BB (UTG). Choix : Fold/Call/Raise.' },
      { title: 'Flop', body: '3 cartes communes au centre (1 carte brûlée avant). 2e tour d\'enchères.' },
      { title: 'Turn', body: '4e carte commune ajoutée. 3e tour d\'enchères.' },
      { title: 'River', body: '5e et dernière carte commune. 4e tour d\'enchères.' },
      { title: 'Showdown', body: 'Si 2+ joueurs restent : meilleure main de 5 cartes parmi les 7 gagne le pot.' },
      { title: 'Actions', body: 'Fold (se coucher), Check (parole), Call (suivre), Bet/Raise (miser/relancer), All-in (tapis).' },
      { title: 'No Limit', body: 'Aucune limite max — tu peux all-in à tout moment.' },
      { title: 'Pot odds', body: 'Ratio mise/pot. Si > tes chances de gagner → call rentable.' },
      { title: 'Position', body: 'Late position (bouton/cutoff) = avantage : tu vois les actions adverses avant.' },
    ],
  },
  {
    key: 'texas-holdem-pot-limit', engine: 'holdem', emoji: '🎯', name: 'Texas Hold\'em Pot Limit',
    shortDesc: 'Mise max = taille du pot. Plus contenu que NLH.',
    difficulty: 4, winRate: 'Variable', duration: '~1h', cards: 52, available: true,
    options: { players: 9, limit: 'pot-limit', deckSize: 52, holeCards: 2, format: 'cash', multi: true },
    rules: [
      { title: 'Différence', body: 'Mise max = taille actuelle du pot. Pas de all-in arbitraire.' },
      { title: 'Stratégie', body: 'Plus mathématique, moins de bluffs spectaculaires.' },
    ],
  },
  {
    key: 'texas-holdem-fixed-limit', engine: 'holdem', emoji: '📏', name: 'Texas Hold\'em Fixed Limit',
    shortDesc: 'Mises et relances de taille fixe.',
    difficulty: 3, winRate: 'Variable', duration: '~1h', cards: 52, available: true,
    options: { players: 9, limit: 'fixed', deckSize: 52, holeCards: 2, format: 'cash', multi: true },
    rules: [{ title: 'Différence', body: 'Mises et relances de taille fixe par tour. Plus stable, moins agressif.' }],
  },
  {
    key: 'omaha', engine: 'omaha', emoji: '🌽', name: 'Omaha',
    shortDesc: '4 cartes privées, doit utiliser exactement 2 + 3 du board.',
    difficulty: 4, winRate: 'Variable', duration: '~1h', cards: 52, available: true,
    options: { players: 9, limit: 'pot-limit', deckSize: 52, holeCards: 4, format: 'cash', multi: true },
    rules: [
      { title: 'Différence majeure', body: '4 hole cards (au lieu de 2). Mais tu DOIS utiliser EXACTEMENT 2 hole cards + 3 cartes du board.' },
      { title: 'Plus d\'action', body: 'Beaucoup plus de combinaisons possibles → mains plus fortes en moyenne.' },
      { title: 'Limit', body: 'Souvent joué en Pot Limit (PLO).' },
    ],
  },
  {
    key: 'omaha-hi-lo', engine: 'omaha', emoji: '⚖️', name: 'Omaha Hi-Lo',
    shortDesc: 'Pot partagé entre meilleure main haute et meilleure main basse.',
    difficulty: 5, winRate: 'Variable', duration: '~1h15', cards: 52, available: true,
    options: { players: 9, limit: 'pot-limit', deckSize: 52, holeCards: 4, format: 'cash', splitPot: true, multi: true },
    rules: [
      { title: 'Mode split', body: 'Le pot est PARTAGÉ entre la meilleure main "haute" et la meilleure main "basse" (8 ou moins, sans paire).' },
      { title: 'Stratégie', body: 'Vise le "scoop" (gagner les deux moitiés simultanément).' },
    ],
  },
  {
    key: 'stud-7-card', engine: 'stud', emoji: '🃏', name: 'Stud 7 cartes',
    shortDesc: 'Pas de cartes communes. 7 cartes par joueur (3 cachées, 4 visibles).',
    difficulty: 4, winRate: 'Variable', duration: '~1h15', cards: 52, available: true,
    options: { players: 8, limit: 'fixed', deckSize: 52, format: 'cash', multi: true },
    rules: [
      { title: 'Différence', body: 'Pas de cartes communes au centre. Chaque joueur reçoit 7 cartes (3 cachées, 4 visibles, mélangées par tours).' },
      { title: 'Variante historique', body: 'Jouée avant l\'ère Hold\'em. Demande mémoire (cartes visibles adverses).' },
    ],
  },
  {
    key: 'razz', engine: 'razz', emoji: '🎴', name: 'Razz',
    shortDesc: 'Stud 7 où la PLUS BASSE main gagne (A-2-3-4-5 = nut).',
    difficulty: 5, winRate: 'Variable', duration: '~1h15', cards: 52, available: true,
    options: { players: 8, limit: 'fixed', deckSize: 52, format: 'cash', multi: true },
    rules: [
      { title: 'Inversion', body: 'Variante du Stud 7 où la PLUS BASSE main gagne (As bas).' },
      { title: 'Meilleure main', body: 'A-2-3-4-5 ("the wheel"). Pas de quintes/couleurs comptées.' },
    ],
  },
  {
    key: 'short-deck-6plus', engine: 'shortdeck', emoji: '🔢', name: 'Short Deck (6+)',
    shortDesc: 'Jeu de 36 cartes (du 6 à l\'As). Plus d\'action, math change.',
    difficulty: 4, winRate: 'Variable', duration: '~1h', cards: 36, available: true,
    options: { players: 9, limit: 'no-limit', deckSize: 36, holeCards: 2, format: 'cash', multi: true },
    rules: [
      { title: 'Cartes', body: '36 cartes (6, 7, 8, 9, 10, V, D, R, A × 4 couleurs).' },
      { title: 'Différences math', body: 'QUINTES battent FLUSHES (math change). Plus de mains fortes.' },
      { title: 'Niveau', body: 'Très populaire en high-stakes Asie.' },
    ],
  },
  {
    key: 'chinese-poker-ofc', engine: 'ofc', emoji: '🀄', name: 'Chinese Poker / OFC',
    shortDesc: '13 cartes en 3 lignes (3+5+5). Pas de mises, juste combinaisons.',
    difficulty: 4, winRate: 'Variable', duration: '~30 min', cards: 52, available: true,
    options: { players: 4, deckSize: 52, holeCards: 13, format: 'cash', multi: true },
    rules: [
      { title: 'Mode unique', body: '13 cartes par joueur à organiser en 3 lignes : top (3), middle (5), bottom (5).' },
      { title: 'Hiérarchie ascendante', body: 'Top doit être ≤ Middle ≤ Bottom (sinon foul = pénalité).' },
      { title: 'Pas de mises', body: 'Pas de Fold/Raise. Comparaison directe des combinaisons à la fin.' },
    ],
  },
  {
    key: 'sit-n-go-9', engine: 'holdem', emoji: '⏱️', name: 'Sit & Go 9 joueurs',
    shortDesc: 'Mini-tournoi à table unique. Démarre dès table pleine.',
    difficulty: 4, winRate: 'Variable', duration: '~45 min', cards: 52, available: true,
    options: { players: 9, limit: 'no-limit', deckSize: 52, holeCards: 2, format: 'sng', multi: true },
    rules: [
      { title: 'Format SNG', body: 'Mini-tournoi à 1 table. Démarre dès que 9 joueurs inscrits.' },
      { title: 'Prix', body: 'Top 3 généralement payés (50/30/20%).' },
      { title: 'Blindes', body: 'Augmentent par paliers (toutes les 10-15 min).' },
    ],
  },
  {
    key: 'mtt-tournament', engine: 'holdem', emoji: '🏆', name: 'MTT — Multi-Table Tournament',
    shortDesc: 'Tournoi multi-tables, élimination, top % payés.',
    difficulty: 5, winRate: 'Variable', duration: '~3h+', cards: 52, available: true,
    options: { players: 100, limit: 'no-limit', deckSize: 52, holeCards: 2, format: 'mtt', multi: true },
    rules: [
      { title: 'Format MTT', body: 'Tournoi sur plusieurs tables (ex: 100+ joueurs). Élimination progressive.' },
      { title: 'Bubble', body: 'Position juste avant les places payées (très tendue).' },
      { title: 'Final Table', body: '9-10 derniers joueurs, gros prix.' },
      { title: 'ICM', body: 'Independent Chip Model : valoriser les jetons selon les places restantes.' },
    ],
  },
  {
    key: 'cash-game-1-2', engine: 'holdem', emoji: '💵', name: 'Cash Game 1$/2$',
    shortDesc: 'Cash game blindes 1$/2$. Stable.',
    difficulty: 3, winRate: 'Variable', duration: 'Libre', cards: 52, available: true,
    options: { players: 9, limit: 'no-limit', blinds: { sb: 1, bb: 2 }, format: 'cash', deckSize: 52, holeCards: 2, multi: true },
    rules: [{ title: 'Cash game', body: '1 jeton = 1 €. Blindes fixes 1$/2$. Quitter à tout moment avec son tapis.' }],
  },
  {
    key: 'cash-game-2-5', engine: 'holdem', emoji: '💸', name: 'Cash Game 2$/5$',
    shortDesc: 'Niveau intermédiaire 2$/5$.',
    difficulty: 4, winRate: 'Variable', duration: 'Libre', cards: 52, available: true,
    options: { players: 9, limit: 'no-limit', blinds: { sb: 2, bb: 5 }, format: 'cash', deckSize: 52, holeCards: 2, multi: true },
    rules: [{ title: 'Niveau intermédiaire', body: 'Blindes 2$/5$. Joueurs plus aguerris.' }],
  },
  {
    key: 'heads-up', engine: 'holdem', emoji: '⚔️', name: 'Heads-Up (1v1)',
    shortDesc: 'Duel 1v1, souvent en finale de tournoi.',
    difficulty: 5, winRate: '~50%', duration: '~30 min', cards: 52, available: true,
    options: { players: 2, limit: 'no-limit', deckSize: 52, holeCards: 2, format: 'cash', multi: true },
    rules: [
      { title: 'Mode', body: 'Duel 1v1.' },
      { title: 'Spécificité', body: 'Le bouton est SB. Action pre-flop : SB joue en premier, BB en dernier.' },
      { title: 'Stratégie', body: 'Plus large que 9-handed : tu joues 70%+ des mains.' },
    ],
  },
  {
    key: 'vs-ai', engine: 'vs-ai', emoji: '🤖', name: 'Solo vs IA',
    shortDesc: 'Solo contre 1-9 IA, NLH cash game.',
    difficulty: 3, winRate: 'Variable', duration: 'Libre', cards: 52, available: true,
    options: { players: 6, limit: 'no-limit', deckSize: 52, holeCards: 2, format: 'cash' },
    rules: [
      { title: 'Mode', body: 'Solo (1v1 à 1v9) sans socket.' },
      { title: 'IA', body: 'Niveau adapté : Fish (random), Reg (TAG), Pro (GTO-approx).' },
      { title: 'Hors-ligne', body: 'Pas de réseau, idéal pour s\'entraîner.' },
    ],
  },
];

export const AVAILABLE_VARIANTS = VARIANTS.filter((v) => v.available);
export function findVariant(key: string): Variant | undefined {
  return VARIANTS.find((v) => v.key === key);
}
