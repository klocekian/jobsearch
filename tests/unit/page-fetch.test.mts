// fetchPublicPage checks every hop, so a public URL can't redirect the server
// onto a private address, and connects only to the addresses it checked. The
// transport is faked (literal IPs skip DNS); httpTransport is exercised against
// a local server.

import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import zlib from "node:zlib";
import type { AddressInfo } from "node:net";
import {
  UnsafeUrlError, assertPublicUrl, fetchPublicPage, findJobPostingJsonLd, httpTransport, type Hop, type Transport,
} from "@/lib/page-fetch";

const PUBLIC = "http://93.184.216.34";
let routes: Record<string, () => Hop> = {};
const requested: { url: string; addresses: string[] }[] = [];
const fake: Transport = async (url, addresses) => {
  requested.push({ url: url.href, addresses: addresses.map((a) => a.address) });
  return (routes[url.href] ?? (() => reply(404, "not found")))();
};
function reply(status: number, body: string, location: string | null = null): Hop {
  const bytes = Buffer.from(body);
  return { status, location, read: async (max) => bytes.subarray(0, max), discard: () => {} };
}
const redirect = (to: string) => () => reply(302, "", to);
const page = (html: string) => () => reply(200, html);
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
    const res = await fetchPublicPage(`${PUBLIC}/a`, opts, fake);
    assert.deepEqual([res.ok, res.finalUrl, res.body], [true, `${PUBLIC}/b`, "<p>hello</p>"]);
  });

  it("refuses a redirect to a private address without requesting it", async () => {
    routes[`${PUBLIC}/a`] = redirect("http://169.254.169.254/latest/meta-data");
    await assert.rejects(fetchPublicPage(`${PUBLIC}/a`, opts, fake), UnsafeUrlError);
    assert.deepEqual(requested.map((r) => r.url), [`${PUBLIC}/a`]);
  });

  it("gives up after five redirects", async () => {
    for (let i = 0; i < 7; i++) routes[`${PUBLIC}/${i}`] = redirect(`/${i + 1}`);
    await assert.rejects(fetchPublicPage(`${PUBLIC}/0`, opts, fake), /Too many redirects/);
  });

  it("caps the body and passes error statuses through", async () => {
    routes[`${PUBLIC}/big`] = page("x".repeat(5000));
    assert.equal((await fetchPublicPage(`${PUBLIC}/big`, opts, fake)).body.length, 1000);
    const missing = await fetchPublicPage(`${PUBLIC}/missing`, opts, fake);
    assert.deepEqual([missing.ok, missing.status, missing.body], [false, 404, ""]);
  });
});

describe("pinning", () => {
  it("hands the transport exactly the addresses that were checked", async () => {
    routes[`${PUBLIC}/a`] = page("ok");
    await fetchPublicPage(`${PUBLIC}/a`, opts, fake);
    assert.deepEqual(requested, [{ url: `${PUBLIC}/a`, addresses: ["93.184.216.34"] }]);
  });

  it("httpTransport connects to the pinned address without looking the host up", async () => {
    const server = http.createServer((req, res) => {
      if (req.url === "/gz") {
        res.writeHead(200, { "Content-Encoding": "gzip" });
        res.end(zlib.gzipSync("compressed hello"));
      } else {
        res.end(`host=${req.headers.host}`);
      }
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as AddressInfo;
    try {
      // .invalid never resolves, so a response proves the pinned address was used.
      const pinned = [{ address: "127.0.0.1", family: 4 }];
      const signal = new AbortController().signal;
      const hop = await httpTransport(new URL(`http://jobs.invalid:${port}/`), pinned, { headers: {}, signal });
      assert.equal((await hop.read(1000)).toString(), `host=jobs.invalid:${port}`);
      const gz = await httpTransport(new URL(`http://jobs.invalid:${port}/gz`), pinned, { headers: {}, signal });
      assert.equal((await gz.read(1000)).toString(), "compressed hello");
    } finally {
      server.close();
    }
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
