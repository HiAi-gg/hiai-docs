import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";

export interface WebVitalReport {
	appId: string;
	deploymentId: string;
	name: string;
	value: number;
	rating: Metric["rating"];
}

export type WebVitalReporter = (report: WebVitalReport) => void;

/** Optional, privacy-preserving Web Vitals hook. Defaults to a no-op. */
export function initWebVitals(reporter: WebVitalReporter = () => {}): void {
	if (typeof window === "undefined") return;
	const appId = String(
		import.meta.env.PUBLIC_APP_ID ?? import.meta.env.VITE_APP_ID ?? "hiai-docs",
	);
	const deploymentId = String(
		import.meta.env.PUBLIC_DEPLOYMENT_ID ??
			import.meta.env.VITE_DEPLOYMENT_ID ??
			"local",
	);
	const report = (metric: Metric) =>
		reporter({
			appId,
			deploymentId,
			name: metric.name,
			value: metric.value,
			rating: metric.rating,
		});
	onLCP(report);
	onINP(report);
	onCLS(report);
	onFCP(report);
	onTTFB(report);
}
