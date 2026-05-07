/**
 * @file game/local.tsx
 * @description Local Poker game screen - Simplified Texas Hold'em vs bots
 * @project SallyCards - Poker
 */

import React, { useReducer, useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  Alert,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  gameReducer,
  initGame,
  botPlay,
  getCurrentPlayer,
  isPlayerTurn,
  detectStuck,
  type GameState,
  type GameAction,
  type PokerStuck,
} from '../../src/game/pokerEngine';
import { getCardImage, getCardBackImage } from '../../src/game/cardAssets';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = 60;
const CARD_HEIGHT = 90;
const COMMUNITY_CARD_WIDTH = 55;
const COMMUNITY_CARD_HEIGHT = 82;

const PLAYER_ID = 'player-1';
const BOT_DELAY = 1200;

export default function PokerLocalGame() {
  const router = useRouter();
  const { t } = useTranslation();
  const [stuckReason, setStuckReason] = useState<PokerStuck | null>(null);
  const [state, dispatch] = useReducer(gameReducer, null, () => {
    const initial = initGame();
    let s = gameReducer(initial, {
      type: 'JOIN',
      playerId: PLAYER_ID,
      playerName: 'You',
    });
    s = gameReducer(s, {
      type: 'JOIN',
      playerId: 'bot-1',
      playerName: 'Carlos',
      isBot: true,
    });
    s = gameReducer(s, {
      type: 'JOIN',
      playerId: 'bot-2',
      playerName: 'Maria',
      isBot: true,
    });
    s = gameReducer(s, { type: 'START_GAME' });
    return s;
  });

  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bot auto-play
  // Détection blocage : broke / allInAll / lastMan
  useEffect(() => {
    if (stuckReason) return;
    const reason = detectStuck(state, PLAYER_ID);
    if (reason !== 'none') setStuckReason(reason);
  }, [state, stuckReason]);

  useEffect(() => {
    const current = getCurrentPlayer(state);
    if (!current || !current.isBot) return;
    if (state.phase === 'waiting' || state.phase === 'showdown' || state.phase === 'game_over') return;

    botTimerRef.current = setTimeout(() => {
      const action = botPlay(state);
      if (action) {
        dispatch(action);
      }
    }, BOT_DELAY);

    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
    };
  }, [state]);

  // Auto-advance showdown to new round
  useEffect(() => {
    if (state.phase === 'showdown') {
      const timer = setTimeout(() => {
        dispatch({ type: 'NEW_ROUND' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state.phase]);

  const humanPlayer = state.players.find((p) => p.id === PLAYER_ID);
  const isMyTurn = isPlayerTurn(state, PLAYER_ID);
  const canCheck =
    isMyTurn && humanPlayer && state.currentBet <= humanPlayer.currentBet;
  const canCall =
    isMyTurn && humanPlayer && state.currentBet > humanPlayer.currentBet;
  const toCall = humanPlayer
    ? state.currentBet - humanPlayer.currentBet
    : 0;

  const handleCheck = useCallback(() => {
    if (!isMyTurn) return;
    dispatch({ type: 'CHECK', playerId: PLAYER_ID });
  }, [isMyTurn]);

  const handleCall = useCallback(() => {
    if (!isMyTurn) return;
    dispatch({ type: 'CALL', playerId: PLAYER_ID });
  }, [isMyTurn]);

  const handleFold = useCallback(() => {
    if (!isMyTurn) return;
    dispatch({ type: 'FOLD', playerId: PLAYER_ID });
  }, [isMyTurn]);

  const handleBet = useCallback(() => {
    if (!isMyTurn || !humanPlayer) return;
    const amount = state.bigBlind;
    dispatch({ type: 'BET', playerId: PLAYER_ID, amount });
  }, [isMyTurn, humanPlayer, state.bigBlind]);

  const handleRaise = useCallback(() => {
    if (!isMyTurn || !humanPlayer) return;
    const amount = state.currentBet + state.bigBlind;
    dispatch({ type: 'RAISE', playerId: PLAYER_ID, amount });
  }, [isMyTurn, humanPlayer, state.currentBet, state.bigBlind]);

  const handleNewGame = useCallback(() => {
    dispatch({ type: 'RESET' });
    let s = initGame();
    // We need to re-init via dispatches
    dispatch({
      type: 'JOIN',
      playerId: PLAYER_ID,
      playerName: 'You',
    });
    dispatch({
      type: 'JOIN',
      playerId: 'bot-1',
      playerName: 'Carlos',
      isBot: true,
    });
    dispatch({
      type: 'JOIN',
      playerId: 'bot-2',
      playerName: 'Maria',
      isBot: true,
    });
    setTimeout(() => dispatch({ type: 'START_GAME' }), 100);
  }, []);

  return (
    <LinearGradient colors={['#064E3B', '#059669', '#047857']} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>{'< Back'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Texas Hold'em</Text>
          <Text style={styles.phaseText}>
            {state.phase.toUpperCase()} | Pot: {state.pot}
          </Text>
        </View>

        {/* Opponents */}
        <View style={styles.opponentsRow}>
          {state.players
            .filter((p) => p.id !== PLAYER_ID)
            .map((bot) => (
              <View
                key={bot.id}
                style={[
                  styles.opponentBox,
                  getCurrentPlayer(state)?.id === bot.id && styles.activePlayer,
                  bot.folded && styles.foldedPlayer,
                ]}
              >
                <Text style={styles.opponentName}>{bot.name}</Text>
                <View style={styles.opponentCards}>
                  {state.phase === 'showdown' && !bot.folded
                    ? bot.hand.map((card) => (
                        <Image
                          key={card.id}
                          source={getCardImage(card.id)}
                          style={styles.smallCard}
                        />
                      ))
                    : bot.hand.map((_, i) => (
                        <Image
                          key={i}
                          source={getCardBackImage()}
                          style={styles.smallCard}
                        />
                      ))}
                </View>
                <Text style={styles.chipText}>
                  {bot.folded ? 'FOLDED' : `${bot.chips} chips`}
                </Text>
                {bot.currentBet > 0 && (
                  <Text style={styles.betText}>Bet: {bot.currentBet}</Text>
                )}
              </View>
            ))}
        </View>

        {/* Community Cards */}
        <View style={styles.communityArea}>
          <Text style={styles.communityLabel}>Community Cards</Text>
          <View style={styles.communityCards}>
            {state.communityCards.map((card) => (
              <Image
                key={card.id}
                source={getCardImage(card.id)}
                style={styles.communityCard}
              />
            ))}
            {Array.from({ length: 5 - state.communityCards.length }).map(
              (_, i) => (
                <View key={`empty-${i}`} style={styles.emptySlot} />
              )
            )}
          </View>
          <Text style={styles.potText}>Pot: {state.pot}</Text>
        </View>

        {/* Status */}
        <Text style={styles.statusText}>{state.lastAction}</Text>
        {state.phase === 'showdown' && state.winnerId && (
          <Text style={styles.winnerText}>
            {state.players.find((p) => p.id === state.winnerId)?.name} wins!{' '}
            {state.winnerHandDescription}
          </Text>
        )}

        {/* Player Hand */}
        {humanPlayer && (
          <View style={styles.playerArea}>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>
                You {isMyTurn ? '(Your Turn)' : ''}
              </Text>
              <Text style={styles.chipText}>{humanPlayer.chips} chips</Text>
            </View>
            <View style={styles.handRow}>
              {humanPlayer.hand.map((card) => (
                <Image
                  key={card.id}
                  source={getCardImage(card.id)}
                  style={[styles.playerCard, humanPlayer.folded && styles.foldedCard]}
                />
              ))}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {isMyTurn && state.phase !== 'showdown' && state.phase !== 'game_over' && (
          <View style={styles.actions}>
            {canCheck && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleCheck}>
                <Text style={styles.actionText}>Check</Text>
              </TouchableOpacity>
            )}
            {canCall && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
                <Text style={styles.actionText}>Call {toCall}</Text>
              </TouchableOpacity>
            )}
            {state.currentBet === 0 && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.betBtn]}
                onPress={handleBet}
              >
                <Text style={styles.actionText}>Bet {state.bigBlind}</Text>
              </TouchableOpacity>
            )}
            {state.currentBet > 0 && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.raiseBtn]}
                onPress={handleRaise}
              >
                <Text style={styles.actionText}>
                  Raise {state.currentBet + state.bigBlind}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, styles.foldBtn]}
              onPress={handleFold}
            >
              <Text style={styles.actionText}>Fold</Text>
            </TouchableOpacity>
          </View>
        )}

        {state.phase === 'game_over' && (
          <View style={styles.gameOverArea}>
            <Text style={styles.gameOverText}>
              Game Over!{' '}
              {state.players.find((p) => p.id === state.winnerId)?.name} wins!
            </Text>
            <TouchableOpacity style={styles.newGameBtn} onPress={handleNewGame}>
              <Text style={styles.newGameText}>New Game</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Modal blocage Poker : broke / allInAll / lastMan */}
        <Modal visible={!!stuckReason} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' }}>
            <LinearGradient
              colors={stuckReason === 'lastMan' ? ['#065F46', '#0B1F18'] : ['#7F1D1D', '#1F1216']}
              style={{ padding: 28, borderRadius: 20, alignItems: 'center', borderWidth: 2, borderColor: stuckReason === 'lastMan' ? '#10B981' : '#EF4444', minWidth: 280, maxWidth: 360 }}
            >
              <Text style={{ fontSize: 56 }}>{stuckReason === 'broke' ? '💸' : stuckReason === 'allInAll' ? '🔥' : '🏆'}</Text>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 8, textAlign: 'center' }}>
                {stuckReason ? t(`stuck.${stuckReason}.title`) : ''}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
                {stuckReason ? t(`stuck.${stuckReason}.body`) : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
                <TouchableOpacity
                  onPress={() => { setStuckReason(null); router.replace('/(tabs)'); }}
                  style={{ backgroundColor: stuckReason === 'lastMan' ? '#10B981' : '#EF4444', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>🔄 {stuckReason ? t(`stuck.${stuckReason}.again`) : ''}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setStuckReason(null)}
                  style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{stuckReason ? t(`stuck.${stuckReason}.continue`) : ''}</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 12 },
  header: { alignItems: 'center', paddingVertical: 8 },
  backBtn: { position: 'absolute', left: 0, top: 8 },
  backText: { color: '#A7F3D0', fontSize: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  phaseText: { color: '#A7F3D0', fontSize: 13, marginTop: 2 },
  opponentsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  opponentBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    padding: 8,
    minWidth: 100,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activePlayer: { borderColor: '#FCD34D' },
  foldedPlayer: { opacity: 0.5 },
  opponentName: { color: '#fff', fontWeight: '600', fontSize: 13 },
  opponentCards: { flexDirection: 'row', marginVertical: 4, gap: 2 },
  smallCard: { width: 40, height: 60, borderRadius: 4 },
  chipText: { color: '#A7F3D0', fontSize: 12 },
  betText: { color: '#FCD34D', fontSize: 11 },
  communityArea: { alignItems: 'center', marginVertical: 12 },
  communityLabel: { color: '#D1FAE5', fontSize: 12, marginBottom: 6 },
  communityCards: { flexDirection: 'row', gap: 6 },
  communityCard: {
    width: COMMUNITY_CARD_WIDTH,
    height: COMMUNITY_CARD_HEIGHT,
    borderRadius: 6,
  },
  emptySlot: {
    width: COMMUNITY_CARD_WIDTH,
    height: COMMUNITY_CARD_HEIGHT,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
  },
  potText: { color: '#FCD34D', fontSize: 16, fontWeight: 'bold', marginTop: 8 },
  statusText: { color: '#D1FAE5', textAlign: 'center', fontSize: 13, marginVertical: 4 },
  winnerText: {
    color: '#FCD34D',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playerArea: { alignItems: 'center', marginTop: 8 },
  playerInfo: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  playerName: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  handRow: { flexDirection: 'row', gap: 8 },
  playerCard: { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 6 },
  foldedCard: { opacity: 0.4 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  actionBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  betBtn: { backgroundColor: 'rgba(59,130,246,0.4)' },
  raiseBtn: { backgroundColor: 'rgba(245,158,11,0.4)' },
  foldBtn: { backgroundColor: 'rgba(239,68,68,0.3)' },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  gameOverArea: { alignItems: 'center', marginTop: 20 },
  gameOverText: { color: '#FCD34D', fontSize: 20, fontWeight: 'bold' },
  newGameBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  newGameText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
