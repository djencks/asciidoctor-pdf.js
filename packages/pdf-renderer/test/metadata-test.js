/* eslint-env mocha */
'use strict'

const { PDFDocument, PDFName, PDFHexString } = require('pdf-lib')
const chai = require('chai')
const expect = chai.expect
const dirtyChai = require('dirty-chai')
chai.use(dirtyChai)

// const asciidoctor = require('@asciidoctor/core')()
const loadAsciiDoc = require('@antora/asciidoc-loader')
const templates = require('@antora-pdf/pdf-asciidoc-templates')
const { bodyAttributesProcessor } = require('@antora-pdf/pdf-asciidoc-templates')
const { addMetadata } = require('../lib/metadata.js')
const { version: pkgVersion } = require('../package.json')

const decodePDFHexValue = (value) => {
  const buffer = Buffer.from(value, 'hex')
  let str = ''
  new Uint16Array(buffer).forEach((v, index) => {
    if (index === 0 || index === 1) {
      // ignore byteOrderMark
    } else {
      if (index % 2 !== 0) {
        str += String.fromCharCode(v)
      }
    }
  })
  return str
}

const expectEqual = (pdf, metadataKey, expectedValue) => {
  const metadata = pdf.context.lookup(pdf.context.trailerInfo.Info)
  const pdfValue = metadata.get(PDFName.of(metadataKey))
  if (pdfValue instanceof PDFHexString) {
    expect(decodePDFHexValue(pdfValue.value)).to.equal(expectedValue, metadataKey)
  } else {
    expect(pdfValue.value).to.equal(expectedValue, metadataKey)
  }
}

describe('PDF metadata', () => {
  let inputFile
  const asciidocConfig = { converters: [templates], extensions: [bodyAttributesProcessor] }
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

  const toPdfWithMetadata = async (content, options) => {
    const doc = loadAsciidoc(content, contentCatalog, options)
    const pdfDoc = await PDFDocument.create()
    return addMetadata(pdfDoc, doc.getAttributes())
  }

  it('should add metadata from attributes', async () => {
    const pdfWithMetadata = await toPdfWithMetadata(`= The Dangerous and Thrilling Documentation Chronicles
Guillaume Grossetie <ggrossetie@asciidoctor.org>
v1.0, 2019-11-05
:keywords: pdf,asciidoctor,doc

content`)

    expectEqual(pdfWithMetadata, 'Title', 'The Dangerous and Thrilling Documentation Chronicles')
    expectEqual(pdfWithMetadata, 'Author', 'Guillaume Grossetie')
    expectEqual(pdfWithMetadata, 'Subject', '')
    expectEqual(pdfWithMetadata, 'Keywords', 'pdf asciidoctor doc')
    expectEqual(pdfWithMetadata, 'Producer', 'Guillaume Grossetie')
    expectEqual(pdfWithMetadata, 'Creator', `Antora PDF ${pkgVersion}`)
  })

  it('should add epoch unix at start date if reproducible attribute is set', async () => {
    const pdfWithMetadata = await toPdfWithMetadata('', { attributes: { reproducible: true } })

    expectEqual(pdfWithMetadata, 'CreationDate', 'D:19700101000000Z')
    expectEqual(pdfWithMetadata, 'ModDate', 'D:19700101000000Z')
  })

  it('should set Producer field to value of publisher attribute if set', async () => {
    const pdfWithMetadata = await toPdfWithMetadata(`= Document Title
Author Name
:publisher: Big Cheese

content`)

    expectEqual(pdfWithMetadata, 'Author', 'Author Name')
    expectEqual(pdfWithMetadata, 'Producer', 'Big Cheese')
  })

  it('should set Author and Producer field to value of author attribute if set', async () => {
    const pdfWithMetadata = await toPdfWithMetadata(`= Document Title
:author: Author Name

content`)

    expectEqual(pdfWithMetadata, 'Producer', 'Author Name')
    expectEqual(pdfWithMetadata, 'Author', 'Author Name')
  })

  it('should set Producer field to value of Creator field by default', async () => {
    const pdfWithMetadata = await toPdfWithMetadata('hello')

    const creator = `Antora PDF ${pkgVersion}`
    expectEqual(pdfWithMetadata, 'Creator', creator)
    expectEqual(pdfWithMetadata, 'Producer', creator)
  })

  it('should set Subject field to value of subject attribute if set', async () => {
    const pdfWithMetadata = await toPdfWithMetadata(`= Document Title
:subject: Cooking

content`)

    expectEqual(pdfWithMetadata, 'Subject', 'Cooking')
  })

  it('should set Lang field with the default language (en)', async () => {
    const pdfWithMetadata = await toPdfWithMetadata(`= Document Title

content`)

    expect(pdfWithMetadata.catalog.get(PDFName.of('Lang')).value).to.equal('en')
  })

  it('should set Lang field to value of lang attribute', async () => {
    const pdfWithMetadata = await toPdfWithMetadata(`= Document Title
:lang: de

content`)

    expect(pdfWithMetadata.catalog.get(PDFName.of('Lang')).value).to.equal('de')
  })

  it('should not set Lang field when nolang attribute is set', async () => {
    const pdfWithMetadata = await toPdfWithMetadata(`= Document Title
:nolang:

content`)

    expect(pdfWithMetadata.catalog.get(PDFName.of('Lang'))).to.be.undefined()
  })
})
