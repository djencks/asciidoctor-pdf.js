/* eslint-env mocha */
'use strict'

const cheerio = require('cheerio')
const chai = require('chai')
const expect = chai.expect
const dirtyChai = require('dirty-chai')
chai.use(dirtyChai)

const loadAsciiDoc = require('@antora/asciidoc-loader')
const templates = require('../lib/templates.js')
const bodyAttributeProcessor = require('../lib/body-attributes-processor')

describe('Default converter', () => {
  let inputFile
  const asciidocConfig = { converters: [templates], extensions: [bodyAttributeProcessor] }
  const contentCatalog = { getComponent: () => undefined }

  beforeEach(() => {
    inputFile = {
      path: 'modules/module-a/pages/page-a.adoc',
      dirname: 'modules/module-a/pages',
      src: {
        component: 'component-a',
        version: 'master',
        module: 'module-a',
        family: 'page',
        relative: 'page-a.adoc',
        basename: 'page-a.adoc',
        stem: 'page-a',
        extname: '.adoc',
      },
      pub: {
        url: '/component-a/module-a/page-a.html',
        moduleRootPath: '.',
        rootPath: '../..',
      },
    }
  })

  const setInputFileContents = (contents) => {
    inputFile.contents = Buffer.from(contents)
  }

  const loadAsciidoc = (contents, cc = contentCatalog, ac = asciidocConfig) => {
    setInputFileContents(contents)
    const doc = loadAsciiDoc(inputFile, cc, ac)
    return doc
  }

  describe('Language', () => {
    it('should have a default language', () => {
      const doc = loadAsciidoc(`= Title

== Section`)
      expect(doc.getAttribute('page-pagedjs-lang-attr')).to.equal(' lang="en"')
    })

    it('respect the document lang attribute', () => {
      const doc = loadAsciidoc(`= Title
:lang: de

== Section`)
      expect(doc.getAttribute('page-pagedjs-lang-attr')).to.equal(' lang="de"')
    })

    it('respect the document nolang attribute', () => {
      const doc = loadAsciidoc(`= Title
:nolang:

== Section`)
      expect(doc.getAttribute('page-pagedjs-lang-attr')).to.equal('')
    })
  })

  describe('Page title', () => {
    it('should include a title page if title-page attribute is defined', () => {
      const doc = loadAsciidoc(`= Title
Guillaume Grossetie
:title-page:

== Section`)
      const $ = cheerio.load(doc.convert())
      expect($('.title-page > h1').text()).to.equal('Title')
    })

    it('should include a title page if doctype is book', () => {
      const doc = loadAsciidoc(
        `= Title
Guillaume Grossetie

== Section`,
        contentCatalog,
        Object.assign({ doctype: 'book' }, asciidocConfig)
      )
      expect(doc.getAttribute('page-pagedjs-title-page')).to.equal('')
      expect(doc.getAttribute('page-pagedjs-book')).to.equal('')
      const $ = cheerio.load(doc.convert())
      expect($('.title-page > h1').text()).to.equal('Title')
    })

    it('should not include a title page', () => {
      const doc = loadAsciidoc(`= Title
Guillaume Grossetie

== Section`)
      const $ = cheerio.load(doc.convert())
      expect($('.title-page > h1').length).to.equal(0)
    })

    it('should not include a title page if the document title is empty', () => {
      const doc = loadAsciidoc('Hello world!',
        contentCatalog,
        Object.assign({ attributes: { 'title-page': '' } }, asciidocConfig))
      const $ = cheerio.load(doc.convert())
      expect($('.title-page > h1').length).to.equal(0)
    })

    it('should use a special page numbering when title page is set', () => {
      const doc = loadAsciidoc(`= Title
Guillaume Grossetie
:title-page:

== Section`)
      expect(doc.getAttribute('page-pagedjs-title-page')).to.equal('')
    })

    it('should not include a document title if the document title is empty', () => {
      const doc = loadAsciidoc('Hello world!')
      const $ = cheerio.load(doc.convert())
      expect($('.title-document > h1').length).to.equal(0)
    })
  })

  describe('Stem', () => {
    const fileUrl = require('file-url')
    const mathjaxFileUrl = fileUrl(require.resolve('mathjax/es5/tex-chtml-full.js'))

    it('should include MathML when stem is set', () => {
      const doc = loadAsciidoc(`= Title
:stem:

== Section`)
      const $ = cheerio.load(doc.convert())
      expect($(`script[src="${mathjaxFileUrl}"]`).length).to.equal(1)
      // by default equation numbering is not enabled
      expect($('script[data-type="mathjax-config"]').html()).to.have.string('tags: "none"')
    })

    it('should not include MathML when stem is not set', () => {
      const doc = loadAsciidoc(`= Title
:stem!:

== Section`)
      const $ = cheerio.load(doc.convert())
      expect($(`script[src="${mathjaxFileUrl}"]`).length).to.equal(0)
    })

    it('should not include MathML when stem is not present', () => {
      const doc = loadAsciidoc(`= Title

== Section`)
      const $ = cheerio.load(doc.convert())
      expect($(`script[src="${mathjaxFileUrl}"]`).length).to.equal(0)
    })

    it('should add equation numbers when eqnums equals AMS', () => {
      const doc = loadAsciidoc(`= Title
:stem:
:eqnums: AMS

== Section`)
      const $ = cheerio.load(doc.convert())
      expect($(`script[src="${mathjaxFileUrl}"]`).length).to.equal(1)
      expect($('script[data-type="mathjax-config"]').html()).to.have.string('tags: "ams"')
    })

    it('should add equation numbers when eqnums is present', () => {
      const doc = loadAsciidoc(`= Title
:stem:
:eqnums:

== Section`)
      const $ = cheerio.load(doc.convert())
      expect($(`script[src="${mathjaxFileUrl}"]`).length).to.equal(1)
      // If eqnums is empty, the value will be "ams"
      expect($('script[data-type="mathjax-config"]').html()).to.have.string('tags: "ams"')
    })

    it('should add equation numbers when eqnums equals all', () => {
      const doc = loadAsciidoc(`= Title
:stem:
:eqnums: all

== Section`)
      const $ = cheerio.load(doc.convert())
      expect($(`script[src="${mathjaxFileUrl}"]`).length).to.equal(1)
      expect($('script[data-type="mathjax-config"]').html()).to.have.string('tags: "all"')
    })
  })

  describe('Admonition', () => {
    it('should use an emoji shortcode as admonition icon', () => {
      const doc = loadAsciidoc(`= Title
:tip-caption: :bulb:

[TIP]
It's possible to use emojis as admonition.`)
      const $ = cheerio.load(doc.convert())
      expect($('td.icon > .title').html()).to.equal(':bulb:')
    })
  })

  describe('Inline icon', () => {
    describe('FontAwesome SVG icons set', () => {
      it('should enable SVG icon when icons attribute is equals to font (user experience)', () => {
        const doc = loadAsciidoc(
          `= Title
:icons: font

icon:address-book[]`
        )
        expect(doc.getAttribute('page-pagedjs-svg-icons')).to.equal('')
        const $ = cheerio.load(doc.convert())
        expect($('svg[data-prefix="fa"][data-icon="address-book"]').html()).to.equal(
          '<path fill="currentColor" d="M436 160c6.6 0 12-5.4 12-12v-40c0-6.6-5.4-12-12-12h-20V48c0-26.5-21.5-48-48-48H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h320c26.5 0 48-21.5 48-48v-48h20c6.6 0 12-5.4 12-12v-40c0-6.6-5.4-12-12-12h-20v-64h20c6.6 0 12-5.4 12-12v-40c0-6.6-5.4-12-12-12h-20v-64h20zm-228-32c35.3 0 64 28.7 64 64s-28.7 64-64 64-64-28.7-64-64 28.7-64 64-64zm112 236.8c0 10.6-10 19.2-22.4 19.2H118.4C106 384 96 375.4 96 364.8v-19.2c0-31.8 30.1-57.6 67.2-57.6h5c12.3 5.1 25.7 8 39.8 8s27.6-2.9 39.8-8h5c37.1 0 67.2 25.8 67.2 57.6v19.2z"></path>'
        )
      })
      it('should render a solid FontAwesome SVG icon (default)', () => {
        const doc = loadAsciidoc(`:icontype: svg

icon:address-book[]`)
        expect(doc.getAttribute('page-pagedjs-svg-icons')).to.equal('')
        const $ = cheerio.load(doc.convert())
        expect($('svg[data-prefix="fa"][data-icon="address-book"]').html()).to.equal(
          '<path fill="currentColor" d="M436 160c6.6 0 12-5.4 12-12v-40c0-6.6-5.4-12-12-12h-20V48c0-26.5-21.5-48-48-48H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h320c26.5 0 48-21.5 48-48v-48h20c6.6 0 12-5.4 12-12v-40c0-6.6-5.4-12-12-12h-20v-64h20c6.6 0 12-5.4 12-12v-40c0-6.6-5.4-12-12-12h-20v-64h20zm-228-32c35.3 0 64 28.7 64 64s-28.7 64-64 64-64-28.7-64-64 28.7-64 64-64zm112 236.8c0 10.6-10 19.2-22.4 19.2H118.4C106 384 96 375.4 96 364.8v-19.2c0-31.8 30.1-57.6 67.2-57.6h5c12.3 5.1 25.7 8 39.8 8s27.6-2.9 39.8-8h5c37.1 0 67.2 25.8 67.2 57.6v19.2z"></path>'
        )
      })
      it('should render a regular FontAwesome SVG icon (default)', () => {
        const doc = loadAsciidoc(`:icontype: svg

icon:address-book[set=far]`)
        expect(doc.getAttribute('page-pagedjs-svg-icons')).to.equal('')
        const $ = cheerio.load(doc.convert())
        expect($('svg[data-prefix="far"][data-icon="address-book"]').html()).to.equal(
          '<path fill="currentColor" d="M436 160c6.6 0 12-5.4 12-12v-40c0-6.6-5.4-12-12-12h-20V48c0-26.5-21.5-48-48-48H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h320c26.5 0 48-21.5 48-48v-48h20c6.6 0 12-5.4 12-12v-40c0-6.6-5.4-12-12-12h-20v-64h20c6.6 0 12-5.4 12-12v-40c0-6.6-5.4-12-12-12h-20v-64h20zm-68 304H48V48h320v416zM208 256c35.3 0 64-28.7 64-64s-28.7-64-64-64-64 28.7-64 64 28.7 64 64 64zm-89.6 128h179.2c12.4 0 22.4-8.6 22.4-19.2v-19.2c0-31.8-30.1-57.6-67.2-57.6-10.8 0-18.7 8-44.8 8-26.9 0-33.4-8-44.8-8-37.1 0-67.2 25.8-67.2 57.6v19.2c0 10.6 10 19.2 22.4 19.2z"></path>'
        )
      })
      it('should render a brand FontAwesome SVG icon (default)', () => {
        const doc = loadAsciidoc(`:icontype: svg

icon:chrome@fab[]`)
        expect(doc.getAttribute('page-pagedjs-svg-icons')).to.equal('')
        const $ = cheerio.load(doc.convert())
        expect($('svg[data-prefix="fab"][data-icon="chrome"]').html()).to.equal(
          '<path fill="currentColor" d="M131.5 217.5L55.1 100.1c47.6-59.2 119-91.8 192-92.1 42.3-.3 85.5 10.5 124.8 33.2 43.4 25.2 76.4 61.4 97.4 103L264 133.4c-58.1-3.4-113.4 29.3-132.5 84.1zm32.9 38.5c0 46.2 37.4 83.6 83.6 83.6s83.6-37.4 83.6-83.6-37.4-83.6-83.6-83.6-83.6 37.3-83.6 83.6zm314.9-89.2L339.6 174c37.9 44.3 38.5 108.2 6.6 157.2L234.1 503.6c46.5 2.5 94.4-7.7 137.8-32.9 107.4-62 150.9-192 107.4-303.9zM133.7 303.6L40.4 120.1C14.9 159.1 0 205.9 0 256c0 124 90.8 226.7 209.5 244.9l63.7-124.8c-57.6 10.8-113.2-20.8-139.5-72.5z"></path>'
        )
      })
    })
  })

  describe('Table Of Contents', () => {
    it('should add a toc when toc is set', () => {
      const doc = loadAsciidoc(
        `= Title
:toc:

== Section 1

== Section 2

== Section 3`
      )
      const $ = cheerio.load(doc.convert())
      expect($('#toc > ul.sectlevel1 > li')).to.have.length(3)
    })

    it("should not add a toc when there's no section", () => {
      const doc = loadAsciidoc(
        `= Title
:toc:

Just a preamble.`
      )
      const $ = cheerio.load(doc.convert())
      expect($('#toc > ul.sectlevel1 > li')).to.have.length(0)
    })

    it('should not add a toc in the header when toc placement is macro', () => {
      const doc = loadAsciidoc(
        `= Title
:toc: macro

== Section 1

== Section 2

== Section 3`
      )
      const $ = cheerio.load(doc.convert())
      expect($('#toc > ul.sectlevel1 > li')).to.have.length(0)
    })
  })
})
