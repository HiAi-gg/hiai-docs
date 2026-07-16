/**
 * Mobile sidebar (Sheet) open/close state.
 *
 * Shared reactive store consumed by the app shell layout and the hamburger
 * toggle. Implemented with Svelte 5 runes so consumers track changes
 * reactively across module boundaries.
 *
 * A bare `$state` export loses its reactivity once imported, so the boolean
 * is exposed through the getter/setter on `mobileSidebar.open` (the spec's
 * `mobileOpen` state) plus the standalone action helpers.
 */

let open = $state(false);

export const mobileSidebar = {
	get open(): boolean {
		return open;
	},
	set open(value: boolean) {
		open = value;
	},
	toggle(): void {
		open = !open;
	},
};

export function toggleMobileSidebar(): void {
	open = !open;
}

export function openMobileSidebar(): void {
	open = true;
}

export function closeMobileSidebar(): void {
	open = false;
}
