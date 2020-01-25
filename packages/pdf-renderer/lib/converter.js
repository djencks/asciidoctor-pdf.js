'use strict'

const { PDFDocument } = require('pdf-lib')
const puppeteer = require('puppeteer')
const pLimit = require('p-limit')
const { addOutline } = require('./outline.js')
const { addMetadata } = require('./metadata')
const server = require('./server')

async function convertToPdf (pages, catalogs) {
  const { browser, server } = await setup(catalogs)
  let result
  try {
    const limit = pLimit(10)
    result = await Promise.all(pages.map((file) => limit(() => convert(file, browser))))
  } finally {
    //If you comment out the next two lines, Antora will "keep running"
    //and you can see the html version of pages by pointing to localhost:8081/...
    await browser.close()
    await server.close()
  }
  return result
}

async function setup (catalogs) {
  const s = server(catalogs)
  const preview = false
  const puppeteerConfig = {
    headless: !preview,
    args: ['--no-sandbox', '--allow-file-access-from-files'],
  }
  if (preview) {
    Object.assign(puppeteerConfig, { defaultViewport: null })
  }
  const browser = await puppeteer.launch(puppeteerConfig)
  return { browser, server: s }
}

const inProcess = []

async function convert (file, browser) {
  const url = `http://localhost:8081/${file.out.path}`
  inProcess.push(url)
  const attributes = file.asciidoc.attributes
  const htmldoc = file.contents.toString()
  const page = await browser.newPage()
  try {
    page
      .on('pageerror', (err) => {
        console.error(`> An uncaught exception happened within the HTML page ${url}: ${err.toString()}`)
      })
      .on('error', (err) => {
        console.error(`Page ${url}crashed: ${err.toString()}`)
      })
    await page.goto(url, { timeout: 600000, waitUntil: 'networkidle0' })
    console.log(`page ${url} loaded`)
    const watchDog = page.waitForFunction(
      'window.AsciidoctorPDF === undefined || window.AsciidoctorPDF.status === undefined || window.AsciidoctorPDF.status === "ready"',
      { timeout: 600000 }
    )
    await watchDog
    console.log(`page ${url} ready`)
    const pdfOptions = {
      printBackground: true,
      preferCSSPageSize: true,
    }
    const pdfWidth = attributes['pdf-width']
    if (pdfWidth) {
      pdfOptions.width = pdfWidth
    }
    const pdfHeight = attributes['pdf-height']
    if (pdfHeight) {
      pdfOptions.height = pdfHeight
    }
    const format = attributes['pdf-format']
    if (format) { // Paper format. If set, takes priority over width or height options. Defaults to 'Letter'.
      pdfOptions.format = format
    }

    let pdf = await page.pdf(pdfOptions)
    // console.log(`got pdf for url: ${url}: ${pdf.toString()}`)
    // Outline is not yet implemented in Chromium, so we add it manually here.
    // https://bugs.chromium.org/p/chromium/issues/detail?id=840455
    let pdfDoc = await PDFDocument.load(pdf)
    pdfDoc = await addOutline(pdfDoc, htmldoc, attributes)
    pdfDoc = await addMetadata(pdfDoc, attributes)
    pdf = await pdfDoc.save()
    const pdfFile = { src: Object.assign({}, file.src) }
    const removeHidden = pdfFile.src.basename[0] === '_' ? 1 : 0
    pdfFile.src.basename = pdfFile.src.basename.slice(removeHidden, -4) + 'pdf'
    if (removeHidden) {
      pdfFile.src.relative = pdfFile.src.relative.slice(1)
      pdfFile.src.stem = pdfFile.src.stem.slice(1)
    }
    pdfFile.src.mediaType = 'application/pdf'
    pdfFile.src.family = 'attachment'
    pdfFile.contents = Buffer.from(pdf)
    console.log(`page ${url} pdf render complete`)
    return pdfFile
  } catch (err) {
    console.log(`rendering ${url} failed `, err)
    console.log('in process: ', inProcess)
  } finally {
    inProcess.splice(inProcess.indexOf(url), 1)
    await page.close()
  }
}

module.exports = convertToPdf
