
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/(app)" | "/" | "/api" | "/api/[...path]" | "/(app)/docs" | "/(app)/docs/[id]" | "/folders" | "/folders/[id]" | "/login" | "/register" | "/search" | "/settings" | "/s" | "/s/[token]";
		RouteParams(): {
			"/api/[...path]": { path: string };
			"/(app)/docs/[id]": { id: string };
			"/folders/[id]": { id: string };
			"/s/[token]": { token: string }
		};
		LayoutParams(): {
			"/(app)": { id?: string | undefined };
			"/": { path?: string | undefined; id?: string | undefined; token?: string | undefined };
			"/api": { path?: string | undefined };
			"/api/[...path]": { path: string };
			"/(app)/docs": { id?: string | undefined };
			"/(app)/docs/[id]": { id: string };
			"/folders": { id?: string | undefined };
			"/folders/[id]": { id: string };
			"/login": Record<string, never>;
			"/register": Record<string, never>;
			"/search": Record<string, never>;
			"/settings": Record<string, never>;
			"/s": { token?: string | undefined };
			"/s/[token]": { token: string }
		};
		Pathname(): "/" | `/api/${string}` & {} | `/docs/${string}` & {} | `/folders/${string}` & {} | "/login" | "/register" | "/search" | "/settings" | `/s/${string}` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/favicon.png" | string & {};
	}
}