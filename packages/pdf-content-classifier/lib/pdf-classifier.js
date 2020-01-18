'use strict'

const baseClassifyContent = require('@antora/content-classifier')
const { posix: path } = require('path')

function classifyContent (playbook, aggregate, siteAsciiDocConfig = undefined) {
  const contentCatalog = baseClassifyContent(playbook, aggregate, siteAsciiDocConfig)
  const pdfPages = aggregate.reduce((pages, descriptor) => {
    const { name, version, pdfFiles = [] } = descriptor
    pdfFiles.forEach((pdfFileName) => {
      const pdfFileNameBits = pdfFileName.split(':')
      const pdfFile = contentCatalog.getById({
        component: name,
        version,
        module: pdfFileNameBits[0] || 'ROOT',
        family: 'page',
        relative: pdfFileNameBits[1],
      })
      if (pdfFile) {
        pages.push(pdfFile)
      } else {
        console.log(`pdfFile ${pdfFileName} not found`)
      }
    })
    return pages
  }, [])
  if (pdfPages.length) {
    console.log('printing only configured pdf pages')
    contentCatalog.getPages().forEach((page) => {
      delete page.out
    })
    pdfPages.forEach((page) => {
      page.out = computeOut(page.src, 'page', contentCatalog.htmlUrlExtensionStyle)
      page.pub = computePub(page.src, page.out, 'page', contentCatalog.htmlUrlExtensionStyle)
    })
  } else {
    console.log('no configured pdfs found: printing all pages')
  }
  return contentCatalog
}

// copied from contentCatalog
function computeOut (src, family, htmlUrlExtensionStyle) {
  const component = src.component
  const version = src.version === 'master' ? '' : src.version
  const module = src.module === 'ROOT' ? '' : src.module

  const stem = src.stem
  let basename = src.mediaType === 'text/asciidoc' ? stem + '.html' : src.basename
  let indexifyPathSegment = ''
  if (family === 'page' && stem !== 'index' && htmlUrlExtensionStyle === 'indexify') {
    basename = 'index.html'
    indexifyPathSegment = stem
  }

  let familyPathSegment = ''
  if (family === 'image') {
    familyPathSegment = '_images'
  } else if (family === 'attachment') {
    familyPathSegment = '_attachments'
  }

  const modulePath = path.join(component, version, module)
  const dirname = path.join(modulePath, familyPathSegment, path.dirname(src.relative), indexifyPathSegment)
  const path_ = path.join(dirname, basename)
  const moduleRootPath = path.relative(dirname, modulePath) || '.'
  const rootPath = path.relative(dirname, '') || '.'

  return {
    dirname,
    basename,
    path: path_,
    moduleRootPath,
    rootPath,
  }
}

const SPACE_RX = / /g

function computePub (src, out, family, htmlUrlExtensionStyle) {
  const pub = {}
  let url
  if (family === 'nav') {
    const urlSegments = [src.component]
    if (src.version !== 'master') urlSegments.push(src.version)
    if (src.module && src.module !== 'ROOT') urlSegments.push(src.module)
    // an artificial URL used for resolving page references in navigation model
    url = '/' + urlSegments.join('/') + '/'
    pub.moduleRootPath = '.'
  } else if (family === 'page') {
    const urlSegments = out.path.split('/')
    const lastUrlSegmentIdx = urlSegments.length - 1
    if (htmlUrlExtensionStyle === 'drop') {
      // drop just the .html extension or, if the filename is index.html, the whole segment
      const lastUrlSegment = urlSegments[lastUrlSegmentIdx]
      urlSegments[lastUrlSegmentIdx] =
        lastUrlSegment === 'index.html' ? '' : lastUrlSegment.substr(0, lastUrlSegment.length - 5)
    } else if (htmlUrlExtensionStyle === 'indexify') {
      urlSegments[lastUrlSegmentIdx] = ''
    }
    url = '/' + urlSegments.join('/')
  } else {
    url = '/' + out.path
  }

  pub.url = ~url.indexOf(' ') ? url.replace(SPACE_RX, '%20') : url

  if (out) {
    pub.moduleRootPath = out.moduleRootPath
    pub.rootPath = out.rootPath
  }

  return pub
}

module.exports = classifyContent
