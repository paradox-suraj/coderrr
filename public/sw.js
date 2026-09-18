/**
 * AlgoJeet Pro Offline Service Worker
 * Caches application shell, Pyodide WASM runtime, and Monaco editor assets.
 */

const CACHE_NAME = 'algojeet-v1';
const OFFLINE_STATIC_ASSETS = [
  '/',
  '/problems',
  '/companies',
  '/pyodide/pyodide.js',
  '/pyodide/pyodide.asm.js',
  '/pyodide/pyodide.asm.wasm',
  '/pyodide/python_stdlib.zip',
  '/pyodide/pyodide-lock.json',
  '/monaco/vs/loader.js',
  '/monaco/vs/editor/editor.main.js',
  '/monaco/vs/editor/editor.main.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Non-blocking precache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass non-GET requests and API/Clerk routes
  if (request.method !== 'GET' || url.pathname.startsWith('/api/') || url.hostname.includes('clerk')) {
    return;
  }

  // Network-first with cache fallback for HTML pages; Cache-first for WASM & Monaco
  const isStaticRuntime = url.pathname.startsWith('/pyodide/') || url.pathname.startsWith('/monaco/');

  if (isStaticRuntime) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
  } else {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});
