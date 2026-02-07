const CACHE_NAME = "pwa-v1";
const ASSETS = [
    "/",
    "/index.html",
    "/style.css",
    "/script.js",
    "/icon-192.png" // আইকন না থাকলে এটি এরর দিতে পারে
];

// ১. ইনস্টল ইভেন্ট (ফাইল ক্যাশ করা)
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("Caching assets...");
            return cache.addAll(ASSETS);
        })
    );
});

// ২. ফেচ ইভেন্ট (অফলাইনে ক্যাশ থেকে লোড করা)
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});