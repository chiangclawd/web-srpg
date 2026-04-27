const STORAGE_KEY = 'web-srpg-settings-v1';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type UITheme = 'dark' | 'sepia';

export interface Settings {
  animSpeed: number; // 0.5 / 1 / 1.5 / 2
  muted: boolean;
  difficulty: Difficulty;
  theme: UITheme;
}

const DEFAULT: Settings = {
  animSpeed: 1.0,
  muted: false,
  difficulty: 'normal',
  theme: 'dark',
};

const THEMES: Record<UITheme, {
  bg: number;
  panelBg: number;
  text: string;
  accent: string;
  label: string;
}> = {
  dark: {
    bg: 0x121212,
    panelBg: 0x1a1a1a,
    text: '#ffffff',
    accent: '#7ed1ff',
    label: '暗色',
  },
  sepia: {
    bg: 0x2a1810,
    panelBg: 0x3a2820,
    text: '#f0d8a8',
    accent: '#d4a060',
    label: '復古',
  },
};

export function getThemeColors() {
  return THEMES[_settings.theme];
}

export function cycleTheme(): UITheme {
  const order: UITheme[] = ['dark', 'sepia'];
  const idx = order.indexOf(_settings.theme);
  const next = order[(idx + 1) % order.length] ?? 'dark';
  _settings.theme = next;
  saveSettings();
  return next;
}

const DIFFICULTY_ENEMY_ATK_MUL: Record<Difficulty, number> = {
  easy: 0.7,
  normal: 1.0,
  hard: 1.3,
};

export function getEnemyAttackMul(): number {
  return DIFFICULTY_ENEMY_ATK_MUL[_settings.difficulty];
}

let _settings: Settings = { ...DEFAULT };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      _settings = { ...DEFAULT, ...parsed };
    } else {
      _settings = { ...DEFAULT };
    }
  } catch {
    _settings = { ...DEFAULT };
  }
  return _settings;
}

export function saveSettings(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
  } catch (e) {
    console.warn('saveSettings failed', e);
  }
}

export function getSettings(): Settings {
  return _settings;
}

export function cycleAnimSpeed(): number {
  const speeds = [0.5, 1, 1.5, 2] as const;
  const idx = speeds.indexOf(_settings.animSpeed as 0.5 | 1 | 1.5 | 2);
  const next = speeds[(idx + 1) % speeds.length] ?? 1;
  _settings.animSpeed = next;
  saveSettings();
  return next;
}

export function toggleMute(): boolean {
  _settings.muted = !_settings.muted;
  saveSettings();
  return _settings.muted;
}

export function cycleDifficulty(): Difficulty {
  const order: Difficulty[] = ['easy', 'normal', 'hard'];
  const idx = order.indexOf(_settings.difficulty);
  const next = order[(idx + 1) % order.length] ?? 'normal';
  _settings.difficulty = next;
  saveSettings();
  return next;
}

export function difficultyLabel(d: Difficulty): string {
  return d === 'easy' ? '休閒' : d === 'hard' ? '困難' : '普通';
}
