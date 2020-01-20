/* eslint-env mocha */
'use strict'

//Unlikely this way to test will be useful/usable.

//command line to generate processed html from test/fixtures project:
//$ANTORA_DEV test/fixtures/antora-playbook.yml  --stacktrace --generator ./node_modules/\@antora-pdf/pdf-generator \
//  --ui-bundle-url ../../antora/antora-ui-default/build/ui-pdf-bundle.zip --ui-start-path pdf
// const fs = require('fs')
const { PDFDocument, PDFName, PDFDict } = require('pdf-lib')
const chai = require('chai')
const ospath = require('path')
const expect = chai.expect
const dirtyChai = require('dirty-chai')
chai.use(dirtyChai)
require('./helper.js')(chai)

const vfs = require('vinyl-fs')
const { obj: map } = require('through2')
const { posix: path } = ospath
const posixify = ospath.sep === '\\' ? (p) => p.replace(/\\/g, '/') : undefined
const File = require('./file')
const convertToPdf = require('@antora-pdf/pdf-renderer')
const CONTENT_GLOB = '**/*'
// const asciidoctor = require('@asciidoctor/core')()
// const converter = require('../lib/converter.js')
// const templates = require('../lib/document/templates.js')
// converter.registerTemplateConverter(asciidoctor, templates)

describe('PDF converter', function () {
  // launching a headless browser (especially on Travis) can take several tens of seconds
  this.timeout(30000)

  let pdfDocs

  before(async () => {
    const files = await readFilesFromWorktree(__dirname, 'fixtures/site')
    const catalog = { getAll: () => files }
    const pages = files.filter((file) => file.relative.endsWith('.html')).map((file) => {
      file.out = { path: file.relative }
      return file
    })
    const pdfPages = await convertToPdf(pages, [catalog])
    pdfDocs = pdfPages.reduce((accum, page) => {
      accum[page.relative] = PDFDocument.load(page.contents)
      return accum
    }, {})
    console.log('pdfDocs: ', pdfDocs.entries().map(([a, b]) => a))
  })

  //borrowed from aggregate-content.js
  function readFilesFromWorktree (worktreePath, startPath) {
    const base = path.join(worktreePath, startPath)
    console.log('base: ', base)
    // return fs
    //   .stat(base)
    //   .catch(() => {
    //     throw new Error(`the start path '${startPath}' does not exist`)
    //   })
    //   .then((stat) => {
    //     if (!stat.isDirectory()) throw new Error(`the start path '${startPath}' is not a directory`)
    return new Promise((resolve, reject) =>
      vfs
        .src(CONTENT_GLOB, { base, cwd: base, removeBOM: false })
        .on('error', reject)
        .pipe(relativizeFiles())
        .pipe(collectFiles(resolve))
    )
    // })
  }

  /**
   * Transforms the path of every file in the stream to a relative posix path.
   *
   * Applies a mapping function to all files in the stream so they end up with a
   * posixified path relative to the file's base instead of the filesystem root.
   * This mapper also filters out any directories (indicated by file.isNull())
   * that got caught up in the glob.
   */
  function relativizeFiles () {
    return map((file, enc, next) => {
      if (file.isNull()) {
        next()
      } else {
        next(
          null,
          new File({
            path: posixify ? posixify(file.relative) : file.relative,
            contents: file.contents,
            stat: file.stat,
            src: { abspath: file.path },
          })
        )
      }
    })
  }

  function collectFiles (done) {
    const accum = []
    return map((file, enc, next) => accum.push(file) && next(), () => done(accum)) // prettier-ignore
  }

  const getOutlineRefs = (pdfDoc) => {
    const values = pdfDoc.context.lookup(pdfDoc.catalog.get(PDFName.of('Outlines'))).context.indirectObjects.values()
    const dicts = []
    for (const v of values) {
      if (v instanceof PDFDict) {
        dicts.push(v.dict)
      }
    }
    return dicts.filter((d) => Array.from(d.keys()).includes(PDFName.of('Dest')))
  }

  const decodePDFHexStringValue = (value) => {
    // remove byte order mark 0xfeff
    value = value.substr(4, value.length)
    const size = 4
    const numChunks = Math.ceil(value.length / size)
    let buff = ''
    for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
      const chunk = value.substr(o, size)
      buff += String.fromCodePoint(parseInt(chunk, 16))
    }
    return buff
  }

  const convert = async (inputFile, outputFile, options) => {
    return pdfDocs[inputFile]
  }

  it('should not encode HTML entity in the PDF outline', async () => {
    const options = { attributes: { toc: 'macro' } }
    const pdfDoc = await convert(
      `${__dirname}/fixtures/sections.adoc`,
      `${__dirname}/output/sections-toc-absent.pdf`,
      options
    )
    const refs = getOutlineRefs(pdfDoc)
    expect(refs.length).to.equal(9)
    expect(refs[2].get(PDFName.of('Dest')).encodedName).to.equal('/_section_2_black_white')
    expect(decodePDFHexStringValue(refs[2].get(PDFName.of('Title')).value)).to.equal('Section 2: Black & White')
    expect(refs[5].get(PDFName.of('Dest')).encodedName).to.equal('/_section_3_typographic_quotes')
    expect(decodePDFHexStringValue(refs[5].get(PDFName.of('Title')).value)).to.equal('Section 3: “Typographic quotes”')
    expect(decodePDFHexStringValue(refs[7].get(PDFName.of('Title')).value)).to.equal(
      'Section 4: Asterisk hex * and decimal *'
    )
  })

  it('should generate a PDF outline even if the TOC is absent from the output', async () => {
    const options = { attributes: { toc: 'macro' } }
    const pdfDoc = await convert(
      `${__dirname}/fixtures/sections.adoc`,
      `${__dirname}/output/sections-toc-absent.pdf`,
      options
    )
    const refs = getOutlineRefs(pdfDoc)
    expect(refs.length).to.equal(9)
    expect(refs[0].get(PDFName.of('Dest')).encodedName).to.equal('/_section_1')
  })

  it('should generate a PDF outline even if the TOC is not enabled', async () => {
    const pdfDoc = await convert(`${__dirname}/fixtures/sections.adoc`, `${__dirname}/output/sections-toc-disabled.pdf`)
    const refs = getOutlineRefs(pdfDoc)
    expect(refs.length).to.equal(9)
    expect(refs[0].get(PDFName.of('Dest')).encodedName).to.equal('/_section_1')
  })

  it('should honor toclevels 1 when generating a PDF outline', async () => {
    const options = { attributes: { toclevels: 1 } }
    const pdfDoc = await convert(
      `${__dirname}/fixtures/sections.adoc`,
      `${__dirname}/output/sections-toclevels-1.pdf`,
      options
    )
    const refs = getOutlineRefs(pdfDoc)
    expect(refs.length).to.equal(4)
    expect(refs[0].get(PDFName.of('Dest')).encodedName).to.equal('/_section_1')
  })

  it('should honor toclevels 3 when generating a PDF outline', async () => {
    const options = { attributes: { toclevels: 3 } }
    const pdfDoc = await convert(
      `${__dirname}/fixtures/sections.adoc`,
      `${__dirname}/output/sections-toclevels-1.pdf`,
      options
    )
    const refs = getOutlineRefs(pdfDoc)
    expect(refs.length).to.equal(11)
    expect(refs[0].get(PDFName.of('Dest')).encodedName).to.equal('/_section_1')
  })

  // it('should be able to set background color of title page', async () => {
  //   const opts = {}
  //   const outputFile = `${__dirname}/output/title-page-background-color.pdf`
  //   opts.to_file = outputFile
  //   opts.attributes = {
  //     stylesheet: `${__dirname}/../css/asciidoctor.css;${__dirname}/../css/document.css;
  // ${__dirname}/../css/features/book.css;${__dirname}/fixtures/black-title-page.css`,
  //   }
  //   await converter.convert(asciidoctor, `${__dirname}/fixtures/title-page.adoc`, opts, false)
  //   expect(outputFile).to.be.visuallyIdentical('title-page-background-color.pdf')
  // })
})
