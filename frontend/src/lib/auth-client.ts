import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
	baseURL: "http://localhost:50700",
});

export const { signIn, signUp, signOut, getSession } = authClient;
