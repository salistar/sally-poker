/**
 * @file poker-elo.ts
 * @description Système ELO Poker basé sur le profit cumulé en jetons virtuels.
 * Bonus pour Royal Flush et bluffs réussis.
 *
 * ⚠️ JETONS VIRTUELS UNIQUEMENT — règlementation Maroc CNDP / loi 09-08.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_ELO = 1000;
const REPLAY_PREFIX = 'replay:poker:';

const VARIANTS = ['holdem', 'omaha', 'omahaHiLo', 'fiveCardDraw', 'sevenCardStud', 'razz'];

interface PokerSession {
  variantKey: string;
  netProfit: number;
  biggestPot: number;
  handsPlayed: number;
  handsWon: number;
  royalFlushes: number;
  bluffsWon: number;
  durationMs: number;
  wonAt: number;
}

export interface VariantElo {
  variant: string;
  elo: number;
  wins: number;
  history: { date: number; elo: number; gain: number; reason: string }[];
}

async function listAllSessions(): Promise<PokerSession[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const replayKeys = keys.filter((k) => k.startsWith(REPLAY_PREFIX));
    const items = await AsyncStorage.multiGet(replayKeys);
    return items
      .map(([_, v]) => { try { return JSON.parse(v ?? ''); } catch { return null; } })
      .filter((x): x is PokerSession => !!x && typeof x.netProfit === 'number');
  } catch {
    return [];
  }
}

export async function computeEloByVariant(): Promise<Record<string, VariantElo>> {
  const sessions = await listAllSessions();
  sessions.sort((a, b) => a.wonAt - b.wonAt);
  const out: Record<string, VariantElo> = {};
  for (const v of VARIANTS) out[v] = { variant: v, elo: BASE_ELO, wins: 0, history: [] };

  for (const s of sessions) {
    const v = out[s.variantKey];
    if (!v) continue;
    // ELO basé sur profit normalisé (1 ELO par 100 chips), capé à ±50 par session
    let gain = Math.round(s.netProfit / 100);
    gain = Math.max(-50, Math.min(50, gain));
    let reason = `Net ${s.netProfit > 0 ? '+' : ''}${s.netProfit}`;
    if (s.royalFlushes > 0) { gain += 25 * s.royalFlushes; reason += ` +${s.royalFlushes}royal`; }
    if (s.bluffsWon >= 3) { gain += 10; reason += ' +bluff'; }
    v.elo += gain;
    if (s.netProfit > 0) v.wins++;
    v.history.push({ date: s.wonAt, elo: v.elo, gain, reason });
  }
  return out;
}

export async function computeGlobalElo(): Promise<number> {
  const eloMap = await computeEloByVariant();
  const played = Object.values(eloMap).filter((v) => v.wins > 0 || v.history.length > 0);
  if (played.length === 0) return BASE_ELO;
  return Math.round(played.reduce((a, b) => a + b.elo, 0) / played.length);
}

export function rankFromElo(elo: number): { tier: string; color: string; emoji: string } {
  if (elo >= 2500) return { tier: 'Diamond', color: '#06B6D4', emoji: '💎' };
  if (elo >= 2000) return { tier: 'Platinum', color: '#A855F7', emoji: '🏆' };
  if (elo >= 1500) return { tier: 'Gold', color: '#F59E0B', emoji: '🥇' };
  if (elo >= 1200) return { tier: 'Silver', color: '#94A3B8', emoji: '🥈' };
  return { tier: 'Bronze', color: '#92400E', emoji: '🥉' };
}
