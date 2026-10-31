import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PROFILE_VISIBILITY,
  PROFILE_VISIBILITY_KEY,
  canShowProfileStatCard,
  readProfileVisibility,
  saveProfileVisibility,
} from './profileVisibility';

describe('profile stat visibility', () => {
  let storage;

  beforeEach(() => {
    storage = new Map();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key) => storage.get(key) || null,
          setItem: (key, value) => storage.set(key, value),
        },
        dispatchEvent: vi.fn(),
      },
    });
  });

  afterEach(() => {
    delete globalThis.window;
  });

  it('defaults every profile stat card to visible', () => {
    expect(readProfileVisibility()).toEqual(DEFAULT_PROFILE_VISIBILITY);
  });

  it('persists each card preference and restores defaults for missing fields', () => {
    window.localStorage.setItem(PROFILE_VISIBILITY_KEY, JSON.stringify({ activeDays: false }));

    expect(readProfileVisibility()).toEqual({
      ...DEFAULT_PROFILE_VISIBILITY,
      activeDays: false,
    });
  });

  it('writes only supported boolean preferences', () => {
    expect(saveProfileVisibility({ problemsSolved: false, extra: false })).toEqual({
      ...DEFAULT_PROFILE_VISIBILITY,
      problemsSolved: false,
    });
    expect(readProfileVisibility()).toEqual({
      ...DEFAULT_PROFILE_VISIBILITY,
      problemsSolved: false,
    });
  });

  it('hides a private card from friends but keeps it visible to its owner', () => {
    const visibility = { ...DEFAULT_PROFILE_VISIBILITY, activeDays: false, difficultyStats: false };

    expect(canShowProfileStatCard('activeDays', visibility)).toBe(false);
    expect(canShowProfileStatCard('activeDays', visibility, true)).toBe(true);
    expect(canShowProfileStatCard('problemsSolved', visibility)).toBe(true);
    expect(canShowProfileStatCard('difficultyStats', visibility)).toBe(false);
  });
});
