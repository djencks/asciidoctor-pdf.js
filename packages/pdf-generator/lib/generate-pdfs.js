'use strict'

const aggregateContent = require('@antora/content-aggregator')
const buildNavigation = require('@antora/navigation-builder')
const buildPlaybook = require('@antora/playbook-builder')
const convertDocuments = require('@antora/document-converter')
const createPageComposer = require('@antora/page-composer')
const loadUi = require('@antora/ui-loader')
const publishSite = require('@antora/site-publisher')
const { resolveConfig: resolveAsciiDocConfig } = require('@antora/asciidoc-loader')
const classifyContent = require('@antora-pdf/pdf-content-classifier')
const convertToPdf = require('@antora-pdf/pdf-renderer')
const pdfTemplate = require('@antora-pdf/pdf-asciidoc-templates')
const { bodyAttributesProcessor, includeProcessor } = require('@antora-pdf/pdf-asciidoc-templates')
const highlighter = require('asciidoctor-highlight.js')

async function generateSite (args, env) {
  const playbook = buildPlaybook(args, env)
  const asciidocConfig = resolveAsciiDocConfig(playbook)
  const [contentCatalog, uiCatalog] = await Promise.all([
    aggregateContent(playbook).then((contentAggregate) => classifyContent(playbook, contentAggregate, asciidocConfig)),
    loadUi(playbook),
  ])
  if (!asciidocConfig.extensions) asciidocConfig.extensions = []
  asciidocConfig.extensions.push(bodyAttributesProcessor)
  asciidocConfig.extensions.push(highlighter)
  if (!asciidocConfig.converters) asciidocConfig.converters = []
  asciidocConfig.converters.push(pdfTemplate)
  asciidocConfig.includeProcessor = includeProcessor

  const pages = convertDocuments(contentCatalog, asciidocConfig)
  const navigationCatalog = buildNavigation(contentCatalog, asciidocConfig)
  const composePage = createPageComposer(playbook, contentCatalog, uiCatalog, env)
  pages.forEach((page) => composePage(page, contentCatalog, navigationCatalog))
  const pdfPages = await convertToPdf(pages, [contentCatalog, uiCatalog], asciidocConfig)
  pdfPages.filter((pdf) => pdf).map((pdf) => contentCatalog.addFile(pdf))
  return publishSite(playbook, [contentCatalog, uiCatalog])
}

module.exports = generateSite