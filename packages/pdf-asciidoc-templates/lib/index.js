'use strict'

/**
 * Pdf asciidoctor converter template for Antora-pdf
 *
 * Modifies the html5 conversion to suit pdf generation.
 *
 * @namespace pdf-asciidoc-templates
 */
module.exports = require('./templates')
module.exports.bodyAttributesProcessor = require('./body-attributes-processor')
module.exports.includeProcessor = require('./include/include-processor')