const fp = require('fastify-plugin')
const schema = require('./schema')
const { BadRequest } = require('http-errors')
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
    handler: async request => {
      const { id, publicKey } = await request.authenticate()
      const { batchTag, payload } = request.body

      const key = await JWK.asKey(publicKey, 'pem')
      const verify = JWS.createVerify(key)
      const data = await verify.verify(payload)      
      const exposures = JSON.parse(data.payload)

      for (const { keyData } of exposures) {
        const decodedKeyData = Buffer.from(keyData, 'base64')

        if (decodedKeyData.length !== 16) {
          throw new BadRequest('Invalid key length')
        }
      }

      const { rows } = await server.pg.write.query(uploadBatchInsert({ id, batchTag }))
      const [{ uploadBatchId }] = rows

      const { rowCount } = await server.pg.write.query(exposureInsert({
        uploadBatchId,
        exposures
      }))

      if (rowCount) {
        const message = {
          QueueUrl: options.aws.batchQueueUrl,
          MessageBody: JSON.stringify({})
        }

        await sqs.sendMessage(message).promise()
      }

      return {
        batchTag,
        insertedExposures: rowCount
      }
    }
  })

  done()
}

module.exports = fp(upload)
