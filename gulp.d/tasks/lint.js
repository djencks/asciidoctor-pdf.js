'use strict'

const run = require('../lib/run-command')

module.exports = (files) => () => run('eslint', files)
