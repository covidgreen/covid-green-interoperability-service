const fp = require('fastify-plugin')
const schema = require('./schema')
const { selectBatch, selectExposures } = require('./query')

async function download(server, options, done) {
  server.route({
    method: 'GET',
    url: '/download/:date',
    schema: schema.download,
    handler: async (request, response) => {
      const { id } = await request.authenticate()
      const { batchTag } = request.query
      const { date } = request.params
      const { rowCount, rows: batchRows } = await server.pg.read.query(
        selectBatch({ batchTag, date })
      )

      if (rowCount === 0) {
        response.status(204)
      } else {
        const [{ id: batchId, tag: newBatchTag }] = batchRows
        const { rows: exposureRows } = await server.pg.read.query(
          selectExposures({ batchId, id })
        )

        return {
          batchTag: newBatchTag,
          exposures: exposureRows
        }
      }
    }
  })

  done()
}

module.exports = fp(download)
