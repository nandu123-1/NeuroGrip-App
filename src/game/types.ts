export type GameMode = 'glider' | 'koi' | 'forge' | 'coach';

export interface RingObstacle {
  id: number;
  x: number;
  y: number;
  radius: number;
  isPassed: boolean;
  isHit: boolean;
  type: 'normal' | 'star' | 'spiral';
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface LilyPad {
  id: number;
  x: number;
  y: number;
  radius: number;
  state: 'inactive' | 'active' | 'locking' | 'bloomed';
  lockProgress: number; // 0 to 1
  bloomPetals: number;
}

export interface KoiFish {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  color: string;
  size: number;
}
