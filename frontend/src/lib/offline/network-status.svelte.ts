// Shared offline/online status using Svelte 5 runes. Lives in a
// `.svelte.ts` module so `$state` is available and the value is reactive
// across the app. SSR-safe: `navigator`/`window` may be absent on the
// server, in which case we assume online.

let isOnline = $state(
	typeof window !== "undefined" ? window.navigator.onLine : true,
);

if (typeof window !== "undefined") {
	window.addEventListener("online", () => {
		isOnline = true;
	});
	window.addEventListener("offline", () => {
		isOnline = false;
	});
}

export const networkStatus = {
	get isOnline(): boolean {
		return isOnline;
	},
};
