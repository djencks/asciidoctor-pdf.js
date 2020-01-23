module.exports.register = function (registry, { file, contentCatalog, config }) {
  registry.treeProcessor(function () {
    var self = this
    self.process(function (doc) {
      printBlocks(doc)
      const bodyAttrs = doc.getId() ? [`id="${doc.getId()}"`] : []
      let classes
      if (
        doc.hasSections() &&
        doc.isAttribute('toc-class') &&
        doc.isAttribute('toc') &&
        doc.isAttribute('toc-placement', 'auto')
      ) {
        classes = [doc.getDoctype()]
        //Why was this appropriate for asciidoctor-pdf.js??
        //, doc.getAttribute('toc-class'), `toc-${doc.getAttribute('toc-position', 'header')}`]
      } else {
        classes = [doc.getDoctype()]
      }
      if (doc.hasRole()) {
        classes.push(doc.getRole())
      }
      bodyAttrs.push(`class="${classes.join(' ')}"`)
      if (doc.hasAttribute('max-width')) {
        bodyAttrs.push(`style="max-width: ${doc.getAttribute('max-width')};"`)
      }
      doc.setAttribute('page-pagedjs-body-attrs', bodyAttrs.join(' '))

      const langAttr = () => {
        const attrNolang = doc.getAttribute('nolang')
        if (attrNolang === '') {
          return ''
        }
        const attrLang = doc.getAttribute('lang', 'en')
        return ` lang="${attrLang}"`
      }
      doc.setAttribute('page-pagedjs-lang-attr', langAttr())

      if (doc.getDoctype() === 'book' || doc.hasAttribute('title-page')) {
        doc.setAttribute('page-pagedjs-title-page', 't')
      }
      if (doc.getDoctype() === 'book') {
        doc.setAttribute('page-pagedjs-book', 't')
      }
      if (doc.isAttribute('icontype', 'svg') || doc.isAttribute('icons', 'font')) {
        doc.setAttribute('page-pagedjs-svg-icons', 't')
      }

      return doc
    })

    function printBlocks(block, level = 1) {
      console.log(`Block at level ${level}`)
      // console.log('block...', block)
      // console.log('block reader', block.reader)
      console.log('block catalog', block.catalog.includes)
      // block.getBlocks().forEach(sub => printBlocks(sub, level + 1))
    }
  })
}
