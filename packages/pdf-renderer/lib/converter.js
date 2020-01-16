/* global Opal */
const { PDFDocument } = require('pdf-lib')
const puppeteer = require('puppeteer')
const { addOutline } = require('./outline.js')
const { addMetadata } = require('./metadata')
const server = require('./server')

async function convertToPdf (pages, catalogs) {
  const {browser, server} = await setup(catalogs)
  let result
  try {
    result = await Promise.all(pages.map((file) => convert(file, browser)))
  } finally {
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
    args: ['--no-sandbox', '--allow-file-access-from-files']
  }
  if (preview) {
    Object.assign(puppeteerConfig, { defaultViewport: null })
  }
  const browser = await puppeteer.launch(puppeteerConfig)
  try {
   return {browser, server : s}
  } catch (Error) {
    //TODO something
    throw Error
  }

}

async function convert(file, browser) {
  const url = `http://localhost:8081/${file.out.path}`
  const attributes = file.asciidoc.attributes
  const htmldoc = file.contents.toString()
  const page = await browser.newPage()
  try {
    page
      .on('pageerror', err => {
        console.error('> An uncaught exception happened within the HTML page: ' + err.toString())
      })
      .on('error', err => {
        console.error('Page crashed: ' + err.toString())
      })
    await page.goto(url, { waitUntil: 'networkidle0' })
    const watchDog = page.waitForFunction('window.AsciidoctorPDF === undefined || window.AsciidoctorPDF.status === undefined || window.AsciidoctorPDF.status === "ready"')
    await watchDog
    const pdfOptions = {
      printBackground: true,
      preferCSSPageSize: true
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
    if (format) {
      pdfOptions.format = format // Paper format. If set, takes priority over width or height options. Defaults to 'Letter'.
    }

    let pdf = await page.pdf(pdfOptions)
    // console.log(`got pdf for url: ${url}: ${pdf.toString()}`)
    // Outline is not yet implemented in Chromium, so we add it manually here.
    // https://bugs.chromium.org/p/chromium/issues/detail?id=840455
    let pdfDoc = await PDFDocument.load(pdf)
    pdfDoc = await addOutline(pdfDoc, htmldoc, attributes)
    pdfDoc = await addMetadata(pdfDoc, attributes)
    pdf = await pdfDoc.save()
    const pdfFile = {src: Object.assign({}, file.src)}    
    pdfFile.src.basename = pdfFile.src.basename.slice(0, -4) + 'pdf'
    pdfFile.src.mediaType = 'application/pdf'
    pdfFile.src.family = 'attachment'
    pdfFile.contents = Buffer.from(pdf)
    return pdfFile
  } finally {
    await page.close()
  }
}


module.exports = convertToPdf
