
const CACHE_NAME = 'acordeskey-v2';
const DYNAMIC_CACHE = 'acordeskey-dynamic-v2';

// Assets we definitely want to cache immediately
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: Cache static core files
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force activation immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== DYNAMIC_CACHE) {
            console.log('[SW] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim()) // Control clients immediately
  );
});

// Fetch: The Brains of Offline Support
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Handle HTML (Navigation) - Network First, fallback to Cache
  // This ensures users get the latest version if online
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          return caches.match('./index.html');
        })
    );
    return;
  }

  // 2. Handle JS, CSS, Images, Fonts - Cache First, fallback to Network
  // Once downloaded, we serve from cache for speed and offline access
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2)$/) ||
    url.href.includes('cdn.tailwindcss.com') ||
    url.href.includes('aistudiocdn.com')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          return caches.open(DYNAMIC_CACHE).then((cache) => {
            // Only cache valid responses
            if(networkResponse.status === 200) {
               cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // 3. Handle Audio Files (MP3/WAV) - Cache First
  if (url.pathname.match(/\.(mp3|wav)$/)) {
     event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request).then((networkResponse) => {
          return caches.open(DYNAMIC_CACHE).then((cache) => {
             cache.put(event.request, networkResponse.clone());
             return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Default: Network only
  event.respondWith(fetch(event.request));
});
