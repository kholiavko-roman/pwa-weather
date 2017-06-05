(function () {
	'use strict';
	// Progressive web app should be reliable, fast and engaging.

	// Progressive enhancement register service worker
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('service-worker.js')
				.then(function (result) {
					console.log('Service Worker Registered', result);
				});
	}

	let app = {
		isLoading: true,
		visibleCards: {},
		selectedCities: [],
		spinner: document.querySelector('.loader'),
		cardTemplate: document.querySelector('.cardTemplate'),
		container: document.querySelector('.main'),
		addDialog: document.querySelector('.dialog-container'),
		daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
		hasRequestPending: false
	};
	let db;

	const WEATHER_API_URL = 'https://query.yahooapis.com/v1/public/yql?format=json&q=select%20*%20from%20weather.forecast%20where%20woeid=$$CITY_ID$$%20and%20u=%27c%27';
	const DB_NAME = 'pwa-weather';
	const DB_VERSION = 1;
	const DB_STORE_NAME = 'cities';
	const DEFAULT_CITY_KEY = '924938';
	const DEFAULT_CITY_LABEL = 'Kyiv, UA';

	/*****************************************************************************
	 *
	 * Event listeners for UI elements
	 *
	 ****************************************************************************/

	/* Event listener for refresh button */
	document.getElementById('butRefresh').addEventListener('click', function () {
		app.updateForecasts();
	});

	/* Event listener for add new city button */
	document.getElementById('butAdd').addEventListener('click', function () {
		// Open/show the add new city dialog
		app.toggleAddDialog(true);
	});

	/* Event listener for add city button in add city dialog */
	document.getElementById('butAddCity').addEventListener('click', function () {
		let select = document.getElementById('selectCityToAdd');
		let selected = select.options[select.selectedIndex];
		let key = selected.value;
		let label = selected.textContent;
		let selectedCity = {key: key, label: label};

		app.selectedCities.push(selectedCity);
		app.getForecast(key, label);
		app.saveSities(selectedCity);
		app.toggleAddDialog(false);
	});

	/* Event listener for cancel button in add city dialog */
	document.getElementById('butAddCancel').addEventListener('click', function () {
		app.toggleAddDialog(false);
	});


	/*****************************************************************************
	 *
	 * Methods to update/refresh the UI
	 *
	 ****************************************************************************/

		// Toggles the visibility of the add new city dialog.
	app.toggleAddDialog = function (visible) {
		if (visible) {
			app.addDialog.classList.add('dialog-container--visible');
		} else {
			app.addDialog.classList.remove('dialog-container--visible');
		}
	};

	// Updates a weather card with the latest weather forecast. If the card
	// doesn't already exist, it's cloned from the template.
	app.updateForecastCard = function (data) {
		let card = app.visibleCards[data.key];
		let today = new Date().getDay();
		let dataLastUpdated = new Date(data.query.created);
		let sunrise = data.query.results.channel.astronomy.sunrise;
		let sunset = data.query.results.channel.astronomy.sunset;
		let current = data.query.results.channel.item.condition;
		let humidity = data.query.results.channel.atmosphere.humidity;
		let wind = data.query.results.channel.wind;
		let nextDays;

		if (!card) {
			card = app.cardTemplate.cloneNode(true);
			card.classList.remove('cardTemplate');
			card.querySelector('.location').textContent = data.label;
			card.removeAttribute('hidden');
			app.container.appendChild(card);
			app.visibleCards[data.key] = card;

			// Verify data is newer then what we already have, if not - return
			let dateElem = card.querySelector('.date');

			console.log(dateElem.getAttribute('data-dt'));
			console.log(dataLastUpdated);

			console.log(dateElem.getAttribute('data-dt') >= dataLastUpdated);

			if (dateElem.getAttribute('data-dt') >= dataLastUpdated) {
				console.log('RETURN');
				return;
			}

			dateElem.setAttribute('data-dt', data.query.created);

			card.querySelector('.description').textContent = current.text;
			card.querySelector('.date').textContent = current.date;
			card.querySelector('.current .icon').classList.add(app.getIconClass(current.code));
			card.querySelector('.current .temperature .value').textContent =
					Math.round(current.temp);
			card.querySelector('.current .sunrise').textContent = sunrise;
			card.querySelector('.current .sunset').textContent = sunset;
			card.querySelector('.current .humidity').textContent =
					Math.round(humidity) + '%';
			card.querySelector('.current .wind .value').textContent =
					Math.round(wind.speed);
			card.querySelector('.current .wind .direction').textContent =
					wind.direction;

			nextDays = card.querySelectorAll('.future .oneday');

			for (let i = 0; i < 7; i++) {
				let nextDay = nextDays[i];
				let daily = data.query.results.channel.item.forecast[i];

				if (daily && nextDay) {
					nextDay.querySelector('.date').textContent =
							app.daysOfWeek[(i + today) % 7];
					nextDay.querySelector('.icon').classList.add(app.getIconClass(daily.code));
					nextDay.querySelector('.temp-high .value').textContent =
							Math.round(daily.high);
					nextDay.querySelector('.temp-low .value').textContent =
							Math.round(daily.low);
				}
			}

			if (app.isLoading) {
				app.spinner.setAttribute('hidden', true);
				app.container.removeAttribute('hidden');
				app.isLoading = false;
			}
		}
	};


	/*****************************************************************************
	 *
	 * Methods for dealing with the model
	 *
	 ****************************************************************************/

		// Gets a forecast for a specific city and update the card with the data
	app.getForecast = function (key, label) {
		let url = WEATHER_API_URL.replace('$$CITY_ID$$', key);

		// Progressive enhancement
		// Check if caches support in browser check this data in cache
		if ('caches' in window) {

			caches.match(url).then(function (json) {
				console.log(json)
			});


			caches.match(url).then(function (response) {

				if (response) {
					response.json().then(function (json) {

						// Only update if the XHR is still pending
						// This help to avoid rewrite fresh data
						// form network request byt old caches data
						if (app.hasRequestPending) {
							json.key = key;
							json.label = label;
							app.updateForecastCard(json);
						}
					});
				}
			});
		}

		let request = new XMLHttpRequest();

		app.hasRequestPending = true;

		request.onreadystatechange = function () {
			if (request.readyState === XMLHttpRequest.DONE
					&& request.status === 200) {
				let response = JSON.parse(request.response);

				response.key = key;
				response.label = label;
				app.updateForecastCard(response);
				app.hasRequestPending = false;
			}
		};

		request.open('GET', url);
		request.send();
	};

	// Iterate all of the cards and attempt to get the latest forecast data
	app.updateForecasts = function () {
		let keys = Object.keys(app.visibleCards);

		keys.forEach(function (key) {
			console.log(key);
			app.getForecast(key);
		});
	};

	// Get icon class by yahoo weather code
	app.getIconClass = function (code) {
		// Weather codes: https://developer.yahoo.com/weather/documentation.html#codes
		let weatherCode = parseInt(code);

		switch (weatherCode) {
			case 25: // cold
			case 32: // sunny
			case 33: // fair (night)
			case 34: // fair (day)
			case 36: // hot
			case 3200: // not available
				return 'clear-day';
			case 0: // tornado
			case 1: // tropical storm
			case 2: // hurricane
			case 6: // mixed rain and sleet
			case 8: // freezing drizzle
			case 9: // drizzle
			case 10: // freezing rain
			case 11: // showers
			case 12: // showers
			case 17: // hail
			case 35: // mixed rain and hail
			case 40: // scattered showers
				return 'rain';
			case 3: // severe thunderstorms
			case 4: // thunderstorms
			case 37: // isolated thunderstorms
			case 38: // scattered thunderstorms
			case 39: // scattered thunderstorms (not a typo)
			case 45: // thundershowers
			case 47: // isolated thundershowers
				return 'thunderstorms';
			case 5: // mixed rain and snow
			case 7: // mixed snow and sleet
			case 13: // snow flurries
			case 14: // light snow showers
			case 16: // snow
			case 18: // sleet
			case 41: // heavy snow
			case 42: // scattered snow showers
			case 43: // heavy snow
			case 46: // snow showers
				return 'snow';
			case 15: // blowing snow
			case 19: // dust
			case 20: // foggy
			case 21: // haze
			case 22: // smoky
				return 'fog';
			case 24: // windy
			case 23: // blustery
				return 'wind';
			case 26: // cloudy
			case 27: // mostly cloudy (night)
			case 28: // mostly cloudy (day)
			case 31: // clear (night)
				return 'cloudy';
			case 29: // partly cloudy (night)
				return 'partly-cloudy-night';
			case 30: // partly cloudy (day)
			case 44: // partly cloudy
				return 'partly-cloudy-day';
		}
	};

	// Open db
	app.openDb = function () {
		console.log("openDb ...");
		let req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onsuccess = function (evt) {
			// Better use "this" than "req" to get the result to avoid problems with
			// garbage collection.
			// db = req.result;
			db = this.result;
			console.log("openDb DONE");
			app.getCities();
		};

		req.onerror = function (evt) {
			console.error("openDb:", evt.target.errorCode);
		};

		req.onupgradeneeded = function (evt) {
			console.log("openDb.onupgradeneeded");
			let store = evt.currentTarget.result.createObjectStore(
					DB_STORE_NAME, {keyPath: 'id', autoIncrement: true});

			store.createIndex('key', 'key', {unique: true});
			store.createIndex('label', 'name', {unique: false});
		};
	};

	// Save cities to idexedDB
	app.saveSities = function (obj) {
		let store = this.getObjectStore(DB_STORE_NAME, 'readwrite');

		// Use put instead add, because, if value already exist,
		// put just update record, adn we don`t need additional validation.
		let req = store.put(obj);

		req.onsuccess = function (event) {
			console.log("Insertion in DB successful");
		};

	};

	app.getCities = function () {
		let store = app.getObjectStore(DB_STORE_NAME, 'readonly');
		let req = store.openCursor();

		req.onsuccess = function (evt) {
			let req = store.count();

			// Get count of saved cities
			req.onsuccess = function (event) {
				let count = event.target.result;

				// If count than get records from db
				if (count > 0) {
					let cursor = evt.target.result;

					if (cursor) {
						let req = store.get(cursor.key);

						req.onsuccess = function (event) {
							let value = event.target.result;
							let key = value.key;
							let label = value.label;

							app.getForecast(key, label);
							app.selectedCities.push({key: key, label: label});
						}

						// Move on to the next object in store
						cursor.continue();
					}

				} else {
					// If db empty - display default city
					app.selectedCities.push({key: DEFAULT_CITY_KEY, label: DEFAULT_CITY_LABEL});
					app.getForecast(DEFAULT_CITY_KEY, DEFAULT_CITY_LABEL);
				}
			}


		};

	};

	/**
	 * @param {string} store_name
	 * @param {string} mode either "readonly" or "readwrite"
	 */
	app.getObjectStore = function (storeName, mode) {
		let tx = db.transaction(DB_STORE_NAME, mode);
		return tx.objectStore(storeName);
	};


	// Open db and get cities form db
	app.openDb();


})();
