import { createClient } from "@libsql/client";
import { DB } from "./env.mjs";

/** The three featured demo jobs. */
export async function getIds() {
  const db = createClient({ url: "file:" + DB });
  const r = await db.execute("SELECT id, company FROM jobs WHERE company IN ('Kestrel AI','Fernway','Tidewell Bank')");
  const by = Object.fromEntries(r.rows.map((x) => [String(x.company), Number(x.id)]));
  db.close();
  return { kestrel: by["Kestrel AI"], fernway: by["Fernway"], tidewell: by["Tidewell Bank"] };
}
