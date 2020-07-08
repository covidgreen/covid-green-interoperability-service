const fp = require('fastify-plugin')
const schema = require('./schema')
const { Unauthorized } = require('http-errors')
const { JWK, JWS } = require('node-jose')
const { SQS } = require('aws-sdk')
const { exposureInsert, uploadBatchInsert } = require('./query')

async function upload(server, options, done) {
  const sqs = new SQS({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  })

  server.route({
    method: 'POST',
    url: '/upload',
    schema: schema.upload,
    handler: async (request, response) => {
      const { id, publicKey } = await request.authenticate()
      const { batchTag, payload } = request.body

      try {
        const key = await JWK.asKey(publicKey, 'pem')
        const verify = JWS.createVerify(key)
        const data = await verify.verify(payload)
        const exposures = JSON.parse(data.payload)

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
      } catch {
        throw new Unauthorized()
      }
    }
  })

  done()
}

module.exports = fp(upload)
