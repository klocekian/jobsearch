// Settings shared by the capture scripts; run.sh sets them.
export const BASE = process.env.SHOTS_BASE ?? "http://localhost:3471";
export const DB = process.env.SHOTS_DB;
export const COOKIE = process.env.SHOTS_COOKIE; // "jbs_session=<id>.<sig>"
export const OUT = (process.env.SHOTS_OUT ?? new URL("./out/", import.meta.url).pathname).replace(/\/?$/, "/");
if (!DB || !COOKIE) throw new Error("Run through scripts/landing-shots/run.sh (SHOTS_DB and SHOTS_COOKIE are unset).");
