import React from 'react';
import Svg, { Path, Circle, Rect, Polyline } from 'react-native-svg';

interface IconProps {
  color?: string;
  size?: number;
}

export const CanvasIcon: React.FC<IconProps> = ({ color = '#38BDF8', size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <Path d="M8 21h8" />
    <Path d="M12 17v4" />
    <Path d="m14 8-4 4" />
    <Path d="M10 8h4v4" />
  </Svg>
);

export const PlayIcon: React.FC<IconProps> = ({ color = '#38BDF8', size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="m10 8 6 4-6 4V8Z" />
  </Svg>
);

export const ChartIcon: React.FC<IconProps> = ({ color = '#38BDF8', size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 3v18h18" />
    <Path d="m19 9-5 5-4-4-3 3" />
  </Svg>
);

export const HubIcon: React.FC<IconProps> = ({ color = '#38BDF8', size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="5" r="3" />
    <Circle cx="5" cy="19" r="3" />
    <Circle cx="19" cy="19" r="3" />
    <Path d="M8.5 7.5 6 16" />
    <Path d="M15.5 7.5 18 16" />
  </Svg>
);

export const PenIcon: React.FC<IconProps> = ({ color = '#38BDF8', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <Path d="m15 5 4 4" />
  </Svg>
);

export const PadIcon: React.FC<IconProps> = ({ color = '#38BDF8', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <Path d="M12 18h.01" />
  </Svg>
);

export const BluetoothIcon: React.FC<IconProps> = ({ color = '#38BDF8', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="7 7 17 17 12 22 12 2 17 7 7 17" />
  </Svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ color = '#38BDF8', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <Path d="M3 3v5h5" />
    <Path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <Path d="M16 16h5v5" />
  </Svg>
);

export const TrashIcon: React.FC<IconProps> = ({ color = '#38BDF8', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18" />
    <Path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <Path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </Svg>
);

export const HistoryIcon: React.FC<IconProps> = ({ color = '#38BDF8', size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Polyline points="12 6 12 12 16 14" />
  </Svg>
);

export const LightbulbIcon: React.FC<IconProps> = ({ color = '#F59E0B', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 18h6" />
    <Path d="M10 22h4" />
    <Path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
  </Svg>
);

export const CheckCircleIcon: React.FC<IconProps> = ({ color = '#10B981', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <Polyline points="22 4 12 14.01 9 11.01" />
  </Svg>
);

export const SparklesIcon: React.FC<IconProps> = ({ color = '#38BDF8', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </Svg>
);

export const PlaneIcon: React.FC<IconProps> = ({ color = '#38BDF8', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.8-.2-1.6.3-1.8 1.1-.1.4 0 .9.3 1.2l4.7 4.7-3 3-2.5-.5c-.4-.1-.8.1-1.1.4-.4.4-.4 1 0 1.4l2.5 2.5c.4.4 1 .4 1.4 0 .3-.3.5-.7.4-1.1l-.5-2.5 3-3 4.7 4.7c.3.3.8.4 1.2.3.8-.2 1.3-1 1.1-1.8Z" />
  </Svg>
);

export const LotusIcon: React.FC<IconProps> = ({ color = '#10B981', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 3c-1.5 3-3 6-3 9 0 3 2.5 5 3 5s3-2 3-5c0-3-1.5-6-3-9Z" />
    <Path d="M12 17c-2.5 0-5.5-1.5-7-4 2-1 4.5-.5 6 1" />
    <Path d="M12 17c2.5 0 5.5-1.5 7-4-2-1-4.5-.5-6 1" />
    <Path d="M5 19c3.5 1.5 10.5 1.5 14 0" />
  </Svg>
);

export const GamepadIcon: React.FC<IconProps> = ({ color = '#818CF8', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="2" y="6" width="20" height="12" rx="4" />
    <Path d="M6 12h4" />
    <Path d="M8 10v4" />
    <Circle cx="16" cy="10" r="1" fill={color} />
    <Circle cx="18" cy="13" r="1" fill={color} />
  </Svg>
);

export const TrophyIcon: React.FC<IconProps> = ({ color = '#F59E0B', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <Path d="M4 22h16" />
    <Path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1h10v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34" />
    <Path d="M6 4h12v6c0 3.31-2.69 6-6 6s-6-2.69-6-6V4Z" />
  </Svg>
);

export const InfoIcon: React.FC<IconProps> = ({ color = '#38BDF8', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M12 16v-4" />
    <Path d="M12 8h.01" />
  </Svg>
);

export const SunIcon: React.FC<IconProps> = ({ color = '#F59E0B', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="4" />
    <Path d="M12 2v2" />
    <Path d="M12 20v2" />
    <Path d="m4.93 4.93 1.41 1.41" />
    <Path d="m17.66 17.66 1.41 1.41" />
    <Path d="M2 12h2" />
    <Path d="M20 12h2" />
    <Path d="m6.34 17.66-1.41 1.41" />
    <Path d="m19.07 4.93-1.41 1.41" />
  </Svg>
);

export const MoonIcon: React.FC<IconProps> = ({ color = '#38BDF8', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </Svg>
);

