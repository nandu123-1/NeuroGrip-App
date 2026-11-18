export interface ThemeColors {
  isDark: boolean;
  bg: string;
  bgGradientStart: string;
  bgGradientEnd: string;
  surface: string;
  surfaceGlass: string;
  surfaceElevated: string;
  surfaceHover: string;
  border: string;
  borderHighlight: string;
  borderSubtle: string;
  borderActive: string;
  primary: string;
  primaryGlow: string;
  primaryDark: string;
  accent: string;
  accentGlow: string;
  success: string;
  successGlow: string;
  warning: string;
  warningGlow: string;
  danger: string;
  dangerGlow: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDim: string;
  canvasBg: string;
  inkCyan: string;
  inkGlow: string;
  gridLine: string;
  gridCross: string;
  cardBg: string;
  headerBg: string;
  tabBarBg: string;
}

export const DarkColors: ThemeColors = {
  isDark: true,
  bg: '#060913',
  bgGradientStart: '#060913',
  bgGradientEnd: '#0A1020',
  surface: '#0D1424',
  surfaceGlass: 'rgba(13, 20, 36, 0.85)',
  surfaceElevated: '#131D35',
  surfaceHover: '#1A2747',
  border: 'rgba(255, 255, 255, 0.08)',
  borderHighlight: 'rgba(255, 255, 255, 0.16)',
  borderSubtle: 'rgba(255, 255, 255, 0.04)',
  borderActive: '#38BDF8',
  primary: '#38BDF8',
  primaryGlow: 'rgba(56, 189, 248, 0.25)',
  primaryDark: '#0284C7',
  accent: '#818CF8',
  accentGlow: 'rgba(129, 140, 248, 0.22)',
  success: '#10B981',
  successGlow: 'rgba(16, 185, 129, 0.25)',
  warning: '#F59E0B',
  warningGlow: 'rgba(245, 158, 11, 0.25)',
  danger: '#F43F5E',
  dangerGlow: 'rgba(244, 63, 94, 0.25)',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textDim: '#475569',
  canvasBg: '#03060E',
  inkCyan: '#38BDF8',
  inkGlow: 'rgba(56, 189, 248, 0.65)',
  gridLine: 'rgba(56, 189, 248, 0.05)',
  gridCross: 'rgba(56, 189, 248, 0.15)',
  cardBg: '#0D1424',
  headerBg: '#060913',
  tabBarBg: '#090E1D',
};

export const LightColors: ThemeColors = {
  isDark: false,
  bg: '#F8FAFC',
  bgGradientStart: '#FFFFFF',
  bgGradientEnd: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceGlass: 'rgba(255, 255, 255, 0.92)',
  surfaceElevated: '#F1F5F9',
  surfaceHover: '#E2E8F0',
  border: 'rgba(15, 23, 42, 0.08)',
  borderHighlight: 'rgba(15, 23, 42, 0.14)',
  borderSubtle: 'rgba(15, 23, 42, 0.04)',
  borderActive: '#0284C7',
  primary: '#0284C7',
  primaryGlow: 'rgba(2, 132, 199, 0.15)',
  primaryDark: '#0369A1',
  accent: '#6366F1',
  accentGlow: 'rgba(99, 102, 241, 0.15)',
  success: '#059669',
  successGlow: 'rgba(5, 150, 105, 0.15)',
  warning: '#D97706',
  warningGlow: 'rgba(217, 119, 6, 0.15)',
  danger: '#E11D48',
  dangerGlow: 'rgba(225, 29, 72, 0.15)',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textDim: '#CBD5E1',
  canvasBg: '#FFFFFF',
  inkCyan: '#0369A1',
  inkGlow: 'rgba(2, 132, 199, 0.35)',
  gridLine: 'rgba(15, 23, 42, 0.05)',
  gridCross: 'rgba(15, 23, 42, 0.14)',
  cardBg: '#FFFFFF',
  headerBg: '#FFFFFF',
  tabBarBg: '#FFFFFF',
};

// Default export alias for backward compatibility
export const Colors = DarkColors;
