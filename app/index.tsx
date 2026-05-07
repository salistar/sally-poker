/**
 * @file index.tsx
 * @description Entry point / root redirect for the Poker app. Checks auth token and redirects to tabs or welcome screen accordingly.
 * @author Idriss Kriouile
 * @date 2026-04-05
 * @project SallyCards - Poker
 */

import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import * as api from '../shared/api';

export default function Index() {
  // Check if user has an existing auth token
  const token = api.getAuthToken();

  useEffect(() => {
    console.log('[Poker/index] Component mounted');
    console.log('[Poker/index] Auth token present:', !!token);
  }, []);

  // If authenticated, redirect to main tabs; otherwise, redirect to welcome/onboarding
  if (token) {
    console.log('[Poker/index] Navigating to /(tabs)');
    return <Redirect href="/(tabs)" />;
  }
  console.log('[Poker/index] Navigating to /auth/welcome');
  return <Redirect href="/auth/welcome" />;
}

/* === End of index.tsx — Poker — SallyCards === */
