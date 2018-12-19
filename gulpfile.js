var gulp = require("gulp")
var change = require("gulp-change")
var concat = require("gulp-concat")
var shell = require("gulp-shell")
var svgmin = require("gulp-svgmin")
var raster = require("gulp-raster")
var rename = require("gulp-rename")
var sort = require("gulp-sort")
var zip = require("gulp-zip")
var runSequence = require("run-sequence")
var fs = require('fs')
var _ = require('lodash')

var config = {
  glob: '**/*.svg',
  src: 'src',
  optimized: 'svgs',
  pngs: 'pngs',
  dist: 'dist',
  javascript: './',
  bundle: './entypo.js',
  zip: 'entypo-icons.zip',
  preview: './preview.svg',
  svgmin: {
    plugins: [{'removeTitle': true}]
  }
}

var prequel = "(function() {\r\n" +
              "var EntypoIcons = {\r\n"
var sequel  = "\r\n" +
              "}\r\n" +
              "EntypoIcons.all = function() {\r\n" +
              "  var icons = []\r\n" +
              "  for (name in EntypoIcons) {\r\n" +
              "    if (EntypoIcons.hasOwnProperty(name) && typeof EntypoIcons[name] !== 'function') {\r\n" +
              "      icons.push(EntypoIcons[name])\r\n" +
              "    }\r\n" +
              "  }\r\n" +
              "  return icons\r\n" +
              "}\r\n" +
              "if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {\r\n" +
              "  module.exports = EntypoIcons\r\n" +
              "} else {\r\n" +
              "  window.EntypoIcons = EntypoIcons\r\n" +
              "}\r\n" +
              "})();"

gulp.task('clean-optimized', shell.task('rm -Rf ' + config.optimized + '/*'))
gulp.task('clean-javascript', shell.task('rm -Rf ' + config.bundle))
gulp.task('clean-pngs', shell.task('rm -Rf ' + config.pngs))

gulp.task('clean', ['clean-optimized', 'clean-javascript'])

gulp.task('optimize', ['clean-optimized'], function() {
  return gulp.src(config.src + '/' + config.glob)
    .pipe(svgmin(config.svgmin))
    .pipe(gulp.dest(config.optimized))
})

gulp.task('javascript', ['clean-javascript', 'optimize'], function() {
  var icons = require('./data/icons')
  var titlecase = function(string) {
    var words = string.split(/-|\s/)
    for (var i = 0; i < words.length; i++) {
      var word = words[i]
      if (i > 0 && ['a', 'an', 'the', 'of', 'and'].includes(word)) { continue }
      words[i] = word.charAt(0).toUpperCase() + word.slice(1)
    }
    return words.join(" ")
  }
  var extractName = function(slug, lookup) {
    var object = lookup[slug]
    if (object && 'name' in object) { return object['name'] }
    return titlecase(slug)
  }
  var prettyPrint = function(object) {
    result = []
    for (key in object) {
      if (object.hasOwnProperty(key)) {
        var value = object[key]
        var valueString = Array.isArray(value) ? "['" + value.join("', '") + "']" : JSON.stringify(value)
        if (valueString === "['']") { valueString = '[]' }
        result.push(
          key + ': ' +
          valueString
        )
      }
    }
    return '{ ' + result.join(', ') + ' }'
  }
  return gulp.src([config.optimized + '/' + config.glob])
    .pipe(sort())
    .pipe(change(function(content) {
      /<svg.*?>([.]*)<\/svg>/g.test(content)
      var paths = content
            .replace(/<svg.*?>/g, '')
            .replace(/ fill="[^"]*"/g, '')
            .replace(/<def>.*?<\/def>/g, '')           // def and clipPath
            .replace(/<clipPath.*?<\/clipPath>/g, '')
            .replace(/<\/svg>/g, '')
            .trim()
      var parts = this.fname.split("/")
      var slug = parts[0].replace(/\.svg$/, '')
      var name = extractName(slug, icons) 
      var keywords = icons[slug] ? icons[slug].keywords || [] : []
      var object = {
        name: name,
        paths: paths,
      }
      if (keywords.length) { object.keywords = keywords }
      return "  '" + slug + "': " + prettyPrint(object)
    }))
    .pipe(concat(config.bundle, {newLine: ",\r\n"}))
    .pipe(change(function(content) {
      return prequel + content + sequel
    }))
    .pipe(gulp.dest(config.javascript))
})

gulp.task('preview-svg', ['javascript'], function(done) {
  var EntypoIcons = require(config.bundle)
  var size = 20
  var svg = []
  var row = 1
  var col = 1
  var maxCol = 41
  var icons = _.sortBy(EntypoIcons.all(), 'name')
  icons.forEach(function(icon) {
    svg.push('<g id="Icons/Entypo/' + icon.name + '" transform="translate(' + size * col + ', ' + size * row + ')"><rect x="0" y="0" width="' + size + '" height="' + size + '" fill="#e5e5e5" /><g transform="scale(0.0' + size + ')">' + icon.paths + '</g></g>')
    col += 2
    if (col >= maxCol) {
      row += 2
      col = 1
    }
  })
  var width = size * maxCol
  var height = size * (row + 2)
  svg.unshift('<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="#f5f5f5" />')
  svg.unshift('<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height +'" xmlns="http://www.w3.org/2000/svg">')
  svg.push('</svg>')
  fs.writeFile(config.preview, svg.join("\r\n"), done)
})

gulp.task('preview-png', ['preview-svg'], function() {
  return gulp.src(config.preview)
    .pipe(raster({scale: 2}))
    .pipe(rename({extname: '.png'}))
    .pipe(gulp.dest('./'))
})

gulp.task('preview', ['preview-svg', 'preview-png'])

gulp.task('pngs@1x', function() {
  return gulp.src(config.src + '/' + config.glob)
    .pipe(raster())
    .pipe(rename({extname: '.png'}))
    .pipe(gulp.dest(config.pngs))
})

gulp.task('pngs@2x', function() {
  return gulp.src(config.src + '/' + config.glob)
    .pipe(raster({scale: 2}))
    .pipe(rename({suffix: '@2x', extname: '.png'}))
    .pipe(gulp.dest(config.pngs))
})

gulp.task('pngs', ['clean-pngs'], function(done) {
  runSequence('pngs@1x', 'pngs@2x', done)
})

gulp.task('release', function() {
  return gulp.src([
      config.optimized + '/' + config.glob,
      config.pngs + '/**/*.png',
      config.bundle,
      'LICENSE.md'
    ])
    .pipe(zip(config.zip))
    .pipe(gulp.dest(config.dist))
})
