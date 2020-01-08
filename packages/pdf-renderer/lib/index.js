'use strict'

/**
 * Pdf renderer component for Antora-pdf
 *
 * Sets up an http server to server the contentCatalog. Uses puppeteer to run Chromium headless
 * to load each page to convert and save as pdf.
 *
 * @namespace pdf-renderer
 */
module.exports = require('./converter')
