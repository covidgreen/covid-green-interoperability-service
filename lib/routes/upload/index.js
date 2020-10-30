const fp = require('fastify-plugin')
const { BadRequest } = require('http-errors')
const { JWK, JWS } = require('node-jose')
const { SQS } = require('aws-sdk')
const copyFrom = require('pg-copy-streams').from
const stringify = require('csv-stringify')
const eos = require('end-of-stream')
const { promisify } = require('util')

const schema = require('./schema')
const { exposureInsert, uploadBatchInsert } = require('./query')
const { metricsInsert } = require('../metrics/query')

const peos = promisify(eos)

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
    handler: async request => {
      const { id, publicKey, region } = await request.authenticate()
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

      const { rows } = await server.pg.write.query(
        uploadBatchInsert({ id, batchTag })
      )
      const [{ uploadBatchId }] = rows

      // const { rowCount } = await server.pg.write.query(
      //   exposureInsert({
      //     uploadBatchId,
      //     exposures,
      //     origin: region
      //   })
      // )

      const client = await server.pg.write.connect()

      await client.query('BEGIN TRANSACTION')
      await client.query('CREATE TEMP TABLE temp_exposures (LIKE exposures INCLUDING DEFAULTS) ON COMMIT DROP')

      const stream = client.query(copyFrom(`
        COPY temp_exposures (
          upload_batch_id,
          key_data,
          rolling_start_number,
          transmission_risk_level,
          rolling_period,
          regions,
          origin
        ) FROM STDIN WITH (FORMAT csv)`))
      const csv = stringify()
      csv.pipe(stream)

      for (const exposure of exposures) {
        const row = [
          uploadBatchId,
          exposure.keyData,
          exposure.rollingStartNumber,
          exposure.transmissionRiskLevel,
          exposure.rollingPeriod,
          `{${(exposure.regions || []).map(pgEscape).join(',')}}`,
          region
        ]

        csv.write(row)
      }
      csv.end()

      await peos(stream)

      await client.query(`
        INSERT INTO exposures
        SELECT * FROM temp_exposures
        ON CONFLICT ON CONSTRAINT exposures_key_data_unique DO NOTHING
      `)

      await client.query('COMMIT')

      client.release()

      await server.pg.write.query(
        metricsInsert({
          event: 'UPLOAD',
          region,
          value: rowCount
        })
      )

      const rowCount = false
      if (rowCount && options.aws.batchQueueUrl) {
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
