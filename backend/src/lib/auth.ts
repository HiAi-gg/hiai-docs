import { db } from "@hiai-docs/db";
import { accounts, sessions, users, verifications } from "@hiai-docs/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { config } from "./config";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			user: users,
			session: sessions,
			account: accounts,
			verification: verifications,
		},
	}),
	secret: config.BETTER_AUTH_SECRET,
	baseURL: config.BETTER_AUTH_URL,
	trustedOrigins: process.env.TRUSTED_ORIGINS
		? process.env.TRUSTED_ORIGINS.split(",").map((s) => s.trim())
		: ["http://localhost:50701", "http://127.0.0.1:50701"],
	emailAndPassword: {
		enabled: true,
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24, // 1 day
	},
	advanced: {
		database: {
			generateId: false,
		},
		disableCSRFCheck: true,
	},
});
