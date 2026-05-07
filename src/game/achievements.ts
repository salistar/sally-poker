/**
 * @file achievements.ts
 * @description Achievements Poker — basés sur les sessions jouées.
 *
 * ⚠️ JETONS VIRTUELS UNIQUEMENT — règlementation Maroc.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'achievements:unlocked';
const REPLAY_PREFIX = 'replay:poker:';

export interface PokerSession {
  id: string;
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

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  check: (sessions: PokerSession[]) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-hand', title: 'Première main', description: 'Joue ta première main.', icon: 'trophy', rarity: 'common', check: (rs) => rs.some((r) => r.handsPlayed >= 1) },
  { id: 'first-win', title: 'Premier pot', description: 'Remporte ton premier pot.', icon: 'cash', rarity: 'common', check: (rs) => rs.some((r) => r.handsWon >= 1) },
  { id: 'big-pot', title: 'Gros pot', description: 'Remporte un pot de 1000+ jetons.', icon: 'flame', rarity: 'rare', check: (rs) => rs.some((r) => r.biggestPot >= 1000) },
  { id: 'huge-pot', title: 'Pot énorme', description: 'Remporte un pot de 10 000+ jetons.', icon: 'flash', rarity: 'epic', check: (rs) => rs.some((r) => r.biggestPot >= 10000) },
  { id: 'royal-flush', title: 'Quinte Flush Royale', description: 'Touche une Royal Flush — 1 sur 649 740 !', icon: 'sparkles', rarity: 'legendary', check: (rs) => rs.some((r) => r.royalFlushes >= 1) },
  { id: 'bluff-master', title: 'Maître du bluff', description: 'Réussi 10 bluffs sur une session.', icon: 'eye-off', rarity: 'epic', check: (rs) => rs.some((r) => r.bluffsWon >= 10) },
  { id: 'profit-50k', title: 'Bankroll 50k', description: 'Profit cumulé de 50 000 jetons virtuels.', icon: 'wallet', rarity: 'rare', check: (rs) => rs.reduce((a, r) => a + r.netProfit, 0) >= 50000 },
  { id: 'win-100-hands', title: 'Centurion', description: 'Gagne 100 mains au total.', icon: 'medal', rarity: 'rare', check: (rs) => rs.reduce((a, r) => a + r.handsWon, 0) >= 100 },
  { id: 'all-variants', title: 'Pro polyvalent', description: 'Joue dans 4 variantes différentes.', icon: 'apps', rarity: 'epic', check: (rs) => new Set(rs.map((r) => r.variantKey)).size >= 4 },
];

export interface UnlockedAchievement extends Achievement { unlockedAt: number; }

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

export async function evaluateAchievements(): Promise<{ all: Achievement[]; unlocked: Record<string, number>; newlyUnlocked: Achievement[] }> {
  const sessions = await listAllSessions();
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const unlocked: Record<string, number> = raw ? JSON.parse(raw) : {};
  const newlyUnlocked: Achievement[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (unlocked[ach.id]) continue;
    if (ach.check(sessions)) { unlocked[ach.id] = Date.now(); newlyUnlocked.push(ach); }
  }
  if (newlyUnlocked.length > 0) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked));
  return { all: ACHIEVEMENTS, unlocked, newlyUnlocked };
}

export async function getUnlockedAchievements(): Promise<Record<string, number>> {
  try { const raw = await AsyncStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}
