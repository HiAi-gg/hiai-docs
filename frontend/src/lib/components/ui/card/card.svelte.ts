import type { WithElementRef } from "$lib/utils.js";
import type { HTMLAttributes } from "svelte/elements";

export type CardProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
	ref?: HTMLDivElement | null;
};
