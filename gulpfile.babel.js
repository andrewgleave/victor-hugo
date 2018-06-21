import { spawn } from 'child_process';

import hugoBin from 'hugo-bin';
import webpack from 'webpack';
import BrowserSync from 'browser-sync';
import del from 'del';

import gulp from 'gulp';
import gutil from 'gulp-util';
import flatten from 'gulp-flatten';
import postcss from 'gulp-postcss';
import hash from 'gulp-hash';

import cssImport from 'postcss-import';
import postcssSimpleVars from 'postcss-simple-vars';
import postcssPresetEnv from 'postcss-preset-env';
import postcssMixins from 'postcss-mixins';

// Import webpack conf based on NODE_ENV
const webpackConfig = require(`./webpack-${
  process.env.NODE_ENV === 'development' ? 'dev' : 'production'
}.conf`).default;

const browserSync = BrowserSync.create();

// Hugo arguments
const hugoArgsDefault = ['-d', '../dist', '-s', 'site', '-v'];
const hugoArgsPreview = ['--buildDrafts', '--buildFuture'];

// Init
gulp.task('init', () => {
  del('.git');
  exec('git init');
});

// Development tasks
gulp.task('hugo', cb => buildSite(cb));
gulp.task('hugo-preview', cb => buildSite(cb, hugoArgsPreview));

// Run server tasks
gulp.task('server', ['hugo', 'css', 'images', 'js', 'fonts'], cb =>
  runServer(cb)
);
gulp.task(
  'server-preview',
  ['hugo-preview', 'css', 'images', 'js', 'fonts'],
  cb => runServer(cb)
);

// Build/production tasks
gulp.task('build', ['css', 'images', 'js', 'fonts'], cb =>
  buildSite(cb, [], 'production')
);
gulp.task('build-preview', ['css', 'images', 'js', 'fonts'], cb =>
  buildSite(cb, hugoArgsPreview, 'production')
);

// Compile CSS with PostCSS
gulp.task('css', () => {
  del(['dist/css/**/*']);
  gulp
    .src('./src/css/*.css')
    .pipe(
      postcss([
        cssImport({ from: './src/css/main.css' }),
        postcssMixins(),
        postcssSimpleVars(),
        postcssPresetEnv({
          stage: '1',
          browsers: 'last 20 versions'
        })
      ])
    )
    .pipe(hash())
    .pipe(gulp.dest('dist/css'))
    .pipe(hash.manifest('site/data/assets.json'))
    //Put the map in the data directory
    .pipe(gulp.dest('.'))
    .pipe(browserSync.stream());
});

// Hash images
gulp.task('images', () => {
  del(['dist/img/**/*']);
  gulp
    .src('./src/img/**/*')
    .pipe(hash())
    .pipe(gulp.dest('./dist/img'))
    .pipe(hash.manifest('site/data/assets.json'))
    .pipe(gulp.dest('.'));
});

// Compile Javascript
gulp.task('js', cb => {
  del(['dist/js/**/*']);
  const myConfig = Object.assign({}, webpackConfig, {
    mode: process.env.NODE_ENV
  });
  webpack(myConfig, (err, stats) => {
    if (err) throw new gutil.PluginError('webpack', err);
    gutil.log(
      '[webpack]',
      stats.toString({
        colors: true,
        progress: true
      })
    );
    gulp
      .src('./dist/js/**/*')
      .pipe(hash())
      .pipe(gulp.dest('./dist/js'))
      .pipe(hash.manifest('site/data/assets.json'))
      .pipe(gulp.dest('.'));
    browserSync.reload();
    cb();
  });
});

// Move all fonts in a flattened directory
gulp.task('fonts', () => {
  del(['dist/fonts/**/*']);
  gulp
    .src('./src/fonts/**/*')
    .pipe(flatten())
    .pipe(gulp.dest('./dist/fonts'))
    .pipe(browserSync.stream());
});

// Development server with browsersync
function runServer() {
  browserSync.init({
    server: {
      baseDir: './dist'
    }
  });
  gulp.watch('src/js/**/*.js', ['js']);
  gulp.watch('src/css/**/*.css', ['css']);
  gulp.watch('src/fonts/**/*', ['fonts']);
  gulp.watch('src/img/**/*', ['images']);
  gulp.watch('site/**/*', ['hugo']);
}

/**
 * Run hugo and build the site
 */
function buildSite(cb, options, environment = 'development') {
  const args = options ? hugoArgsDefault.concat(options) : hugoArgsDefault;

  process.env.NODE_ENV = environment;

  return spawn(hugoBin, args, { stdio: 'inherit' }).on('close', code => {
    if (code === 0) {
      browserSync.reload();
      cb();
    } else {
      browserSync.notify('Hugo build failed :(');
      cb('Hugo build failed');
    }
  });
}
