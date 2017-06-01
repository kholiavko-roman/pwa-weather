let gulp = require('gulp');
let swPrecache = require('sw-precache');

gulp.task('generate-sw', () => {
	let swOptions = {
		staticFileGlobs: [
			'index.html',
			'js/*.js',
			'css/*.css',
			'images/*.{png,svg,gif,jpg}'
		],
		runtimeCaching: [{
			urlPattern: /^https:\/\/publicdata-weather\.firebaseio\.com/,
			handler: 'networkFirst',
			options: {
				cache: {
					name: 'weatherData-v3'
				}
			}
		}]
	};
	return swPrecache.write('service-worker.js', swOptions);
});

gulp.task('default', ['generate-sw']);