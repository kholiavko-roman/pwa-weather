const CACHE_NAME = 'PWA-weather';
const FILES_TO_CACHE = [];

self.addEventListener('install', function(evt) {
	evt.waitUntil(
			caches.open(CACHE_NAME).then(function(cache) {
				return cache.addAll(FILES_TO_CACHE);
			})
	)
});
