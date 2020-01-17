'use strict'

/**
 * Content Classifier component for Antora-pdf
 *
 * First, this delegates to the normal Antora content-classifier.
 * Then, this implementation examines the aggregate component descriptors for pdfFiles specification.
 * If any are found, these files are made publishable and all other pages are made non-publishable.
 *
 * @namespace content-classifier
 */
module.exports = require('./pdf-classifier')
