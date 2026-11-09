import type { Settings } from '../parse/types';
import type { StorageLike } from './progress';

export const SETTINGS_KEY = 'reader:settings:v1';

export const DEFAULT_SETTINGS: Settings = { fontSize: 2, lineHeight: 1, theme: 'light' };

export function loadSettings(storage: StorageLike): Settings {
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      fontSize:
        parsed.fontSize === 1 || parsed.fontSize === 2 || parsed.fontSize === 3
          ? parsed.fontSize
          : DEFAULT_SETTINGS.fontSize,
      lineHeight:
        parsed.lineHeight === 1 || parsed.lineHeight === 2
          ? parsed.lineHeight
          : DEFAULT_SETTINGS.lineHeight,
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage: StorageLike, settings: Settings): void {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
