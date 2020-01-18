const http = require('http')

function server (catalogs) {
  const site = catalogs.reduce((accum, catalog) => {
    catalog
      .getAll()
      .filter((file) => file.out)
      .reduce((accum2, file) => {
        accum2[file.out.path] = file
        return accum2
      }, accum)
    return accum
  }, {})
  const s = new http.Server((req, resp) => {
    const url = req.url.slice(1)
    const file = site[url]
    if (file) {
      const type = file.mediaType
      resp.writeHead(200, `{content-type: ${type}}`)
      resp.write(file.contents)
      resp.end()
    } else {
      resp.writeHead(404, 'file not found')
      resp.end()
    }
  }).listen({ port: 8081, hostname: 'localhost' })
  return s
}

module.exports = server
