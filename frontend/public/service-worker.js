const CACHE_NAME = 'library-cache-v2';
const DYNAMIC_CACHE_NAME = 'library-dynamic-v2';

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.jpg'
];

// Install Event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME && cache !== DYNAMIC_CACHE_NAME) {
            console.log('Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch Event - Stale While Revalidate strategy
self.addEventListener('fetch', event => {
  // Skip cross-origin requests, like API calls or Google Fonts, for standard caching
  // We only want to cache our own assets and specific API routes if needed
  if (!event.request.url.startsWith(self.location.origin)) {
      return;
  }

  // API calls caching strategy - Network First, falling back to cache
  if (event.request.url.includes('/api/')) {
      event.respondWith(
          fetch(event.request)
            .then(response => {
                return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                    cache.put(event.request.url, response.clone());
                    return response;
                });
            })
            .catch(() => caches.match(event.request))
      );
      return;
  }

  // Static assets caching strategy - Cache First, falling back to network
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(
            response => {
                // Check if we received a valid response
                if(!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(DYNAMIC_CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, responseToCache);
                  });
                return response;
            }
        );
      })
  );
});
