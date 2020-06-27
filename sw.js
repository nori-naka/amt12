const CACHE_NAME = 'cache-v1';
const urlsToCache = [
    './',
    "./beacon.js",
    "./css/ol.css",
    "./css/rtc.css",
    "./css/spectrum.css",
    "./css/style.css",
    "./exif.js",
    "./favicon.ico",
    "./flip.js",
    "./icon-192.png",
    "./index.html",
    "./index_wv.html",
    "./js/jquery.spectrum-ja.js",
    "./js/jquery.tinycolorpicker.min.js",
    "./js/jquery-3.3.1.min.js",
    "./js/ol.js",
    "./js/spectrum.rev.js",
    "./main.js",
    "./manifest.json",
    "./map.js",
    "./modal.css",
    "./modal.js",
    "./node_modules/",
    "./pic/",
    "./RECORD_layer/memo_pin.png",
    "./RECORD_layer/mic.png",
    "./RECORD_layer/record.js",
    "./RECORD_layer/RECORD_layer.js",
    "./RECORD_layer/speech2text.js",
    "./RECORD_layer/video_pin.png",
    "./rhttp.js",
    "./rhttps.js",
    "./rtc.js",
    "./sw.js",
    "./user_list.js",
];

self.addEventListener('install', (event) => {
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('activate', (event) => {
    var cacheWhitelist = [CACHE_NAME];

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {

    if (event.request.url.endsWith('/RECORD_layer/position.json')) {
        return fetch(event.request);
    } else {
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    if (response) {
                        return response;
                    }
    
                    let fetchRequest = event.request.clone();
    
                    return fetch(fetchRequest)
                        .then((response) => {
                            if (!response || response.status !== 200 || response.type !== 'basic') {
                                return response;
                            }
    
                            let responseToCache = response.clone();
    
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
    
                            return response;
                        });
                })
        );    
    }
});