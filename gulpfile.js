/**
  * Paths to project folders
*/

let paths = {
	input: 'src/',
	output: 'dist/',
	scripts: {
		input: 'src/js/*',
		output: 'dist/js/'
	},
	styles: {
		input: 'src/sass/**/*.{scss,sass}',
		output: 'dist/css/'
	},
  images: {
    input: 'src/img/**/*',
    output: 'dist/img/'
  },
  previews: {
    input: 'src/img/reviews/**/*',
    output: 'dist/img/previews/'
  },
	copy: {
		input: 'src/copy/**/*',
		output: 'dist/'
	},
  reload: './dist/',
  deploy: {
    src: 'dist/**/*'
  }
};

/**
  * Gulp Packages
*/

// General
const {src, dest, watch, series, parallel} = require('gulp');
const del = require('del');
const flatmap = require('gulp-flatmap');
const lazypipe = require('lazypipe');
const rename = require('gulp-rename');
const notify = require("gulp-notify");

// Styles
const sass = require('gulp-sass');
const prefix = require('gulp-autoprefixer');
const minify = require('gulp-cssnano');

// Images
const imagemin = require('gulp-imagemin');
const imgCompress  = require('imagemin-jpeg-recompress');
const scaleImages = require('gulp-scale-images');

// Scripts
const concat = require('gulp-concat');
const uglify = require('gulp-terser');
const optimizejs = require('gulp-optimize-js');

// BrowserSync
const browserSync = require('browser-sync');

// Other
const ghPages = require('gh-pages');
const htmlValidator = require('gulp-w3c-html-validator');
const flatMap = require('flat-map').default;
const cache = require('gulp-cached');
const config = require('./.config');
const ftp = require('vinyl-ftp');
const gutil = require('gutil');

/**
  * Gulp Tasks
*/

// Remove pre-existing content from output folders
let cleanDist = function (done) {

	// Clean the dist folder
	del.sync([
		paths.output
	]);

	// Signal completion
	return done();

};

// Process, lint, and minify Sass files
let buildStyles = function (done) {

	// Run tasks on all Sass files
	return src(paths.styles.input)
    .pipe(sass({
			outputStyle: 'expanded',
			sourceComments: true
		}).on("error", notify.onError()))
		.pipe(prefix({
			cascade: true,
			remove: true
		}))
		.pipe(dest(paths.styles.output))
		.pipe(rename({suffix: '.min'}))
		.pipe(minify({
			discardComments: {
				removeAll: true
			}
		}))
		.pipe(dest(paths.styles.output));

};

// Optimize Images
let optimizeImages = function (done) {

	return src(paths.images.input)
    .pipe(imagemin([
      imagemin.jpegtran({progressive: true}),
      imgCompress({
				loops: 4,
				min: 70,
				max: 80,
				quality: 'high'
			}),
			imagemin.gifsicle(),
			imagemin.optipng(),
			imagemin.svgo()
    ]))
		.pipe(dest(paths.images.output));

};

// Preview copy
let prev = function(file, cb) {
	const preview = file.clone()
	preview.scale = {maxWidth: 200, maxHeight: 200, format: 'jpg', fit: 'inside'}
	cb(null, [preview])
}

// Generate previews
let generatePrev = function(done) {
  return src(paths.previews.input)
    .pipe(flatMap(prev))
    .pipe(scaleImages())
    .pipe(dest(paths.previews.output));
};

// Repeated JavaScript tasks
let jsTasks = lazypipe()
	.pipe(optimizejs)
	.pipe(dest, paths.scripts.output)
	.pipe(rename, {suffix: '.min'})
	.pipe(uglify)
	.pipe(optimizejs)
	.pipe(dest, paths.scripts.output);

// Lint, minify, and concatenate scripts
let buildScripts = function (done) {

	// Run tasks on script files
	return src(paths.scripts.input)
		.pipe(flatmap(function(stream, file) {

			// If the file is a directory
			if (file.isDirectory()) {

				// Setup a suffix variable
				let suffix = '';

				// Grab all files and concatenate them
				// If separate polyfills enabled, this will have .polyfills in the filename
				src(file.path + '/*.js')
					.pipe(concat(file.relative + suffix + '.js'))
					.pipe(jsTasks());

				return stream;

			}

			// Otherwise, process the file
			return stream.pipe(jsTasks());

		}));

};

// Copy static files into output folder
let copyFiles = function (done) {

	return src(paths.copy.input)
		.pipe(dest(paths.copy.output));

};

// Copy images without optimization
let copyImages = function (done) {
	return src(paths.images.input)
		.pipe(dest(paths.images.output));
};

// Watch for changes to the src directory
let startServer = function (done) {

	// Initialize BrowserSync
	browserSync.init({
		server: {
			baseDir: paths.reload
		}
	});

	// Signal completion
	done();

};

// Reload the browser when files change
let reloadBrowser = function (done) {
	browserSync.reload();
	done();
};

// Watch for changes
let watchSource = function (done) {
	watch(paths.input, series(exports.default, copyImages, reloadBrowser));
	done();
};

let validateHtml = function(done) {
  const handleFile = (file, encoding, callback) => {
    callback(null, file);
    if (!file.w3cjs.success)
      throw Error('HTML validation error(s) found');
  };
  return src(paths.output + '/**/*.html')
    .pipe(htmlValidator())
    .pipe(htmlValidator.reporter());
};

let getFtpConnection = function() {
  return ftp.create({
    host: config.host,
    port: 21,
    user: config.user,
    password: config.password,
    parallel: 5,
    log: gutil.log
  });
};

// Deploy to github pages
let deployGit = function (done) {
  ghPages.publish('dist', function(err) {
    console.log(err);
  });
  return done();
};

// Deploy to FTP
let deployFtp = function (done) {
  const remoteLocation = '/public_html';
  const conn = getFtpConnection();
  return src(paths.deploy.src, {base: 'dist', buffer: false})
    .pipe(conn.dest(remoteLocation))
};

/**
  * Export Tasks
*/

// Default task
// gulp
exports.default = series(
	cleanDist,
	parallel(
    buildScripts,
    buildStyles,
    generatePrev,
		copyFiles
  )
);

//Build website
exports.build = series(
  parallel(
    exports.default,
    optimizeImages
  )
);

// Watch and reload
// gulp watch
exports.watch = series(
  exports.default,
  copyImages,
	startServer,
	watchSource
);

// Deploy site to github pages
// gulp deploy_git
exports.deploy_git = series(
  exports.build,
  validateHtml,
  deployGit
);

// Deploy site to ftp
// gulp deploy_ftp
exports.deploy_ftp = series(
  exports.build,
  validateHtml,
  deployFtp
);
