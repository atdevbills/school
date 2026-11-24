/* sw.js — service worker for the school site (works under /school/ on GitHub Pages). */
const CACHE_VERSION = "v3";
const CACHE = "Day Star-" + CACHE_VERSION;

const SHELL = [
  "/school/", 
  "/school/index.html", 
  "/school/notice.html", 
  "/school/admin.html",
  "/school/style.css", 
  "/school/notice-style.css", 
  "/school/admin-style.css",
  "/school/theme.js", 
  "/school/script.js", 
  "/school/notice-script.js", 
  "/school/admin-script.js", 
  "/school/supabase-config.js",
  "/school/manifest.json", 
  "/school/admin-manifest.json",
  "/school/favicon.png", 
  "/school/icon-192.png", 
  "/school/icon-512.png"
];

const CDN_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CDN_HOSTS.includes(url.hostname)) return;

  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && (res.status === 200 || res.type === "opaque")) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === "navigate") {
      const home = await cache.match("/school/index.html");
      if (home) return home;
    }
    throw err;
  }
}