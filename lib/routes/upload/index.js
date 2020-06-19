const fp = require('fastify-plugin')
const schema = require('./schema')
const { exposureInsert, uploadBatchInsert } = require('./query')

async function upload(server, options, done) {
  server.route({
    method: 'POST',
    url: '/upload',
    schema: schema.upload,
    handler: async (request, response) => {
      const { id } = request.authenticate()
      const { batchTag, exposures } = request.body

      try {
        return await server.pg.write.transact(async client => {
          const { rows } = await client.query(uploadBatchInsert({ id, batchTag }))
          const [{ uploadBatchId }] = rows

          const { rowCount } = await client.query(exposureInsert({
            uploadBatchId,
            exposures
          }))

          if (rowCount === 0) {
            throw new Error()
          }

          return { batchTag }
        })
      } catch {
        response.status(204)
      }
    }
  })

  done()
}

module.exports = fp(upload)
