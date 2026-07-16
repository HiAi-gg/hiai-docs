import { initWebVitals } from "$lib/vitals";

// Initialize web vitals tracking on client
if (typeof window !== "undefined") {
	initWebVitals();

	if ("serviceWorker" in navigator) {
		const registerServiceWorker = () => {
			void navigator.serviceWorker
				.register("/sw.js", { scope: "/" })
				.catch(() => {
					// Offline support is progressive enhancement. A registration error
					// must never interrupt Svelte hydration or product interactions.
				});
		};

		if (document.readyState === "complete") {
			registerServiceWorker();
		} else {
			window.addEventListener("load", registerServiceWorker, { once: true });
		}
	}
}
