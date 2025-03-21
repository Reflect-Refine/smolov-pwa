// Service Worker for Smolov PWA

const CACHE_NAME = 'smolov-pwa-v3';
const assets = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/db.js',
    './js/stats.js',
    './js/analytics.js',
    './manifest.json',
    './images/icon-192x192.svg',
    './images/icon-512x512.svg',
    'https://cdn.jsdelivr.net/npm/chart.js' // For statistics charts
];

// Install event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(assets);
            })
            .then(() => self.skipWaiting())
            .then(() => {
                // Send message to client to track installation
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'INSTALLATION_TRACKING'
                        });
                    });
                });
            })
    );
});

// Activate event
self.addEventListener('activate', event => {
    // Remove old caches
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Fetch event
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .catch(() => caches.match(event.request))
    );
});
