import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";
import type {
	DocsmintNavigationOptions,
	DocsmintRequestAdapter,
	DocsmintRouteAdapter,
} from "./types";

const ROUTE_ADAPTER = Symbol("docsmint-route-adapter");
const REQUEST_ADAPTER = Symbol("docsmint-request-adapter");

const standaloneRoute: DocsmintRouteAdapter = {
	pathname: "/",
	resolve: (path) => path,
	navigate: (path, options) => goto(path, options),
};

/** Makes a route adapter available to every public host child. */
export function provideDocsmintRouteAdapter(
	adapter: DocsmintRouteAdapter,
): void {
	setContext(ROUTE_ADAPTER, adapter);
}

export function provideDocsmintRequestAdapter(
	adapter: DocsmintRequestAdapter,
): void {
	setContext(REQUEST_ADAPTER, adapter);
}

/**
 * Reads the embedding route adapter, preserving the standalone SvelteKit
 * behaviour when a public host is rendered without DocsmintAppShellHost.
 */
export function getDocsmintRouteAdapter(): DocsmintRouteAdapter {
	return getContext<DocsmintRouteAdapter>(ROUTE_ADAPTER) ?? standaloneRoute;
}

export function getDocsmintRequestAdapter(): DocsmintRequestAdapter {
	return getContext<DocsmintRequestAdapter>(REQUEST_ADAPTER) ?? { fetch };
}

export function resolveDocsmintRoute(
	route: DocsmintRouteAdapter,
	path: string,
): string {
	return /^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(path)
		? path
		: route.resolve(path);
}

export function navigateDocsmintRoute(
	route: DocsmintRouteAdapter,
	path: string,
	options?: DocsmintNavigationOptions,
): void | Promise<void> {
	const resolved = resolveDocsmintRoute(route, path);
	return route.navigate?.(resolved, options) ?? goto(resolved, options);
}
