const CACHE_NAME = 'scorm-player-v1';
const API_CACHE_NAME = 'scorm-api-v1';

// Files to cache on install
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network first, then cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests - network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(API_CACHE_NAME)
              .then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(request)
            .then((cached) => {
              if (cached) {
                return cached;
              }
              // Return offline response
              return new Response(
                JSON.stringify({
                  success: false,
                  error: 'Offline - no cached data available',
                  offline: true,
                }),
                {
                  headers: { 'Content-Type': 'application/json' },
                  status: 503,
                }
              );
            });
        })
    );
    return;
  }

  // SCORM package content - cache first
  if (url.pathname.includes('/content/')) {
    event.respondWith(
      caches.match(request)
        .then((cached) => {
          if (cached) {
            return cached;
          }
          return fetch(request)
            .then((response) => {
              if (response.ok) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => cache.put(request, responseClone));
              }
              return response;
            });
        })
    );
    return;
  }

  // Static assets - cache first
  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request)
          .then((response) => {
            if (response.ok && request.method === 'GET') {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(request, responseClone));
            }
            return response;
          });
      })
  );
});

// Background Sync - sync offline data when connection restored
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-scorm-data') {
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  console.log('Syncing offline data...');
  
  try {
    const response = await fetch('/api/sync/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (response.ok) {
      console.log('Sync successful');
      // Notify all clients
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({
          type: 'sync-complete',
          success: true,
        });
      });
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

// Message handler
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_PACKAGE') {
    // Cache entire SCORM package for offline use
    const { packageId } = event.data;
    event.waitUntil(cachePackage(packageId));
  }
});

async function cachePackage(packageId) {
  console.log(`Caching package ${packageId}...`);
  
  try {
    // Get package info
    const response = await fetch(`/api/packages/${packageId}`);
    const data = await response.json();
    
    if (data.success) {
      const cache = await caches.open(CACHE_NAME);
      
      // Cache package metadata
      await cache.put(
        `/api/packages/${packageId}`,
        new Response(JSON.stringify(data))
      );
      
      console.log(`Package ${packageId} cached successfully`);
    }
  } catch (error) {
    console.error(`Failed to cache package ${packageId}:`, error);
  }
}
