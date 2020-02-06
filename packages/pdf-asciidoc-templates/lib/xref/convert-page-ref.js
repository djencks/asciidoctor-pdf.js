'use strict'

const splitOnce = require('../util/split-once')

/**
 * Converts the specified page reference to the data necessary to build an HTML link.
 *
 * Parses the page reference (page ID and optional fragment), resolves the corresponding file from
 * the content catalog, then grabs its publication (root-relative) path. If the relativize param is
 * true, transforms the root-relative path to a relative path from the current page to the target
 * page. Uses the resulting path to create the href for an HTML link that points to the published
 * target page.
 *
 * @memberof asciidoc-loader
 *
 * @param {String} refSpec - The target of an xref macro to a page, which is a page ID spec without
 * the .adoc extension and with an optional fragment identifier.
 * @param {String} content - The content (i.e., formatted text) of the link (undefined if not specified).
 * @param {File} currentPage - The virtual file for the current page.
 * @param {ContentCatalog} contentCatalog - The content catalog that contains the virtual files in the site.
 * @param {Boolean} [relativize=true] - Compute the target relative to the current page.
 * @returns {Object} A map ({ content, target, internal, unresolved }) containing the resolved
 * content and target to make an HTML link, and hints to indicate if the reference is either
 * internal or unresolved.
 */
function convertPageRef (refSpec, content, currentPage, contentCatalog, siteUrl) {
  let targetPage
  const [pageIdSpec, fragment] = splitOnce(refSpec, '#')
  const hash = fragment ? '#' + fragment : ''
  try {
    if (!((targetPage = contentCatalog.resolvePage(pageIdSpec, currentPage.src)) && targetPage.pub)) {
      // TODO log "Unresolved page ID"
      console.log(`Unresolved page id ${refSpec}`)
      return { content, target: `#${pageIdSpec}.adoc${hash}`, unresolved: true }
    }
  } catch (e) {
    // TODO log "Invalid page ID syntax" (or e.message)
    console.log(`Invalid page id ${refSpec}`)
    return { content, target: `#${refSpec}`, unresolved: true }
  }
  let target = targetPage.pub.url + hash
  const includeMap = currentPage.includeMap
  // console.log(`refSpec: ${refSpec}, pageIdSpec: ${pageIdSpec}, fragment: ${fragment}`)
  // console.log('targetPage.src', targetPage.src)
  const src = targetPage.src
  const mappedTarget = includeMap[`${src.version}@${src.component}:${src.module}:${src.relative}`]
  target = mappedTarget ? fragment ? hash : `#${mappedTarget}` : `${siteUrl}${target}`
  return { content: content || fragment || mappedTarget || target, target, mappedTarget }
}

module.exports = convertPageRef