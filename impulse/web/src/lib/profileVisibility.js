export const PROFILE_VISIBILITY_KEY = 'impulse_profile_stat_visibility';
export const PROFILE_VISIBILITY_UPDATED_EVENT = 'impulse-profile-visibility-updated';

export const PROFILE_STAT_CARDS = Object.freeze([
  Object.freeze({ id: 'problemsSolved', label: 'Problems solved' }),
  Object.freeze({ id: 'activeDays', label: 'Active days' }),
  Object.freeze({ id: 'longestStreak', label: 'Longest streak' }),
  Object.freeze({ id: 'attemptsThisYear', label: 'Attempts this year' }),
]);

export const PROFILE_SECTIONS = Object.freeze([
  Object.freeze({ id: 'difficultyStats', label: 'Solved by difficulty' }),
  Object.freeze({ id: 'subjectRating', label: 'Rating by subject' }),
  Object.freeze({ id: 'yearlyActivity', label: 'Problem solving this year' }),
]);

const PROFILE_VISIBILITY_ITEMS = [...PROFILE_STAT_CARDS, ...PROFILE_SECTIONS];

export const DEFAULT_PROFILE_VISIBILITY = Object.freeze(
  Object.fromEntries(PROFILE_VISIBILITY_ITEMS.map(({ id }) => [id, true])),
);

export function canShowProfileStatCard(statId, visibility, isOwnProfile = false) {
  return isOwnProfile || visibility?.[statId] !== false;
}

export function readProfileVisibility() {
  if (typeof window === 'undefined') return { ...DEFAULT_PROFILE_VISIBILITY };

  const stored = window.localStorage.getItem(PROFILE_VISIBILITY_KEY);
  if (!stored) return { ...DEFAULT_PROFILE_VISIBILITY };

  try {
    const parsed = JSON.parse(stored);
    return Object.fromEntries(
      PROFILE_VISIBILITY_ITEMS.map(({ id }) => [
        id,
        typeof parsed?.[id] === 'boolean' ? parsed[id] : DEFAULT_PROFILE_VISIBILITY[id],
      ]),
    );
  } catch {
    return { ...DEFAULT_PROFILE_VISIBILITY };
  }
}

export function saveProfileVisibility(visibility) {
  const normalized = Object.fromEntries(
    PROFILE_VISIBILITY_ITEMS.map(({ id }) => [
      id,
      typeof visibility[id] === 'boolean' ? visibility[id] : DEFAULT_PROFILE_VISIBILITY[id],
    ]),
  );
  window.localStorage.setItem(PROFILE_VISIBILITY_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(PROFILE_VISIBILITY_UPDATED_EVENT));
  return normalized;
}
