import * as messageModule from "../../../frontend/src/lib/paraglide/messages";
import { locales, setLocale as setParaglideLocale } from "../../../frontend/src/lib/paraglide/runtime";

export type Locale = (typeof locales)[number];
export const messages = messageModule;
export const supportedLocales = locales;
export const setLocale = setParaglideLocale;
export function getMessage(name: keyof typeof messageModule): unknown {
	return messageModule[name];
}
