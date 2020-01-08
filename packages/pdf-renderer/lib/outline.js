const { PDFDict, PDFName, PDFNumber, PDFHexString } = require('pdf-lib')
const cheerio = require('cheerio')
const Entities = require('html-entities').AllHtmlEntities
const entities = new Entities()

const SanitizeXMLRx = /<[^>]+>/g

function sanitize (string) {
  if (string.includes('<')) {
    string = string.replace(SanitizeXMLRx, '')
  }
  return entities.decode(string)
}

function getOutline (doc, node, depth) {
  if (depth === 0) {
    return []
  }
  const sections = doc('h1, h2, h3, h4, h5, h6', node)
  // console.log('sections', sections.toString())
  const sectionArray = toArray(sections)
  // console.log('sectionArray', sectionArray)

  const pruned = sectionArray
    .map(section => doc(section))
    .filter(section => section.is('h1') || section.attr('id'))
  var index = 0

  function outlineLevel(level) {
    // console.log('outlineLevel', level)
    const result = []
    while (index < pruned.length) {
      // console.log(`index: ${index}, level: ${level}`)
      section = pruned[index]
      // console.log('section', section.toString())
      if (section.is(`h${level}`)) {
        // console.log('matched')
        index++
        if (level <= depth) {
          const id = section.attr('id') || ''
          const title = sanitize(section.text())
          result.push({
            title,
            destination: id,
            children: outlineLevel(level + 1)
          })
        }
      } else if (section.is(`h${level - 1}`)) {
        // console.log('returning')
        break
      } else {
        // console.log('no match')
        index++
      }
    }
    return result
  }
  return outlineLevel(1)
}

function toArray(collection) {
  return [].slice.call(collection)
}

function setRefsForOutlineItems (layer, context, parentRef) {
  for (const item of layer) {
    item.ref = context.nextRef()
    item.parentRef = parentRef
    setRefsForOutlineItems(item.children, context, item.ref)
  }
}

function countChildrenOfOutline (layer) {
  let count = 0
  for (const item of layer) {
    ++count
    count += countChildrenOfOutline(item.children)
  }
  return count
}

function buildPdfObjectsForOutline (layer, context) {
  for (const [i, item] of layer.entries()) {
    const prev = layer[i - 1]
    const next = layer[i + 1]

    const pdfObject = new Map([
      [PDFName.of('Title'), PDFHexString.fromText(item.title)],
      [PDFName.of('Dest'), PDFName.of(item.destination)],
      [PDFName.of('Parent'), item.parentRef]
    ])
    if (prev) {
      pdfObject.set(PDFName.of('Prev'), prev.ref)
    }
    if (next) {
      pdfObject.set(PDFName.of('Next'), next.ref)
    }
    if (item.children.length > 0) {
      pdfObject.set(PDFName.of('First'), item.children[0].ref)
      pdfObject.set(PDFName.of('Last'), item.children[item.children.length - 1].ref)
      pdfObject.set(PDFName.of('Count'), PDFNumber.of(countChildrenOfOutline(item.children)))
    }

    context.assign(item.ref, PDFDict.fromMapWithContext(pdfObject, context))

    buildPdfObjectsForOutline(item.children, context)
  }
}

function generateWarningsAboutMissingDestinations (layer, pdfDoc) {
  const dests = pdfDoc.context.lookup(pdfDoc.catalog.get(PDFName.of('Dests')))
  // console.log('dests', dests)
  // Dests can be undefined if the PDF wasn't successfully generated (for instance if Paged.js threw an exception)
  if (dests) {
    const validDestinationTargets = dests.entries().map(([key, _]) => key.value())
    for (const item of layer) {
      if (item.destination.length > 0 && !validDestinationTargets.includes('/' + item.destination)) {
        console.warn(`Unable to find destination ${item.destination} while generating PDF outline! \
This likely happened because an anchor link contained an umlaut (https://bugs.chromium.org/p/chromium/issues/detail?id=985254).`)
      }
      generateWarningsAboutMissingDestinations(item.children, pdfDoc)
    }
  }
}

async function addOutline (pdfDoc, htmldoc, attributes) {
  const depth = attributes.toclevels || 2
  const context = pdfDoc.context
  const outlineRef = context.nextRef()

  const doc = cheerio.load(htmldoc)
  const article = doc('article.doc')
  // console.log('article', article.toString())
  const outline = getOutline(doc, article, depth)
  // console.log('outline', outline)
  if (outline.length === 0) {
    return pdfDoc
  }
  generateWarningsAboutMissingDestinations(outline, pdfDoc)
  setRefsForOutlineItems(outline, context, outlineRef)
  buildPdfObjectsForOutline(outline, context)

  const outlineObject = PDFDict.fromMapWithContext(new Map([
    [PDFName.of('First'), outline[0].ref],
    [PDFName.of('Last'), outline[outline.length - 1].ref],
    [PDFName.of('Count'), PDFNumber.of(countChildrenOfOutline(outline))]
  ]), context)
  context.assign(outlineRef, outlineObject)

  pdfDoc.catalog.set(PDFName.of('Outlines'), outlineRef)
  return pdfDoc
}

module.exports = {
  addOutline: addOutline
}