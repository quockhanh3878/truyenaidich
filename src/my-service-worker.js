/* eslint-disable no-restricted-globals */
const CACHE_NAME = "truyen-ai-dich-cache-v2";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/logo192.png",
  "/logo512.png",
  "/static/css/*.css",
  "/static/js/*.js"
];

// Cài đặt Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Kích hoạt Service Worker
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event để phục vụ từ cache
self.addEventListener("fetch", (event) => {
  const { request } = event;
  
  // Chỉ cache GET requests
  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Trả về từ cache nếu có
      if (cachedResponse) {
        return cachedResponse;
      }

      // Nếu không có trong cache, fetch từ mạng
      return fetch(request).then((response) => {
        // Không cache response lỗi
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        // Clone response để lưu vào cache
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      });
    })
  );
});