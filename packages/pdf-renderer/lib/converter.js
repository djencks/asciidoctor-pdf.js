/* global Opal */
const { PDFDocument } = require('pdf-lib')
const puppeteer = require('puppeteer')
const { addOutline } = require('./outline.js')
const { addMetadata } = require('./metadata')
const server = require('./server')

// function registerTemplateConverter (processor, templates) {
//   class TemplateConverter {
//     constructor () {
//       this.baseConverter = processor.Html5Converter.create()
//       this.templates = templates
//     }

//     convert (node, transform, opts) {
//       const template = this.templates[transform || node.node_name]
//       if (template) {
//         return template(node, this.baseConverter)
//       }
//       return this.baseConverter.convert(node, transform, opts)
//     }
//   }

//   processor.ConverterFactory.register(new TemplateConverter(), ['html5'])
// }


async function convertToPdf (pages, catalogs) {
  const {browser, server} = await setup(catalogs)
  try {
    await Promise.all(pages.map((file) => convert(file, browser)))
  } finally {
    await browser.close()
    await server.close()
  }
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
    // console.log(`loading url: ${url}`)
    await page.goto(url, { waitUntil: 'networkidle0' })
    const watchDog = page.waitForFunction('window.AsciidoctorPDF === undefined || window.AsciidoctorPDF.status === undefined || window.AsciidoctorPDF.status === "ready"')
    await watchDog
    // console.log(`loaded url: ${url}`)
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
    file.contents = Buffer.from(pdf)
    file.out.path = file.out.path.slice(0, -4) + 'pdf'
    // console.log('read pdf for file: ', file.out)
    return file
  } finally {
    await page.close()
  }
}


module.exports = convertToPdf
