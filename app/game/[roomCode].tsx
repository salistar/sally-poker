/**
 * @file game/[roomCode].tsx
 * @description Table Poker (Texas Hold'em) multijoueur — client MINCE du gateway
 *   /game AUTORITATIF (gameType 'poker'). Pendant RN de
 *   apps/web/app/poker/room/[code]. Bots + tours d'enchères gérés SERVEUR.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { io, Socket } from 'socket.io-client';
import AppHeader from '../../src/components/AppHeader';
import P2PCall from '../../src/components/P2PCall';
import Chat from '../../src/components/Chat';
import { useTheme } from '../../src/contexts/AppProviders';
import { logger } from '../../src/utils/logger';
import { APP_CONFIG } from '../../src/config/app.config';
import { SOCKET_URL } from '../../shared/api';
import * as api from '../../shared/api';

const log = logger.scoped('PokerRoom');
const GOLD = '#FCD34D';
const SUIT_SYM: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣', S: '♠', H: '♥', D: '♦', C: '♣', bastos: '♣', copas: '♥', espadas: '♠', oros: '♦' };

interface AnyCard { id?: string; suit?: string; value?: number | string; rank?: string; [k: string]: any }
interface SeatPlayer { id: string; name: string; isBot: boolean; chips?: number; bet?: number; folded?: boolean; allIn?: boolean; hand?: AnyCard[]; handCount?: number }
interface Snapshot {
  youId: string; phase: string; currentId: string | null;
  players: SeatPlayer[]; community: AnyCard[]; pot?: number; currentBet?: number;
  lastAction?: string; winner?: any; lastEvent?: string; log?: string[];
}

function cardText(c: AnyCard): string {
  if (!c) return '?';
  const sym = c.suit ? (SUIT_SYM[c.suit] || '') : '';
  const v = c.rank ?? c.value ?? c.id ?? '';
  return `${v}${sym}`;
}
function cardRed(c: AnyCard): boolean {
  const s = c?.suit;
  return s === 'hearts' || s === 'diamonds' || s === 'H' || s === 'D' || s === 'copas' || s === 'oros';
}

async function ensureToken(): Promise<string | null> {
  if (api.getAuthToken()) return api.getAuthToken();
  try { await api.createGuestSession(); } catch (e) { log.warn('guest failed', (e as any)?.message); }
  return api.getAuthToken();
}
async function refreshAuth(): Promise<string | null> {
  try { await api.refreshTokenAsync(); } catch { try { await api.createGuestSession(); } catch {} }
  return api.getAuthToken();
}

export default function PokerRoomScreen() {
  const { roomCode } = useLocalSearchParams<{ roomCode: string }>();
  const code = (roomCode || '').toString().toUpperCase();
  const router = useRouter();
  const { palette } = useTheme();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const tokenRef = useRef<string | null>(api.getAuthToken());

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    (async () => {
      await ensureToken();
      if (cancelled) return;
      tokenRef.current = api.getAuthToken();
      const s = io(`${SOCKET_URL}/game`, { transports: ['websocket'], timeout: 8000, auth: (cb: (d: any) => void) => cb({ token: tokenRef.current }) });
      socketRef.current = s;
      s.on('connect', () => { setConnected(true); s.emit('game:join', { roomCode: code, gameType: 'poker' }); });
      s.on('disconnect', () => setConnected(false));
      s.on('game:state', (snapshot: Snapshot) => setSnap(snapshot));
      s.on('game:error', (e: any) => log.warn('game:error', e?.message));
      s.on('connect_error', async (e: any) => { if (/token|auth|jwt|unauthor/i.test(e?.message || '')) { await refreshAuth(); tokenRef.current = api.getAuthToken(); } });
    })();
    return () => { cancelled = true; socketRef.current?.disconnect(); socketRef.current = null; };
  }, [code]);

  const me = snap?.players.find((p) => p.id === snap.youId) || null;
  const myTurn = !!(snap && me && snap.currentId === me.id);
  const myHand: AnyCard[] = me?.hand || [];
  const isOver = !!snap && (snap.phase === 'showdown' || snap.phase === 'game_over' || snap.phase === 'over' || !!snap.winner);

  const emitAction = useCallback((action: any) => { socketRef.current?.emit('game:action', { roomCode: code, action }); }, [code]);
  const act = useCallback((type: string, amount?: number) => { if (!myTurn) return; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); emitAction(amount != null ? { type, amount } : { type }); }, [myTurn, emitAction]);
  const rematch = useCallback(() => { socketRef.current?.emit('game:start', { roomCode: code }); }, [code]);
  useEffect(() => { if (isOver) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); }, [isOver]);

  const styles = createStyles(palette);
  const toCall = Math.max(0, (snap?.currentBet ?? 0) - (me?.bet ?? 0));
  const raiseAmt = (snap?.currentBet ?? 0) > 0 ? (snap!.currentBet! * 2) : 50;

  const Card = ({ c }: { c: AnyCard }) => (
    <View style={styles.card}><Text style={[styles.cardText, { color: cardRed(c) ? '#DC2626' : '#111827' }]}>{cardText(c)}</Text></View>
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={palette.bgGradient} style={StyleSheet.absoluteFill} />
      <AppHeader title={APP_CONFIG.name} subtitle={`Salon ${code || '—'} ${connected ? '· 🟢' : '· 🔌'}`} showBack onBack={() => setShowQuit(true)} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.commsRow}>
          <TouchableOpacity onPress={() => setVoiceOpen((v) => !v)} style={[styles.commsBtn, voiceOpen && styles.commsBtnActive]}><Ionicons name="videocam" size={16} color="#fff" /><Text style={styles.commsBtnText}>📹 Appel</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setChatOpen((v) => !v)} style={[styles.commsBtn, chatOpen && styles.commsBtnActive]}><Ionicons name="chatbubbles" size={16} color="#fff" /><Text style={styles.commsBtnText}>💬 Chat</Text></TouchableOpacity>
        </View>
        {voiceOpen && <View style={{ marginBottom: 12 }}><P2PCall compact roomCode={`poker-${code}`} displayName={me?.name ?? 'Joueur'} authToken={api.getAuthToken() ?? ''} onClose={() => setVoiceOpen(false)} /></View>}
        {chatOpen && <View style={{ marginBottom: 12 }}><Chat roomId={`poker-${code}`} token={api.getAuthToken()} onClose={() => setChatOpen(false)} /></View>}

        {snap && (
          <View style={styles.playersRow}>
            {snap.players.map((p) => {
              const active = snap.currentId === p.id;
              return (
                <View key={p.id} style={[styles.playerCard, active && styles.playerCardActive, p.folded && { opacity: 0.45 }]}>
                  <Text style={styles.playerName} numberOfLines={1}>{p.id === snap.youId ? '🧑 Vous' : (p.isBot ? '🤖 ' + p.name : '🧑 ' + p.name)}{p.folded ? ' · fold' : ''}{p.allIn ? ' · all-in' : ''}</Text>
                  <Text style={styles.playerScore}>{p.chips ?? 0}<Text style={styles.playerScoreSub}> 🪙{p.bet ? ` · mise ${p.bet}` : ''}</Text></Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.table}>
          {!snap && <View style={styles.tableEmpty}><Text style={styles.tableEmptyText}>{connected ? 'Distribution…' : 'Connexion à la room…'}</Text></View>}
          {snap && (
            <>
              <Text style={styles.tableLabel}>Pot : {snap.pot ?? 0} 🪙 · Mise {snap.currentBet ?? 0}</Text>
              <View style={styles.tableRow}>
                {(snap.community || []).length === 0 && <Text style={styles.waitText}>Cartes communes à venir</Text>}
                {(snap.community || []).map((c, i) => <Card key={i} c={c} />)}
              </View>
            </>
          )}
        </View>

        {snap && <Text style={[styles.eventText, { color: palette.textSecondary }]}>{isOver ? (snap.lastEvent || 'Abattage') : myTurn ? 'À toi de parler.' : (snap.lastEvent || '')}</Text>}

        {snap && (
          <View style={{ marginTop: 8 }}>
            <Text style={[styles.handTitle, { color: palette.text }]}>Vos cartes</Text>
            <View style={styles.tableRow2}>
              {myHand.map((c, i) => <Card key={c.id ?? i} c={c} />)}
              {myHand.length === 0 && <Text style={{ color: palette.textSecondary, padding: 12 }}>—</Text>}
            </View>
            {myTurn && (
              <View style={styles.actRow}>
                <TouchableOpacity onPress={() => act('FOLD')} style={[styles.actBtn, { backgroundColor: '#EF4444' }]}><Text style={styles.actText}>Se coucher</Text></TouchableOpacity>
                {toCall === 0
                  ? <TouchableOpacity onPress={() => act('CHECK')} style={[styles.actBtn, { backgroundColor: '#3B82F6' }]}><Text style={styles.actText}>Checker</Text></TouchableOpacity>
                  : <TouchableOpacity onPress={() => act('CALL')} style={[styles.actBtn, { backgroundColor: '#3B82F6' }]}><Text style={styles.actText}>Suivre {toCall}</Text></TouchableOpacity>}
                <TouchableOpacity onPress={() => act('RAISE', raiseAmt)} style={[styles.actBtn, { backgroundColor: '#16A34A' }]}><Text style={styles.actText}>Relancer {raiseAmt}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => act('ALLIN')} style={[styles.actBtn, { backgroundColor: '#7C3AED' }]}><Text style={styles.actText}>All-in</Text></TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {snap && (snap.log || []).length > 0 && (
          <View style={styles.logBox}>{(snap.log || []).slice(0, 6).map((l, i) => <Text key={i} style={[styles.logLine, { color: i === 0 ? palette.text : palette.textSecondary }]} numberOfLines={1}>{l}</Text>)}</View>
        )}
      </ScrollView>

      <Modal visible={isOver} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <LinearGradient colors={['#0A0A1A', palette.card]} style={[styles.modalCard, { borderColor: GOLD }]}>
            <Text style={styles.modalEmoji}>🏆</Text>
            <Text style={styles.modalTitle}>{snap?.lastEvent || 'Fin de la main'}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity onPress={rematch} style={[styles.modalBtn, { backgroundColor: APP_CONFIG.primary }]}><Ionicons name="refresh" size={18} color="#fff" /><Text style={styles.modalBtnText}>Nouvelle main</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => router.back()} style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}><Text style={styles.modalBtnText}>Quitter</Text></TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>
      <Modal visible={showQuit} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={styles.modalTitle}>Quitter la partie ?</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
              <TouchableOpacity onPress={() => setShowQuit(false)} style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}><Text style={styles.modalBtnText}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowQuit(false); router.back(); }} style={[styles.modalBtn, { backgroundColor: '#EF4444' }]}><Text style={styles.modalBtnText}>Quitter</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(palette: ReturnType<typeof useTheme>['palette']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.bg },
    body: { padding: 14, paddingBottom: 40 },
    commsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    commsBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: APP_CONFIG.primary },
    commsBtnActive: { backgroundColor: '#7C3AED' },
    commsBtnText: { color: '#fff', fontFamily: 'Inter-Bold', fontSize: 14 },
    playersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    playerCard: { flex: 1, minWidth: 100, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 10 },
    playerCardActive: { backgroundColor: 'rgba(252,211,77,0.16)', borderColor: GOLD },
    playerName: { color: '#fff', fontSize: 11, fontFamily: 'Inter-Bold' },
    playerScore: { color: GOLD, fontFamily: 'Inter-Black', fontSize: 18, marginTop: 2 },
    playerScoreSub: { color: palette.textSecondary, fontSize: 10, fontFamily: 'Inter-SemiBold' },
    table: { position: 'relative', minHeight: 130, borderRadius: 24, borderWidth: 5, borderColor: '#5b3a1a', backgroundColor: '#0E5A36', padding: 14, overflow: 'hidden', marginBottom: 12 },
    tableEmpty: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    tableEmptyText: { color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter-Bold' },
    tableLabel: { color: GOLD, fontSize: 13, fontFamily: 'Inter-Bold', marginBottom: 8 },
    tableRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, minHeight: 64, alignItems: 'center', justifyContent: 'center' },
    tableRow2: { flexDirection: 'row', gap: 6, minHeight: 64, alignItems: 'center' },
    waitText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontStyle: 'italic' },
    card: { minWidth: 42, height: 60, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginHorizontal: 3, borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)' },
    cardText: { fontSize: 18, fontFamily: 'Inter-Black' },
    eventText: { fontSize: 13, fontFamily: 'Inter-SemiBold', marginBottom: 4, minHeight: 18 },
    handTitle: { fontSize: 14, fontFamily: 'Inter-Bold', marginBottom: 8 },
    actRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    actBtn: { flexGrow: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10 },
    actText: { color: '#fff', fontFamily: 'Inter-Bold', fontSize: 13 },
    logBox: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, marginTop: 14 },
    logLine: { fontSize: 12, fontFamily: 'Inter-Regular', paddingVertical: 1 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
    modalCard: { padding: 26, borderRadius: 20, alignItems: 'center', borderWidth: 2, minWidth: 290, maxWidth: '85%' },
    modalEmoji: { fontSize: 52, marginBottom: 6 },
    modalTitle: { color: '#fff', fontSize: 20, fontFamily: 'Inter-Black', letterSpacing: 0.3, textAlign: 'center' },
    modalBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    modalBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter-Bold' },
  });
}
