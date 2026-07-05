/**
 * One-time scraper for Dollarama's Canadian store locations.
 *
 * Data source (fully public, keyless):
 *   - Sitemap:   https://www.dollarama.com/en-CA/locations/sitemapxml
 *                lists ~1,756 store-page URLs, one per Canadian store.
 *   - Each store page embeds a single <script type="application/ld+json">
 *     with an @type:"Store" object containing name, address, telephone,
 *     opening hours, and geo { latitude, longitude }.
 *
 * Run once (from the repo root):
 *   bun app/vibes/dollarama-heat-map/scrape-dollarama.ts
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";

// On-disk HTML cache so the scrape is resumable across rate-limit interruptions:
// re-running only fetches pages we don't already have cached.
const CACHE_DIR = path.join(os.tmpdir(), "dollarama-cache");

const SITEMAP_URL = "https://www.dollarama.com/en-CA/locations/sitemapxml";
const OUT_PATH = "public/vibes/dollarama-stores.json";
const UA =
  "Mozilla/5.0 (compatible; personal-website-dollarama-heatmap/1.0; +https://andrewsemchism.com)";
const CONCURRENCY = 2;
const MAX_RETRIES = 8;
const THROTTLE_MS = 350; // min spacing between request starts (politeness)

type Store = {
  name: string;
  city: string;
  province: string; // uppercased path segment, e.g. "ON"
  lat: number;
  lng: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Global throttle: serialize request *starts* to at least THROTTLE_MS apart.
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + THROTTLE_MS;
  if (wait) await sleep(wait);
}

async function fetchText(url: string, retries = MAX_RETRIES): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    await throttle();
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 429 || res.status === 503) {
        // Rate limited — back off hard, honouring Retry-After if given.
        const retryAfter = parseInt(res.headers.get("retry-after") ?? "", 10);
        const backoff = Number.isFinite(retryAfter)
          ? retryAfter * 1000
          : Math.min(30000, 2000 * 2 ** (attempt - 1));
        if (attempt >= retries) throw new Error(`HTTP ${res.status} (gave up)`);
        await sleep(backoff);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt >= retries) throw err;
      await sleep(500 * attempt);
    }
  }
}

/** Pull all store-page URLs out of the sitemap (skip the bare index page). */
function parseSitemap(xml: string): string[] {
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  return urls.filter((u) => /\/locations\/[a-z]{2}\/[^/]+\/?$/.test(u));
}

/** Province code sits in the path: /en-CA/locations/<prov>/<slug>/ */
function provinceFromUrl(url: string): string {
  const m = url.match(/\/locations\/([a-z]{2})\//);
  return m ? m[1].toUpperCase() : "";
}

function field(block: string, key: string): string | undefined {
  // Matches "key": "value" allowing escaped quotes inside the value.
  const m = block.match(
    new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`),
  );
  return m ? m[1] : undefined;
}

/**
 * Extract store fields from the page's JSON-LD block. Dollarama's JSON-LD is
 * NOT valid JSON (stray control chars in the description break JSON.parse), so
 * we pull the specific fields we need with regexes instead.
 */
function parseStore(html: string, url: string): Store | null {
  const block = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
  )?.[1];
  if (!block) return null;

  const latRaw = parseFloat(field(block, "latitude") ?? "");
  const lngRaw = parseFloat(field(block, "longitude") ?? "");
  if (!Number.isFinite(latRaw) || !Number.isFinite(lngRaw)) return null;
  // Canada is entirely in the northern/western hemisphere, so force the signs
  // — some source pages drop the minus on the longitude.
  const lat = Math.abs(latRaw);
  const lng = -Math.abs(lngRaw);

  const city =
    field(block, "addressLocality") ??
    // fall back to slug: /locations/on/london-1030-adelaide-st-n/
    (url.match(/\/locations\/[a-z]{2}\/([a-z-]+?)-\d/)?.[1] ?? "")
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  return {
    name: field(block, "name") ?? "Dollarama",
    city,
    province: field(block, "addressRegion")?.toUpperCase() ?? provinceFromUrl(url),
    lat,
    lng,
  };
}

/** Simple concurrency-limited map. */
async function pool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

/** Fetch a store page, using the on-disk cache when available. */
async function fetchStoreHtml(url: string): Promise<string> {
  const cacheFile = path.join(
    CACHE_DIR,
    crypto.createHash("md5").update(url).digest("hex") + ".html",
  );
  if (fs.existsSync(cacheFile)) return fs.readFileSync(cacheFile, "utf8");
  const html = await fetchText(url);
  fs.writeFileSync(cacheFile, html);
  return html;
}

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`Cache dir: ${CACHE_DIR}`);
  console.log("Fetching sitemap…");
  const sitemap = await fetchText(SITEMAP_URL);
  const urls = parseSitemap(sitemap);
  const cached = fs.readdirSync(CACHE_DIR).length;
  console.log(`Found ${urls.length} store URLs (${cached} already cached).`);

  const failed: string[] = [];
  let done = 0;

  const results = await pool(urls, CONCURRENCY, async (url) => {
    try {
      const html = await fetchStoreHtml(url);
      const store = parseStore(html, url);
      if (!store) failed.push(url);
      return store;
    } catch {
      failed.push(url);
      return null;
    } finally {
      done++;
      if (done % 100 === 0 || done === urls.length) {
        console.log(`  ${done}/${urls.length} pages processed`);
      }
    }
  });

  const stores = results.filter((s): s is Store => s !== null);

  // Stable, deterministic ordering (province, city, name) for clean diffs.
  stores.sort(
    (a, b) =>
      a.province.localeCompare(b.province) ||
      a.city.localeCompare(b.city) ||
      a.name.localeCompare(b.name),
  );

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(stores));

  const byProv = stores.reduce<Record<string, number>>((acc, s) => {
    acc[s.province] = (acc[s.province] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`\nWrote ${stores.length} stores to ${OUT_PATH}`);
  console.log("By province:", byProv);
  if (failed.length) {
    console.log(`\n${failed.length} URLs failed to parse:`);
    failed.slice(0, 20).forEach((u) => console.log("  " + u));
    if (failed.length > 20) console.log(`  … and ${failed.length - 20} more`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
