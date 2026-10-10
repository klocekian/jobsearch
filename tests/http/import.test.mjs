// /api/jobs/import takes a CSV upload or a Google Sheet — never an arbitrary
// URL, and never a sheet the request didn't name.

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "../helpers/server.mjs";

let app;

before(async () => {
  app = await startApp();
  await app.addUsers({ id: 1, email: "a@test" });
});

after(() => app?.stop());

describe("sheet import", () => {
  it("an empty body is rejected instead of importing a built-in sheet", async () => {
    const res = await app.req("POST", "/api/jobs/import", { body: {} });
    assert.equal(res.status, 400);
    assert.equal((await app.req("GET", "/api/jobs")).data.jobs.length, 0);
  });

  it("URLs outside Google Sheets are refused without being fetched", async () => {
    for (const sheetUrl of ["http://169.254.169.254/latest/meta-data", "https://example.com/export.csv", "http://127.0.0.1:3000/api/jobs", "not a sheet"]) {
      const res = await app.req("POST", "/api/jobs/import", { body: { sheetUrl } });
      assert.equal(res.status, 400, sheetUrl);
      assert.match(res.data.error, /Google Sheets/);
    }
  });

  it("a CSV upload imports, and re-importing skips duplicates", async () => {
    const csvText = "Date,Company,Title,Applied,Notes,Status\n1,Acme,Engineer,Oct 3,,Applied\n2,Globex,PM,,,\n";
    const first = await app.req("POST", "/api/jobs/import", { body: { csvText } });
    assert.deepEqual([first.status, first.data.imported, first.data.skipped], [200, 2, 0]);
    const again = await app.req("POST", "/api/jobs/import", { body: { csvText } });
    assert.deepEqual([again.data.imported, again.data.skipped], [0, 2]);
  });
});
