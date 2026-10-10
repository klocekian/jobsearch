// fetchPublicPage checks every hop, so a public URL can't redirect the server
// onto a private address. The network is faked; literal IPs skip DNS.

import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { UnsafeUrlError, assertPublicUrl, fetchPublicPage, findJobPostingJsonLd } from "@/lib/page-fetch";

const PUBLIC = "http://93.184.216.34";
let routes: Record<string, () => Response> = {};
const requested: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input instanceof Request ? input.url : input);
  requested.push(url);
  const route = routes[url];
  return route ? route() : new Response("not found", { status: 404 });
}) as typeof fetch;
const redirect = (to: string) => () => new Response(null, { status: 302, headers: { location: to } });
const page = (html: string) => () => new Response(html, { status: 200 });
const opts = { timeoutMs: 2000, maxBytes: 1000 };

beforeEach(() => {
  routes = {};
  requested.length = 0;
});

describe("assertPublicUrl", () => {
  it("refuses private, loopback, link-local and non-http targets", async () => {
    for (const url of ["http://127.0.0.1/", "http://10.0.0.5/", "http://169.254.169.254/", "http://[::1]/", "http://[::ffff:192.168.1.1]/", "http://[::ffff:a9fe:a9fe]/", "http://[::127.0.0.1]/", "http://localhost:3000/", "file:///etc/passwd", "nonsense"]) {
      await assert.rejects(assertPublicUrl(url), UnsafeUrlError, url);
    }
  });

  it("allows a public address, including one written as IPv4-mapped IPv6", async () => {
    assert.equal((await assertPublicUrl(`${PUBLIC}/job`)).href, `${PUBLIC}/job`);
    await assertPublicUrl("http://[::ffff:93.184.216.34]/");
  });
});

describe("fetchPublicPage", () => {
  it("follows redirects between public hosts and reports where it ended", async () => {
    routes[`${PUBLIC}/a`] = redirect("/b");
    routes[`${PUBLIC}/b`] = page("<p>hello</p>");
    const res = await fetchPublicPage(`${PUBLIC}/a`, opts);
    assert.deepEqual([res.ok, res.finalUrl, res.body], [true, `${PUBLIC}/b`, "<p>hello</p>"]);
  });

  it("refuses a redirect to a private address without requesting it", async () => {
    routes[`${PUBLIC}/a`] = redirect("http://169.254.169.254/latest/meta-data");
    await assert.rejects(fetchPublicPage(`${PUBLIC}/a`, opts), UnsafeUrlError);
    assert.deepEqual(requested, [`${PUBLIC}/a`]);
  });

  it("gives up after five redirects", async () => {
    for (let i = 0; i < 7; i++) routes[`${PUBLIC}/${i}`] = redirect(`/${i + 1}`);
    await assert.rejects(fetchPublicPage(`${PUBLIC}/0`, opts), /Too many redirects/);
  });

  it("caps the body and passes error statuses through", async () => {
    routes[`${PUBLIC}/big`] = page("x".repeat(5000));
    assert.equal((await fetchPublicPage(`${PUBLIC}/big`, opts)).body.length, 1000);
    const missing = await fetchPublicPage(`${PUBLIC}/missing`, opts);
    assert.deepEqual([missing.ok, missing.status, missing.body], [false, 404, ""]);
  });
});

describe("findJobPostingJsonLd", () => {
  it("finds a JobPosting in a plain block, an array, or an @graph", () => {
    const wrap = (json: unknown) => `<script type="application/ld+json">${JSON.stringify(json)}</script>`;
    const job = { "@type": "JobPosting", title: "Eng" };
    for (const html of [wrap(job), wrap([{ "@type": "Organization" }, job]), wrap({ "@graph": [job] })]) {
      assert.equal(findJobPostingJsonLd(html)?.title, "Eng");
    }
    assert.equal(findJobPostingJsonLd(wrap({ "@type": "Organization" })), null);
  });
});
