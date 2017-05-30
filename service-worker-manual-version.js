const CACHE_NAME = 'weatherPWA-v22';
const CACHE_DATA_NAME = 'weatherPWA-data-v22';
const FILES_TO_CACHE = [
	'index.html',
	'js/app.js',
	'css/style.css',
	'images/clear.png',
	'images/cloudy-scattered-showers.png',
	'images/cloudy.png',
	'images/fog.png',
	'images/ic_add_white_24px.svg',
	'images/ic_refresh_white_24px.svg',
	'images/partly-cloudy.png',
	'images/rain.png',
	'images/scattered-showers.png',
	'images/sleet.png',
	'images/snow.png',
	'images/thunderstorm.png',
	'images/wind.png'
];
const WEATHER_API_URL = 'https://publicdata-weather.firebaseio.com/';

// Install Service Worker
// Cashes the resources required for the app shell
self.addEventListener('install', function (e) {
	console.log('[ServiceWorker] Install');

	e.waitUntil(
			caches.open(CACHE_NAME).then(function (cache) {
				console.log('[ServiceWorker] Caching app shell');
				return cache.addAll(FILES_TO_CACHE);
			})
	);
});

// Activate event
// Removed old resources form the cache
self.addEventListener('activate', function (e) {
	console.log('[ServiceWorker] Activate');

	e.waitUntil(
			caches.keys().then(function (keyList) {
				return Promise.all(keyList.map(function (key) {
					if (key !== CACHE_NAME && key !== CACHE_DATA_NAME) {
						console.log('[ServiceWorker] Removing old cache', key);
						return caches.delete(key);
					}
				}));
			})
	);
});

// Fetch event
// Attempt return files form cache,
// fallbacks to the network if it`s not available
self.addEventListener('fetch', function (e) {
	let request = e.request;

	console.log('[ServiceWorker] Fetch', request.url);

	console.log(request.url);
	console.log(request.url.startsWith(WEATHER_API_URL));

	if (request.url.startsWith(WEATHER_API_URL)) {
		e.respondWith(
				fetch(request)
						.then(function (response) {
							return caches.open(CACHE_DATA_NAME).then(function (cache) {
								cache.put(request.url, response.clone());
								console.log('[ServiceWorker] Fetch&Cached Data');
								return response;
							})
						})
		)
	} else {
		e.respondWith(
				caches.match(request).then(function (response) {
					return response || fetch(request);
				})
		);
	}
});
