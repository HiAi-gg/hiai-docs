/**
 * Public application hosts.
 *
 * These components preserve the standalone HiAi-Docs routes while allowing a
 * product build to mount typed, additive frontend extensions.
 */

export type { HiaiDocsDashboardData } from "./HiaiDocsDashboardHost.svelte";
export { default as HiaiDocsDashboardHost } from "./HiaiDocsDashboardHost.svelte";
export { default as HiaiDocsExtensionProvider } from "./HiaiDocsExtensionProvider.svelte";
export type { HiaiDocsSearchData } from "./HiaiDocsSearchHost.svelte";
export { default as HiaiDocsSearchHost } from "./HiaiDocsSearchHost.svelte";
