import { create } from 'zustand';
import { ThemeColors, DarkColors, LightColors } from '../theme/colors';
import { useBleStore } from './useBleStore';

export type ThemeMode = 'dark' | 'light';

interface ThemeState {
  theme: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',
  colors: DarkColors,

  setTheme: (mode: ThemeMode) => {
    const colors = mode === 'dark' ? DarkColors : LightColors;
    set({ theme: mode, colors });
    // Sync with hardware writing pad display
    useBleStore.getState().sendCommand(mode === 'dark' ? 'CMD:THEME:DARK' : 'CMD:THEME:LIGHT');
  },

  toggleTheme: () => {
    const nextMode: ThemeMode = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(nextMode);
  },
}));
