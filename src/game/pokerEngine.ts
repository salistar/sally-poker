/**
 * PokerEngine - Simplified Texas Hold'em for 2-4 players
 * Uses Spanish 40-card deck: 4 suits x 10 values (1-7, 10-12)
 *
 * Rules:
 * - Each player gets 2 private cards
 * - 5 community cards revealed in 3 stages (flop 3, turn 1, river 1)
 * - Betting rounds between each stage
 * - Best 5-card hand wins
 * - Hand rankings: pair, two pair, three of a kind, straight, flush,
 *   full house, four of a kind, straight flush
 * - Start with 1000 chips each
 * - Small blind 10, big blind 20
 */

// ============================================================
// TYPES
// ============================================================

export type Suit = 'bastos' | 'copas' | 'espadas' | 'oros';
export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

export interface Card {
  suit: Suit;
  value: CardValue;
  id: string; // e.g. "07-copas"
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  chips: number;
  currentBet: number;
  folded: boolean;
  isBot: boolean;
  isAllIn: boolean;
}

export type GamePhase =
  | 'waiting'
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown'
  | 'game_over';

export type HandRank =
  | 'high_card'
  | 'pair'
  | 'two_pair'
  | 'three_of_a_kind'
  | 'straight'
  | 'flush'
  | 'full_house'
  | 'four_of_a_kind'
  | 'straight_flush';

export const HAND_RANK_VALUES: Record<HandRank, number> = {
  high_card: 0,
  pair: 1,
  two_pair: 2,
  three_of_a_kind: 3,
  straight: 4,
  flush: 5,
  full_house: 6,
  four_of_a_kind: 7,
  straight_flush: 8,
};

export interface HandEvaluation {
  rank: HandRank;
  rankValue: number;
  highCards: number[]; // for tie-breaking
  description: string;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  communityCards: Card[];
  deck: Card[];
  pot: number;
  currentBet: number;
  dealerIndex: number;
  currentPlayerIndex: number;
  roundNumber: number;
  winnerId: string | null;
  winnerHandDescription: string;
  lastAction: string;
  smallBlind: number;
  bigBlind: number;
}

export type GameAction =
  | { type: 'JOIN'; playerId: string; playerName: string; isBot?: boolean }
  | { type: 'START_GAME' }
  | { type: 'CHECK'; playerId: string }
  | { type: 'BET'; playerId: string; amount: number }
  | { type: 'CALL'; playerId: string }
  | { type: 'FOLD'; playerId: string }
  | { type: 'RAISE'; playerId: string; amount: number }
  | { type: 'NEXT_PHASE' }
  | { type: 'NEW_ROUND' }
  | { type: 'RESET' };

// ============================================================
// CONSTANTS
// ============================================================

export const SUITS: Suit[] = ['bastos', 'copas', 'espadas', 'oros'];
export const VALUES: CardValue[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
export const STARTING_CHIPS = 1000;
export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

// Straight-compatible values (mapped to sequential for straight detection)
// 1,2,3,4,5,6,7,10,11,12 => we treat 10,11,12 as 8,9,10 for straight purposes
const STRAIGHT_MAP: Record<CardValue, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 10: 8, 11: 9, 12: 10,
};

export const SUIT_NAMES: Record<Suit, string> = {
  bastos: 'Clubs',
  copas: 'Cups',
  espadas: 'Swords',
  oros: 'Coins',
};

export const VALUE_NAMES: Record<CardValue, string> = {
  1: 'As', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  10: 'Sota', 11: 'Caballo', 12: 'Rey',
};

// ============================================================
// DECK
// ============================================================

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      const valueStr = value.toString().padStart(2, '0');
      deck.push({ suit, value, id: `${valueStr}-${suit}` });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================================
// HAND EVALUATION
// ============================================================

function getValueCounts(cards: Card[]): Map<CardValue, number> {
  const counts = new Map<CardValue, number>();
  for (const c of cards) {
    counts.set(c.value, (counts.get(c.value) || 0) + 1);
  }
  return counts;
}

function getSuitCounts(cards: Card[]): Map<Suit, number> {
  const counts = new Map<Suit, number>();
  for (const c of cards) {
    counts.set(c.suit, (counts.get(c.suit) || 0) + 1);
  }
  return counts;
}

function isFlush(cards: Card[]): Suit | null {
  const suitCounts = getSuitCounts(cards);
  for (const [suit, count] of suitCounts) {
    if (count >= 5) return suit;
  }
  return null;
}

function findStraight(cards: Card[]): number | null {
  const mapped = [...new Set(cards.map((c) => STRAIGHT_MAP[c.value]))].sort(
    (a, b) => b - a
  );
  // Also check ace-high: ace(1) can be high (value 11 in straight map context)
  // In Spanish deck, ace is 1. Let's also add 11 to represent ace-high
  if (mapped.includes(1)) {
    mapped.unshift(11);
  }

  for (let i = 0; i <= mapped.length - 5; i++) {
    let consecutive = true;
    for (let j = 1; j < 5; j++) {
      if (mapped[i] - mapped[i + j] !== j) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) return mapped[i];
  }
  return null;
}

function getBestFiveCardHand(allCards: Card[]): Card[] {
  // Generate all 5-card combinations
  const combos: Card[][] = [];
  for (let i = 0; i < allCards.length; i++) {
    for (let j = i + 1; j < allCards.length; j++) {
      for (let k = j + 1; k < allCards.length; k++) {
        for (let l = k + 1; l < allCards.length; l++) {
          for (let m = l + 1; m < allCards.length; m++) {
            combos.push([allCards[i], allCards[j], allCards[k], allCards[l], allCards[m]]);
          }
        }
      }
    }
  }

  let bestEval: HandEvaluation | null = null;
  let bestCombo: Card[] = combos[0];

  for (const combo of combos) {
    const eval_ = evaluateFiveCards(combo);
    if (!bestEval || compareHands(eval_, bestEval) > 0) {
      bestEval = eval_;
      bestCombo = combo;
    }
  }

  return bestCombo;
}

function evaluateFiveCards(cards: Card[]): HandEvaluation {
  const valueCounts = getValueCounts(cards);
  const flushSuit = isFlush(cards);
  const straightHigh = findStraight(cards);

  const counts = Array.from(valueCounts.entries()).sort(
    (a, b) => b[1] - a[1] || STRAIGHT_MAP[b[0]] - STRAIGHT_MAP[a[0]]
  );

  const sortedValues = cards
    .map((c) => STRAIGHT_MAP[c.value])
    .sort((a, b) => b - a);

  // Straight flush
  if (flushSuit && straightHigh) {
    const flushCards = cards.filter((c) => c.suit === flushSuit);
    const flushStraight = findStraight(flushCards);
    if (flushStraight) {
      return {
        rank: 'straight_flush',
        rankValue: HAND_RANK_VALUES.straight_flush,
        highCards: [flushStraight],
        description: `Straight Flush, ${flushStraight} high`,
      };
    }
  }

  // Four of a kind
  if (counts[0][1] === 4) {
    const quadVal = STRAIGHT_MAP[counts[0][0]];
    const kicker = counts[1] ? STRAIGHT_MAP[counts[1][0]] : 0;
    return {
      rank: 'four_of_a_kind',
      rankValue: HAND_RANK_VALUES.four_of_a_kind,
      highCards: [quadVal, kicker],
      description: `Four of a Kind, ${VALUE_NAMES[counts[0][0]]}s`,
    };
  }

  // Full house
  if (counts[0][1] === 3 && counts[1] && counts[1][1] >= 2) {
    return {
      rank: 'full_house',
      rankValue: HAND_RANK_VALUES.full_house,
      highCards: [STRAIGHT_MAP[counts[0][0]], STRAIGHT_MAP[counts[1][0]]],
      description: `Full House, ${VALUE_NAMES[counts[0][0]]}s over ${VALUE_NAMES[counts[1][0]]}s`,
    };
  }

  // Flush
  if (flushSuit) {
    const flushCards = cards
      .filter((c) => c.suit === flushSuit)
      .map((c) => STRAIGHT_MAP[c.value])
      .sort((a, b) => b - a)
      .slice(0, 5);
    return {
      rank: 'flush',
      rankValue: HAND_RANK_VALUES.flush,
      highCards: flushCards,
      description: `Flush, ${SUIT_NAMES[flushSuit]}`,
    };
  }

  // Straight
  if (straightHigh) {
    return {
      rank: 'straight',
      rankValue: HAND_RANK_VALUES.straight,
      highCards: [straightHigh],
      description: `Straight, ${straightHigh} high`,
    };
  }

  // Three of a kind
  if (counts[0][1] === 3) {
    const kickers = counts
      .slice(1)
      .map((c) => STRAIGHT_MAP[c[0]])
      .sort((a, b) => b - a);
    return {
      rank: 'three_of_a_kind',
      rankValue: HAND_RANK_VALUES.three_of_a_kind,
      highCards: [STRAIGHT_MAP[counts[0][0]], ...kickers],
      description: `Three of a Kind, ${VALUE_NAMES[counts[0][0]]}s`,
    };
  }

  // Two pair
  if (counts[0][1] === 2 && counts[1] && counts[1][1] === 2) {
    const high = Math.max(STRAIGHT_MAP[counts[0][0]], STRAIGHT_MAP[counts[1][0]]);
    const low = Math.min(STRAIGHT_MAP[counts[0][0]], STRAIGHT_MAP[counts[1][0]]);
    const kicker = counts[2] ? STRAIGHT_MAP[counts[2][0]] : 0;
    return {
      rank: 'two_pair',
      rankValue: HAND_RANK_VALUES.two_pair,
      highCards: [high, low, kicker],
      description: `Two Pair, ${VALUE_NAMES[counts[0][0]]}s and ${VALUE_NAMES[counts[1][0]]}s`,
    };
  }

  // Pair
  if (counts[0][1] === 2) {
    const kickers = counts
      .slice(1)
      .map((c) => STRAIGHT_MAP[c[0]])
      .sort((a, b) => b - a);
    return {
      rank: 'pair',
      rankValue: HAND_RANK_VALUES.pair,
      highCards: [STRAIGHT_MAP[counts[0][0]], ...kickers],
      description: `Pair of ${VALUE_NAMES[counts[0][0]]}s`,
    };
  }

  // High card
  return {
    rank: 'high_card',
    rankValue: HAND_RANK_VALUES.high_card,
    highCards: sortedValues,
    description: `High Card`,
  };
}

function compareHands(a: HandEvaluation, b: HandEvaluation): number {
  if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
  for (let i = 0; i < Math.min(a.highCards.length, b.highCards.length); i++) {
    if (a.highCards[i] !== b.highCards[i]) return a.highCards[i] - b.highCards[i];
  }
  return 0;
}

export function evaluateHand(hand: Card[], community: Card[]): HandEvaluation {
  const allCards = [...hand, ...community];
  if (allCards.length < 5) {
    // Not enough cards yet, evaluate what we have
    return evaluateFiveCards(
      allCards.length >= 5 ? allCards.slice(0, 5) : [...allCards, ...Array(5 - allCards.length).fill(allCards[0])]
    );
  }
  const bestFive = getBestFiveCardHand(allCards);
  return evaluateFiveCards(bestFive);
}

// ============================================================
// GAME LOGIC
// ============================================================

function getActivePlayers(players: Player[]): Player[] {
  return players.filter((p) => !p.folded && p.chips > 0);
}

function getNonFoldedPlayers(players: Player[]): Player[] {
  return players.filter((p) => !p.folded);
}

function getNextActivePlayerIndex(currentIndex: number, players: Player[]): number {
  let next = (currentIndex + 1) % players.length;
  let attempts = 0;
  while ((players[next].folded || players[next].isAllIn) && attempts < players.length) {
    next = (next + 1) % players.length;
    attempts++;
  }
  return next;
}

function allBetsEqual(players: Player[]): boolean {
  const active = players.filter((p) => !p.folded && !p.isAllIn);
  if (active.length <= 1) return true;
  const targetBet = active[0].currentBet;
  return active.every((p) => p.currentBet === targetBet);
}

function hasEveryoneActed(state: GameState): boolean {
  const active = state.players.filter((p) => !p.folded && !p.isAllIn);
  return active.length <= 1 || allBetsEqual(state.players);
}

export function getWinner(state: GameState): { winnerId: string; description: string } | null {
  const nonFolded = getNonFoldedPlayers(state.players);
  if (nonFolded.length === 0) return null;
  if (nonFolded.length === 1) {
    return { winnerId: nonFolded[0].id, description: 'Last player standing' };
  }

  let bestPlayer = nonFolded[0];
  let bestEval = evaluateHand(bestPlayer.hand, state.communityCards);

  for (let i = 1; i < nonFolded.length; i++) {
    const eval_ = evaluateHand(nonFolded[i].hand, state.communityCards);
    if (compareHands(eval_, bestEval) > 0) {
      bestEval = eval_;
      bestPlayer = nonFolded[i];
    }
  }

  return { winnerId: bestPlayer.id, description: bestEval.description };
}

// ============================================================
// BOT AI
// ============================================================

export function botPlay(state: GameState): GameAction | null {
  const player = state.players[state.currentPlayerIndex];
  if (!player || !player.isBot || player.folded) return null;

  const handStrength = evaluateHand(player.hand, state.communityCards);
  const toCall = state.currentBet - player.currentBet;

  // Simple strategy based on hand strength
  if (handStrength.rankValue >= HAND_RANK_VALUES.three_of_a_kind) {
    // Strong hand: raise
    const raiseAmount = Math.min(state.bigBlind * 3, player.chips);
    if (raiseAmount > toCall) {
      return { type: 'RAISE', playerId: player.id, amount: raiseAmount };
    }
    return { type: 'CALL', playerId: player.id };
  }

  if (handStrength.rankValue >= HAND_RANK_VALUES.pair) {
    // Medium hand: call or small bet
    if (toCall === 0) {
      if (Math.random() > 0.5) {
        return { type: 'BET', playerId: player.id, amount: state.bigBlind };
      }
      return { type: 'CHECK', playerId: player.id };
    }
    if (toCall <= state.bigBlind * 4) {
      return { type: 'CALL', playerId: player.id };
    }
    return { type: 'FOLD', playerId: player.id };
  }

  // Weak hand
  if (toCall === 0) {
    return { type: 'CHECK', playerId: player.id };
  }
  if (toCall <= state.bigBlind && Math.random() > 0.4) {
    return { type: 'CALL', playerId: player.id };
  }
  // Occasional bluff
  if (Math.random() > 0.85) {
    return { type: 'CALL', playerId: player.id };
  }
  return { type: 'FOLD', playerId: player.id };
}

// ============================================================
// GAME STATE
// ============================================================

export function initGame(): GameState {
  return {
    phase: 'waiting',
    players: [],
    communityCards: [],
    deck: [],
    pot: 0,
    currentBet: 0,
    dealerIndex: 0,
    currentPlayerIndex: 0,
    roundNumber: 0,
    winnerId: null,
    winnerHandDescription: '',
    lastAction: '',
    smallBlind: SMALL_BLIND,
    bigBlind: BIG_BLIND,
  };
}

function dealPhase(state: GameState): GameState {
  const deck = shuffleDeck(createDeck());
  let deckIndex = 0;

  const players = state.players.map((p) => ({
    ...p,
    hand: [deck[deckIndex++], deck[deckIndex++]],
    currentBet: 0,
    folded: false,
    isAllIn: false,
  }));

  const remainingDeck = deck.slice(deckIndex);

  // Post blinds
  const sbIndex = (state.dealerIndex + 1) % players.length;
  const bbIndex = (state.dealerIndex + 2) % players.length;

  const sbAmount = Math.min(state.smallBlind, players[sbIndex].chips);
  const bbAmount = Math.min(state.bigBlind, players[bbIndex].chips);

  players[sbIndex] = {
    ...players[sbIndex],
    chips: players[sbIndex].chips - sbAmount,
    currentBet: sbAmount,
    isAllIn: players[sbIndex].chips - sbAmount === 0,
  };
  players[bbIndex] = {
    ...players[bbIndex],
    chips: players[bbIndex].chips - bbAmount,
    currentBet: bbAmount,
    isAllIn: players[bbIndex].chips - bbAmount === 0,
  };

  const firstToAct = (bbIndex + 1) % players.length;

  return {
    ...state,
    phase: 'preflop',
    players,
    deck: remainingDeck,
    communityCards: [],
    pot: sbAmount + bbAmount,
    currentBet: bbAmount,
    currentPlayerIndex: firstToAct,
    lastAction: 'Blinds posted',
  };
}

function advancePhase(state: GameState): GameState {
  const nonFolded = getNonFoldedPlayers(state.players);
  if (nonFolded.length <= 1) {
    const winner = getWinner(state);
    return {
      ...state,
      phase: 'showdown',
      winnerId: winner?.winnerId || null,
      winnerHandDescription: winner?.description || '',
    };
  }

  const resetPlayers = state.players.map((p) => ({ ...p, currentBet: 0 }));
  const firstActive = getNextActivePlayerIndex(state.dealerIndex, resetPlayers);

  switch (state.phase) {
    case 'preflop': {
      const flop = state.deck.slice(0, 3);
      return {
        ...state,
        phase: 'flop',
        players: resetPlayers,
        communityCards: flop,
        deck: state.deck.slice(3),
        currentBet: 0,
        currentPlayerIndex: firstActive,
        lastAction: 'Flop dealt',
      };
    }
    case 'flop': {
      const turnCard = state.deck[0];
      return {
        ...state,
        phase: 'turn',
        players: resetPlayers,
        communityCards: [...state.communityCards, turnCard],
        deck: state.deck.slice(1),
        currentBet: 0,
        currentPlayerIndex: firstActive,
        lastAction: 'Turn dealt',
      };
    }
    case 'turn': {
      const riverCard = state.deck[0];
      return {
        ...state,
        phase: 'river',
        players: resetPlayers,
        communityCards: [...state.communityCards, riverCard],
        deck: state.deck.slice(1),
        currentBet: 0,
        currentPlayerIndex: firstActive,
        lastAction: 'River dealt',
      };
    }
    case 'river': {
      const winner = getWinner(state);
      return {
        ...state,
        phase: 'showdown',
        winnerId: winner?.winnerId || null,
        winnerHandDescription: winner?.description || '',
      };
    }
    default:
      return state;
  }
}

// ============================================================
// REDUCER
// ============================================================

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'JOIN': {
      if (state.phase !== 'waiting' && state.phase !== 'showdown') return state;
      if (state.players.length >= MAX_PLAYERS) return state;
      if (state.players.find((p) => p.id === action.playerId)) return state;
      return {
        ...state,
        players: [
          ...state.players,
          {
            id: action.playerId,
            name: action.playerName,
            hand: [],
            chips: STARTING_CHIPS,
            currentBet: 0,
            folded: false,
            isBot: action.isBot || false,
            isAllIn: false,
          },
        ],
      };
    }

    case 'START_GAME': {
      if (state.players.length < MIN_PLAYERS) return state;
      return dealPhase({ ...state, roundNumber: state.roundNumber + 1, winnerId: null, winnerHandDescription: '' });
    }

    case 'CHECK': {
      if (state.phase === 'waiting' || state.phase === 'showdown' || state.phase === 'game_over') return state;
      const pi = state.players.findIndex((p) => p.id === action.playerId);
      if (pi !== state.currentPlayerIndex || state.players[pi].folded) return state;
      if (state.currentBet > state.players[pi].currentBet) return state; // Can't check, must call

      const nextIdx = getNextActivePlayerIndex(pi, state.players);
      const newState = {
        ...state,
        currentPlayerIndex: nextIdx,
        lastAction: `${state.players[pi].name} checks`,
      };

      // If we've gone around and all bets equal, advance phase
      if (nextIdx <= pi || allBetsEqual(state.players)) {
        return advancePhase(newState);
      }
      return newState;
    }

    case 'BET': {
      if (state.phase === 'waiting' || state.phase === 'showdown' || state.phase === 'game_over') return state;
      const pi = state.players.findIndex((p) => p.id === action.playerId);
      if (pi !== state.currentPlayerIndex || state.players[pi].folded) return state;
      if (state.currentBet > 0) return state; // Can't bet if there's already a bet

      const amount = Math.min(action.amount, state.players[pi].chips);
      const updatedPlayers = [...state.players];
      updatedPlayers[pi] = {
        ...updatedPlayers[pi],
        chips: updatedPlayers[pi].chips - amount,
        currentBet: amount,
        isAllIn: updatedPlayers[pi].chips - amount === 0,
      };

      return {
        ...state,
        players: updatedPlayers,
        pot: state.pot + amount,
        currentBet: amount,
        currentPlayerIndex: getNextActivePlayerIndex(pi, updatedPlayers),
        lastAction: `${updatedPlayers[pi].name} bets ${amount}`,
      };
    }

    case 'CALL': {
      if (state.phase === 'waiting' || state.phase === 'showdown' || state.phase === 'game_over') return state;
      const pi = state.players.findIndex((p) => p.id === action.playerId);
      if (pi !== state.currentPlayerIndex || state.players[pi].folded) return state;

      const toCall = Math.min(state.currentBet - state.players[pi].currentBet, state.players[pi].chips);
      const updatedPlayers = [...state.players];
      updatedPlayers[pi] = {
        ...updatedPlayers[pi],
        chips: updatedPlayers[pi].chips - toCall,
        currentBet: updatedPlayers[pi].currentBet + toCall,
        isAllIn: updatedPlayers[pi].chips - toCall === 0,
      };

      const nextIdx = getNextActivePlayerIndex(pi, updatedPlayers);
      const newState = {
        ...state,
        players: updatedPlayers,
        pot: state.pot + toCall,
        currentPlayerIndex: nextIdx,
        lastAction: `${updatedPlayers[pi].name} calls ${toCall}`,
      };

      if (allBetsEqual(updatedPlayers)) {
        return advancePhase(newState);
      }
      return newState;
    }

    case 'FOLD': {
      if (state.phase === 'waiting' || state.phase === 'showdown' || state.phase === 'game_over') return state;
      const pi = state.players.findIndex((p) => p.id === action.playerId);
      if (pi !== state.currentPlayerIndex) return state;

      const updatedPlayers = [...state.players];
      updatedPlayers[pi] = { ...updatedPlayers[pi], folded: true };

      const nonFolded = updatedPlayers.filter((p) => !p.folded);
      if (nonFolded.length === 1) {
        const winner = nonFolded[0];
        return {
          ...state,
          players: updatedPlayers,
          phase: 'showdown',
          winnerId: winner.id,
          winnerHandDescription: 'Last player standing',
          lastAction: `${updatedPlayers[pi].name} folds`,
        };
      }

      return {
        ...state,
        players: updatedPlayers,
        currentPlayerIndex: getNextActivePlayerIndex(pi, updatedPlayers),
        lastAction: `${updatedPlayers[pi].name} folds`,
      };
    }

    case 'RAISE': {
      if (state.phase === 'waiting' || state.phase === 'showdown' || state.phase === 'game_over') return state;
      const pi = state.players.findIndex((p) => p.id === action.playerId);
      if (pi !== state.currentPlayerIndex || state.players[pi].folded) return state;

      const totalBet = Math.min(action.amount, state.players[pi].chips + state.players[pi].currentBet);
      const additional = totalBet - state.players[pi].currentBet;

      const updatedPlayers = [...state.players];
      updatedPlayers[pi] = {
        ...updatedPlayers[pi],
        chips: updatedPlayers[pi].chips - additional,
        currentBet: totalBet,
        isAllIn: updatedPlayers[pi].chips - additional === 0,
      };

      return {
        ...state,
        players: updatedPlayers,
        pot: state.pot + additional,
        currentBet: totalBet,
        currentPlayerIndex: getNextActivePlayerIndex(pi, updatedPlayers),
        lastAction: `${updatedPlayers[pi].name} raises to ${totalBet}`,
      };
    }

    case 'NEXT_PHASE': {
      return advancePhase(state);
    }

    case 'NEW_ROUND': {
      if (state.phase !== 'showdown') return state;
      // Award pot to winner
      const players = state.players.map((p) => {
        if (p.id === state.winnerId) {
          return { ...p, chips: p.chips + state.pot, hand: [], currentBet: 0, folded: false, isAllIn: false };
        }
        return { ...p, hand: [], currentBet: 0, folded: false, isAllIn: false };
      });

      // Remove eliminated players
      const activePlayers = players.filter((p) => p.chips > 0);
      if (activePlayers.length <= 1) {
        return {
          ...state,
          phase: 'game_over',
          players,
          winnerId: activePlayers[0]?.id || state.winnerId,
        };
      }

      const newDealer = (state.dealerIndex + 1) % activePlayers.length;
      return dealPhase({
        ...state,
        players: activePlayers,
        dealerIndex: newDealer,
        roundNumber: state.roundNumber + 1,
        pot: 0,
        winnerId: null,
        winnerHandDescription: '',
      });
    }

    case 'RESET': {
      return initGame();
    }

    default:
      return state;
  }
}

// ============================================================
// HELPERS
// ============================================================

export function formatCard(card: Card): string {
  return `${VALUE_NAMES[card.value]} de ${SUIT_NAMES[card.suit]}`;
}

export function createBots(count: number): GameAction[] {
  const names = ['Carlos', 'Maria', 'Pedro'];
  return Array.from({ length: Math.min(count, names.length) }, (_, i) => ({
    type: 'JOIN' as const,
    playerId: `bot-${i + 1}`,
    playerName: names[i],
    isBot: true,
  }));
}

export function getCurrentPlayer(state: GameState): Player | null {
  return state.players[state.currentPlayerIndex] || null;
}

export function isPlayerTurn(state: GameState, playerId: string): boolean {
  return getCurrentPlayer(state)?.id === playerId;
}

/**
 * Détection de blocage Poker pour un joueur :
 *  - 'broke'     : tapis à 0 sans pouvoir continuer (cash game = défaite, tournoi = élimination)
 *  - 'allInAll'  : tous les joueurs actifs sont all-in → showdown forcé, plus aucune action.
 *  - 'lastMan'   : un seul joueur reste avec des jetons (tous les autres broke).
 *  - 'none'      : la partie progresse normalement.
 */
export type PokerStuck = 'broke' | 'allInAll' | 'lastMan' | 'none';

export function detectStuck(state: GameState, playerId: string): PokerStuck {
  if (state.phase === 'game_over') return 'none';
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return 'none';

  // 1) Le joueur principal est ruiné
  if (me.chips === 0 && !me.isAllIn) return 'broke';

  // 2) Tous les joueurs encore en main (non foldés) sont all-in
  const inHand = state.players.filter((p) => !p.folded);
  if (inHand.length >= 2 && inHand.every((p) => p.isAllIn || p.chips === 0)) {
    return 'allInAll';
  }

  // 3) Un seul joueur a encore des jetons (autres tous broke)
  const withChips = state.players.filter((p) => p.chips > 0);
  if (withChips.length === 1) return 'lastMan';

  return 'none';
}

/** Helper : nombre de joueurs encore actifs dans la partie (chips > 0). */
export function activePlayersCount(state: GameState): number {
  return state.players.filter((p) => p.chips > 0).length;
}
