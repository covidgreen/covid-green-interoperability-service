const fp = require('fastify-plugin')
const schema = require('./schema')
const { Unauthorized, BadRequest, InternalServerError } = require('http-errors')
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
      console.log(JSON.stringify(request.body, null, 2))
      // TODO: use logger
      console.log(`Request made from ${id}`)
      const key = await JWK.asKey(publicKey, 'pem')
      const verify = JWS.createVerify(key)
      const data = await verify.verify(payload)
      const exposures = JSON.parse(data.payload)

      return await server.pg.write.transact(async client => {
        let uploadedBatchId = null
        try {
          const { rows } = await client.query(uploadBatchInsert({ id, batchTag }))
          const [{ uploadBatchId }] = rows
          uploadedBatchId = uploadBatchId
          console.log(`created batch ${uploadedBatchId}`)
        } catch (err) {
          // TODO: use logger
          console.log('uploadBatchInsert failed:', err)
        }
        if (!uploadedBatchId) {
          throw new BadRequest("BatchId missing")
        }
        try {
          const { rowCount } = await client.query(exposureInsert({
            uploadedBatchId,
            exposures
          }))
          const message = {
            QueueUrl: options.aws.batchQueueUrl,
            MessageBody: JSON.stringify({})
          }
          if (rowCount === 0) {
            console.log('Inserted 0 exposures')
            throw new Error('Inserted 0 exposures')
          }
          console.log(`inserted ${rowCount} exposures`)
          await sqs.sendMessage(message).promise()
          return { batchTag }
        } catch (err) {
          // TODO: Use logger
          console.log(err)
          throw new InternalServerError("Failed to insert exposures")
        }
      })
    }
  })

  done()
}

module.exports = fp(upload)
