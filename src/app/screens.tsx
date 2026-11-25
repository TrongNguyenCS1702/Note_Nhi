import type { ComponentType } from 'react';
import { WelcomeScreen } from '@/features/welcome';
import { CheckScreen } from '@/features/check';
import { HomeScreen } from '@/features/home';
import { PrepScreen } from '@/features/prep';
import { LaunchScreen } from '@/features/launch';
import { ChairsScreen } from '@/features/chairs';
import { SilenceScreen } from '@/features/silence';
import { WaitScreen } from '@/features/wait';
import { ClassesScreen } from '@/features/classes';
import { MusicScreen } from '@/features/music';
import { SettingsScreen } from '@/features/settings';
import type { ScreenId } from './store';

/**
 * Screen registry: screen id → component. Each feature owns `src/features/<id>/index.tsx`
 * and exports its screen from there, so this file never needs editing per feature.
 */
export const screens: Record<ScreenId, ComponentType> = {
  welcome: WelcomeScreen,
  check: CheckScreen,
  home: HomeScreen,
  prep: PrepScreen,
  launch: LaunchScreen,
  chairs: ChairsScreen,
  silence: SilenceScreen,
  wait: WaitScreen,
  classes: ClassesScreen,
  music: MusicScreen,
  settings: SettingsScreen,
};
