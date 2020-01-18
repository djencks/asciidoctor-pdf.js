'use strict'

const opts = require('yargs-parser')(process.argv.slice(2))

const { series } = require('gulp')
const createTask = require('./gulp.d/lib/create-task')
const exportTasks = require('./gulp.d/lib/export-tasks')

const { format, lint, test } = require('./gulp.d/tasks')
const glob = opts.package
  ? {
    sourceFiles: [`packages/${opts.package}/{lib,test}/**/*.js`],
    testFiles: [`packages/${opts.package}/test/**/*-test.js`],
  }
  : {
    sourceFiles: ['gulpfile.js', '{gulp.d,lib-example,scripts,test}/**/*.js', 'packages/*/{lib,test}/**/*.js'],
    testFiles: ['test/**/*-test.js', 'packages/*/test/**/*-test.js'],
  }
const sharedOpts = { '--package <name>': 'Only run on files in the specified package' }

const lintTask = createTask({
  name: 'lint',
  desc: 'Lint JavaScript files using eslint (JavaScript Standard profile)',
  opts: sharedOpts,
  call: lint(glob.sourceFiles),
})

const formatTask = createTask({
  name: 'format',
  desc: 'Format JavaScript files using prettier (JavaScript Standard profile)',
  opts: sharedOpts,
  // convert globs to absolute path to workaround https://github.com/prettier/prettier-eslint-cli/issues/208
  call: format(glob.sourceFiles.map((it) => `${__dirname}/${it}`)),
})

const testTask = createTask({
  name: 'test',
  desc: 'Run the test suite',
  opts: { ...sharedOpts, '--watch': 'Watch files and run the test suite whenever a file is changed' },
  call: test(glob.testFiles, process.env.COVERAGE === 'true' || process.env.CI),
  loop: opts.watch ? glob.sourceFiles : false,
})

const buildTask = createTask({
  name: 'build',
  desc: 'Run the test suite followed by the linter',
  opts: sharedOpts,
  call: series(testTask, lintTask),
})

module.exports = exportTasks(buildTask, buildTask, lintTask, formatTask, testTask)
