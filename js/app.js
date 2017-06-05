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
			if (dateElem.getAttribute('data-dt') >= data.currently.time) {
				return
			}


			card.querySelector('.description').textContent = data.currently.summary;
			card.querySelector('.date').textContent = new Date(data.currently.time * 1000);
			card.querySelector('.current .icon').classList.add(data.currently.icon);
			card.querySelector('.current .temperature .value').textContent =
					Math.round(data.currently.temperature);
			card.querySelector('.current .feels-like .value').textContent =
					Math.round(data.currently.apparentTemperature);
			card.querySelector('.current .precip').textContent =
					Math.round(data.currently.precipProbability * 100) + '%';
			card.querySelector('.current .humidity').textContent =
					Math.round(data.currently.humidity * 100) + '%';
			card.querySelector('.current .wind .value').textContent =
					Math.round(data.currently.windSpeed);
			card.querySelector('.current .wind .direction').textContent =
					data.currently.windBearing;

			nextDays = card.querySelectorAll('.future .oneday');

			for (let i = 0; i < 7; i++) {
				let nextDay = nextDays[i];
				let daily = data.daily.data[i];

				if (daily && nextDay) {
					nextDay.querySelector('.date').textContent =
							app.daysOfWeek[(i + today) % 7];
					nextDay.querySelector('.icon').classList.add(daily.icon);
					nextDay.querySelector('.temp-high .value').textContent =
							Math.round(daily.temperatureMax);
					nextDay.querySelector('.temp-low .value').textContent =
							Math.round(daily.temperatureMin);
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

		console.log(url);

		// Progressive enhancement
		// Check if caches support in browser check this data in cache
		console.log(" 'caches' in window " + 'caches' in window);
		if ('caches' in window) {
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
			app.getForecast(key);
		});
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
