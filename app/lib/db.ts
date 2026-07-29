import "server-only";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set — add it to .env.local");

/** Stateless HTTP driver: one fetch per query, parameterized by default. */
export const sql = neon(url);
