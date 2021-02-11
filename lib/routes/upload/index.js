const fp = require('fastify-plugin')
const { BadRequest } = require('http-errors')
const { JWK, JWS } = require('node-jose')
const { SQS } = require('aws-sdk')

const schema = require('./schema')
const { metricsInsert } = require('../metrics/query')
const { uploadBatchInsert } = require('./query')
const pipeline = require('./pipeline')

function pgEscape(value) {
  var escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return '"' + escaped + '"'
}

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
    bodyLimit: 100 * 1024 * 1024, // 100mb
    handler: async request => {
      const { id, publicKey, region } = await request.authenticate()
      const { batchTag, payload } = request.body

      const timeStart = Date.now()

      const key = await JWK.asKey(publicKey, 'pem')

      const timeVerify = Date.now()

      const verify = JWS.createVerify(key)
      const data = await verify.verify(payload)

      const timeParse = Date.now()

      const exposures = JSON.parse(data.payload)

      for (const { keyData } of exposures) {
        const decodedKeyData = Buffer.from(keyData, 'base64')

        if (decodedKeyData.length !== 16) {
          throw new BadRequest('Invalid key length')
        }
      }

      const timeBatch = Date.now()

      const { rows } = await server.pg.write.query(
        uploadBatchInsert({ id, batchTag })
      )
      const [{ uploadBatchId }] = rows

      const timeExposures = Date.now()

      const rowCount = await pipeline(server.pg.write, flow => {
        for (const exposure of exposures) {
          flow.write([
            uploadBatchId,
            exposure.keyData,
            exposure.rollingStartNumber,
            exposure.transmissionRiskLevel,
            exposure.rollingPeriod,
            `{${(exposure.regions || []).map(pgEscape).join(',')}}`,
            region,
            exposure.reportType,
            exposure.daysSinceOnset,
            exposure.testType
          ])
        }
      })

      const timeMetric = Date.now()

      await server.pg.write.query(
        metricsInsert({
          event: 'UPLOAD',
          region,
          value: rowCount
        })
      )

      const timeQueue = Date.now()

      if (rowCount && options.aws.batchQueueUrl) {
        const message = {
          QueueUrl: options.aws.batchQueueUrl,
          MessageBody: JSON.stringify({})
        }

        await sqs.sendMessage(message).promise()
      }

      const timeEnd = Date.now()

      server.log.trace(
        {
          asKey: timeVerify - timeStart,
          verify: timeParse - timeVerify,
          parse: timeBatch - timeParse,
          insertBatch: timeExposures - timeBatch,
          insertExposures: timeMetric - timeExposures,
          metric: timeQueue - timeMetric,
          queue: timeEnd - timeQueue
        },
        'perf'
      )

      return {
        batchTag,
        insertedExposures: rowCount
      }
    }
  })

  done()
}

module.exports = fp(upload)
