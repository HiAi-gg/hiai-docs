import { themeStore, type Theme } from "../../../frontend/src/lib/stores/theme.svelte";

export type ThemeMode = Theme;
export const theme = themeStore;
export const setTheme = themeStore.set;
export function toggleTheme(): void {
	setTheme(theme.value === "dark" ? "light" : "dark");
}
