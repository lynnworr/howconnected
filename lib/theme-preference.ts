export const THEME_STORAGE_KEY = "howconnected:theme";

export type PublicTheme = "light" | "dark";

type ThemeReader = { getItem: (key: string) => string | null };
type ThemeWriter = { setItem: (key: string, value: string) => void };

export function parsePublicTheme(value: unknown): PublicTheme | null {
  return value === "light" || value === "dark" ? value : null;
}

export function resolvePublicTheme(
  storedValue: unknown,
  systemPrefersDark: boolean,
): PublicTheme {
  return parsePublicTheme(storedValue) ?? (systemPrefersDark ? "dark" : "light");
}

export function readPublicTheme(storage: ThemeReader): PublicTheme | null {
  return parsePublicTheme(storage.getItem(THEME_STORAGE_KEY));
}

export function persistPublicTheme(
  storage: ThemeWriter,
  theme: PublicTheme,
): void {
  storage.setItem(THEME_STORAGE_KEY, theme);
}

export function nextPublicTheme(theme: PublicTheme): PublicTheme {
  return theme === "light" ? "dark" : "light";
}
