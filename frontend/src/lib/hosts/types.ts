/**
 * Host-owned route contract for an embedded DocsMint application shell.
 *
 * The adapter keeps product route prefixes (for example `/w/acme`) outside
 * the OSS package. It is data-only and therefore safe to construct per SSR
 * request; callers retain ownership of navigation and request handling.
 */
export interface DocsmintRouteAdapter {
	pathname: string;
	resolve(path: string): string;
	navigate?(path: string): void | Promise<void>;
}
