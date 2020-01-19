const { PDFName, PDFString } = require('pdf-lib')
const pkg = require('../package.json')

const addMetadata = async (pdfDoc, attributes) => {
  let modificationDate
  let creationDate
  if ('reproducible' in attributes) {
    const date = new Date()
    date.setTime(0)
    modificationDate = date
    creationDate = date
  } else {
    try {
      modificationDate = new Date(attributes.docdatetime)
    } catch (e) {
      modificationDate = new Date()
    }
    try {
      creationDate = new Date(attributes.localdatetime)
    } catch (e) {
      creationDate = new Date()
    }
  }
  const authors = attributes.authors || ''
  const publisher = attributes.publisher || ''
  const creator = `Antora PDF ${pkg.version}`
  pdfDoc.setTitle(attributes.doctitle || '')
  pdfDoc.setAuthor(authors)
  pdfDoc.setSubject(attributes.subject || '')
  pdfDoc.setKeywords((attributes.keywords || '').split(','))
  pdfDoc.setProducer(publisher || authors || creator)
  pdfDoc.setCreator(creator)
  pdfDoc.setCreationDate(creationDate)
  pdfDoc.setModificationDate(modificationDate)
  if (!('nolang' in attributes)) {
    const lang = attributes.lang || 'en'
    pdfDoc.catalog.set(PDFName.of('Lang'), PDFString.of(lang))
  }
  return pdfDoc
}

module.exports = {
  addMetadata: addMetadata,
}
