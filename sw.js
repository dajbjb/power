const CACHE_NAME = '1.9.0';
const UPDATE_DESCRIPTION = 'שדרוג 1.9.0: תיקון סנכרון הענן, שחזור מצב אופליין מלא, אבטחת קונסולת הניהול, תיקון כפתורי המשקל והחזרות ושיפורי דיוק במעקב הריצה';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './styles/variables.css',
  './styles/layout.css',
  './styles/navigation.css',
  './styles/components.css',
  './styles/modals.css',
  './styles/auth.css',
  './styles/workouts.css',
  './styles/metrics.css',
  './styles/settings.css',
  './app.js',
  './firebase-config.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './src/state.js',
  './src/utils/storage.js',
  './src/utils/helpers.js',
  './src/auth/auth.js',
  './src/workouts/workouts.js',
  './src/metrics/metrics.js',
  './src/settings/settings.js',
  './src/utils/db.js',
  './src/utils/icons.js',
  './src/utils/onboarding.js',
  './src/settings/admin.js'
  // Firebase SDK files intentionally excluded: served from Google CDN with long cache-control headers.
  // Caching opaque cross-origin responses risks serving corrupted/stale Firebase SDK.
];

let restTimerTimeout = null;

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed. Assets will be cached on-demand.');
  event.waitUntil(Promise.resolve());
});

// Activate state - clean up old caches safely
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Service Worker: Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intercept network requests - Serving Cache-First for Core Assets & Stale-While-Revalidate for others
self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith('http')) return;
  if (event.request.method !== 'GET') return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch (e) {
    return;
  }

  // Firebase / External Auth Exclusions
  const isGoogleFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const isAuthOrFirebase =
    !isGoogleFont && (
      url.hostname.endsWith('firebaseapp.com') ||
      url.hostname.endsWith('firebaseio.com') ||
      url.hostname.endsWith('web.app') ||
      url.hostname.endsWith('googleapis.com') ||
      url.hostname.endsWith('google.com') ||
      url.hostname === 'ssl.gstatic.com' ||
      url.hostname === 'www.gstatic.com' ||
      event.request.url.includes('/__/auth/') ||
      event.request.url.includes('identitytoolkit') ||
      event.request.url.includes('securetoken')
    );

  if (isAuthOrFirebase) {
    return; // Direct network pass-through
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
        if (cachedResponse) {
          // Resolve request path against Scope to verify if it is a Core Shell Asset
          const isCoreAsset = ASSETS.some(asset => {
            const assetUrl = new URL(asset, self.location.href);
            const p1 = url.pathname.replace(/\/$/, '');
            const p2 = assetUrl.pathname.replace(/\/$/, '');
            return p1 === p2;
          });

          if (isCoreAsset) {
            // Serve strictly Cache-First for Core Assets (Prevents overwriting active cache in background)
            return cachedResponse;
          }

          // Stale-While-Revalidate for non-core cached assets (External images, fonts, icons)
          let fetchReq = event.request;
          if (event.request.mode === 'navigate') {
            fetchReq = new Request(event.request.url, {
              method: event.request.method,
              headers: event.request.headers,
              credentials: event.request.credentials,
              redirect: event.request.redirect
            });
          }

          fetch(fetchReq).then((networkResponse) => {
            if (networkResponse.status === 200 || networkResponse.status === 0) {
              cache.put(event.request, networkResponse.clone());
            }
          }).catch(() => { });

          return cachedResponse;
        }

        // Network Fallback for cache miss
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200 || networkResponse.status === 0) {
            const responseClone = networkResponse.clone();
            cache.put(event.request, responseClone);
          }
          return networkResponse;
        }).catch(() => {
          return new Response('Network error and no cache available.', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      });
    })
  );
});

// Support skipWaiting, getVersion & downloadAndActivate messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'scheduleRestNotification') {
    const delayMs = event.data.delayMs;
    if (restTimerTimeout) clearTimeout(restTimerTimeout);
    restTimerTimeout = setTimeout(() => {
      self.registration.showNotification("המנוחה נגמרה! ⏱️💪", {
        body: "הגיע הזמן לסט הבא. קדימה, לעבודה!",
        icon: "./icon-192.png",
        badge: "./icon-192.png",
        vibrate: [300, 150, 300, 150, 300],
        tag: "rest-timer-notification",
        renotify: true
      });
      restTimerTimeout = null;
    }, delayMs);
  }
  if (event.data && event.data.action === 'cancelRestNotification') {
    if (restTimerTimeout) {
      clearTimeout(restTimerTimeout);
      restTimerTimeout = null;
    }
  }

  if (event.data && event.data.action === 'adminForceClearAndDownload') {
    console.log('Service Worker: adminForceClearAndDownload received. Deleting all caches...');
    caches.keys().then((keys) => {
      return Promise.all(keys.map(key => caches.delete(key)));
    }).then(() => {
      return caches.open(CACHE_NAME);
    }).then((cache) => {
      const ts = Date.now();
      const cachePromises = ASSETS.map((url) => {
        const reqUrl = url.includes('?') ? `${url}&t=${ts}` : `${url}?t=${ts}`;
        const request = new Request(reqUrl, { cache: 'reload' });
        return fetch(request).then((response) => {
          if (response.ok || response.status === 0) {
            return cache.put(url, response);
          }
          throw new Error(`Failed to fetch ${url} (status: ${response.status})`);
        });
      });
      return Promise.all(cachePromises);
    }).then(() => {
      console.log('Service Worker: Force download complete. Activating...');
      self.skipWaiting();
    }).catch((err) => {
      console.error('Service Worker: adminForceClearAndDownload failed:', err);
    });
  }

  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data && event.data.action === 'downloadAndActivate') {
    console.log('Service Worker: On-demand download request received. Caching critical assets...');
    caches.open(CACHE_NAME).then((cache) => {
      const cachePromises = ASSETS.map((url) => {
        const request = new Request(url, { cache: 'reload' });
        return fetch(request).then((response) => {
          if (response.ok || response.status === 0) {
            return cache.put(url, response);
          }
          throw new Error(`Failed to fetch ${url} (status: ${response.status})`);
        });
      });
      return Promise.all(cachePromises);
    }).then(() => {
      console.log('Service Worker: On-demand caching completed successfully. Activating...');
      self.skipWaiting();
    }).catch((err) => {
      console.error('Service Worker: On-demand caching failed:', err);
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ action: 'updateFailed' });
        });
      });
    });
  }
  if (event.data && event.data.action === 'getVersion') {
    if (event.ports && event.ports[0]) {
      const cleanVer = CACHE_NAME.replace('aura-app-', '').replace(/^v/, '');
      event.ports[0].postMessage({
        version: cleanVer,
        description: typeof UPDATE_DESCRIPTION !== 'undefined' ? UPDATE_DESCRIPTION : ''
      });
    }
  }
});
