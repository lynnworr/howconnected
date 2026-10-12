export const DAILY_COMPLETION_STORAGE_KEY = "howconnected:daily:v2";
export const LEGACY_DAILY_COMPLETION_STORAGE_KEY = "howconnected:daily-preview:v1";
export const DAILY_ANALYTICS_STORAGE_PREFIX = "howconnected:daily-event:v2";

export type DailyResult = { dateKey: string; puzzleId: string; correct: boolean; selectedOptionId: string };
export type DailyCompletionState = {
  version: 2; completedDates: string[]; results: DailyResult[]; currentStreak: number; bestStreak: number; lastCompletedDate: string | null;
};
export const EMPTY_DAILY_COMPLETION_STATE: DailyCompletionState = { version: 2, completedDates: [], results: [], currentStreak: 0, bestStreak: 0, lastCompletedDate: null };
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
function utcDayNumber(dateKey: string): number {
  if (!DATE_KEY_PATTERN.test(dateKey)) return Number.NaN;
  const value = Date.parse(`${dateKey}T00:00:00.000Z`); return Number.isNaN(value) ? Number.NaN : Math.floor(value / 86_400_000);
}
export function parseDailyCompletionState(value: string | null): DailyCompletionState {
  if (!value) return { ...EMPTY_DAILY_COMPLETION_STATE, completedDates: [], results: [] };
  try {
    const parsed = JSON.parse(value) as Partial<DailyCompletionState>;
    const completedDates = Array.isArray(parsed.completedDates)
      ? [...new Set(parsed.completedDates.filter((item): item is string => typeof item === "string" && Number.isFinite(utcDayNumber(item))))].sort().slice(-400) : [];
    const results = Array.isArray(parsed.results) ? parsed.results.filter((item): item is DailyResult =>
      Boolean(item) && typeof item.dateKey === "string" && Number.isFinite(utcDayNumber(item.dateKey)) && typeof item.puzzleId === "string" && typeof item.correct === "boolean" && typeof item.selectedOptionId === "string"
    ).filter((item, index, all) => all.findIndex((other) => other.dateKey === item.dateKey) === index).slice(-400) : [];
    const lastCompletedDate = typeof parsed.lastCompletedDate === "string" && Number.isFinite(utcDayNumber(parsed.lastCompletedDate)) ? parsed.lastCompletedDate : null;
    return { version: 2, completedDates, results, currentStreak: Number.isInteger(parsed.currentStreak) && (parsed.currentStreak ?? 0) >= 0 ? parsed.currentStreak ?? 0 : 0,
      bestStreak: Number.isInteger(parsed.bestStreak) && (parsed.bestStreak ?? 0) >= 0 ? parsed.bestStreak ?? 0 : 0, lastCompletedDate };
  } catch { return { ...EMPTY_DAILY_COMPLETION_STATE, completedDates: [], results: [] }; }
}
export function completeDailyChallenge(state: DailyCompletionState, resultOrDate: DailyResult | string): { state: DailyCompletionState; newlyCompleted: boolean } {
  const result: DailyResult = typeof resultOrDate === "string" ? { dateKey: resultOrDate, puzzleId: "legacy", correct: false, selectedOptionId: "unknown" } : resultOrDate;
  const day = utcDayNumber(result.dateKey); if (!Number.isFinite(day)) throw new Error("A valid UTC date key is required.");
  if (state.completedDates.includes(result.dateKey)) return { state, newlyCompleted: false };
  const previousDay = state.lastCompletedDate ? utcDayNumber(state.lastCompletedDate) : Number.NaN;
  const currentStreak = Number.isFinite(previousDay) && day - previousDay === 1 ? state.currentStreak + 1 : 1;
  return { newlyCompleted: true, state: { version: 2, completedDates: [...state.completedDates, result.dateKey].sort().slice(-400),
    results: [...state.results, result].sort((a, b) => a.dateKey.localeCompare(b.dateKey)).slice(-400), currentStreak,
    bestStreak: Math.max(state.bestStreak, currentStreak), lastCompletedDate: result.dateKey } };
}
export function getVisibleCurrentStreak(state: DailyCompletionState, dateKey: string): number {
  const today = utcDayNumber(dateKey); const last = state.lastCompletedDate ? utcDayNumber(state.lastCompletedDate) : Number.NaN;
  if (!Number.isFinite(today) || !Number.isFinite(last)) return 0;
  const difference = today - last; return difference === 0 || difference === 1 ? state.currentStreak : 0;
}
export function getDailyResult(state: DailyCompletionState, dateKey: string, puzzleId: string): DailyResult | null {
  return state.results.find((item) => item.dateKey === dateKey && item.puzzleId === puzzleId) ?? null;
}
type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void };
export function claimDailyAnalyticsEvent(storage: StorageLike, event: string, dateKey: string, puzzleId: string): boolean {
  const key = `${DAILY_ANALYTICS_STORAGE_PREFIX}:${event}:${dateKey}:${puzzleId}`;
  try { if (storage.getItem(key) === "1") return false; storage.setItem(key, "1"); return true; } catch { return true; }
}
