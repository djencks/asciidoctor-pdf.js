'use strict'

const aggregateContent = require('@antora/content-aggregator')
const buildNavigation = require('@antora/navigation-builder')
const buildPlaybook = require('@antora/playbook-builder')
const classifyContent = require('@antora/content-classifier')
const convertDocuments = require('@antora/document-converter')
const createPageComposer = require('@antora/page-composer')
const loadUi = require('@antora/ui-loader')
// const mapSite = require('@antora/site-mapper')
// const produceRedirects = require('@antora/redirect-producer')
const publishSite = require('@antora/site-publisher')
const { resolveConfig: resolveAsciiDocConfig } = require('@antora/asciidoc-loader')
// const { resolveConfig: resolveAsciiDocConfig } = require('./../../../antora/antora/packages/asciidoc-loader')
const convertToPdf = require('@antora-pdf/pdf-renderer')

async function generateSite (args, env) {
  const playbook = buildPlaybook(args, env)
  const asciidocConfig = resolveAsciiDocConfig(playbook)
  const [contentCatalog, uiCatalog] = await Promise.all([
    aggregateContent(playbook).then((contentAggregate) => classifyContent(playbook, contentAggregate, asciidocConfig)),
    loadUi(playbook),
  ])
  const pages = convertDocuments(contentCatalog, asciidocConfig)
  const navigationCatalog = buildNavigation(contentCatalog, asciidocConfig)
  const composePage = createPageComposer(playbook, contentCatalog, uiCatalog, env)
  pages.forEach((page) => composePage(page, contentCatalog, navigationCatalog))
  await convertToPdf(pages, [contentCatalog, uiCatalog])
  // const siteFiles = mapSite(playbook, pages).concat(produceRedirects(playbook, contentCatalog))
  // if (playbook.site.url) siteFiles.push(composePage(create404Page()))
  const pageCatalog = { getAll: () => pages }
  return publishSite(playbook, [pageCatalog])
}

module.exports = generateSite
