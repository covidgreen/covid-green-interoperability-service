const fp = require('fastify-plugin')
const jsrsasign = require('jsrsasign')
const schema = require('./schema')
const { BadRequest } = require('http-errors')
const { SQS } = require('aws-sdk')
const {
  certificateSelect,
  exposureInsert,
  selectBatch,
  selectExposures,
  uploadBatchInsert
} = require('./query')

async function efgs(server, options, done) {
  const sqs = new SQS({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  })

  const reportTypes = {
    CONFIRMED_TEST: 1,
    CONFIRMED_CLINICAL_DIAGNOSIS: 2,
    SELF_REPORT: 3,
    RECURSIVE: 4,
    REVOKED: 5
  }

  server.route({
    method: 'POST',
    url: '/efgs/upload',
    schema: schema.upload,
    handler: async (request, response) => {
      const { id, region } = await request.authenticate()
      const { keys } = request.body

      const { batchsignature, batchtag } = request.headers

      const signatureData = jsrsasign.KJUR.asn1.cms.CMSUtil.verifySignedData({
        cms: Buffer.from(batchsignature, 'base64').toString('hex')
      })

      const fingerprint = jsrsasign.KJUR.crypto.Util.hashHex(
        signatureData.certs[0].hex,
        'sha256'
      )
      const [{ value: host }] = signatureData.certs[0]
        .getIssuer()
        .array.find(([{ type }]) => type === 'CN')

      const {
        rowCount: certificateRowCount,
        rows: certificateRows
      } = await server.pg.read.query(
        certificateSelect({ fingerprint, host, id })
      )

      if (certificateRowCount === 0) {
        throw new BadRequest('Invalid certificate')
      }

      const [{ certificateId }] = certificateRows

      const data = Buffer.concat(
        keys
          .sort((a, b) => {
            if (a.keyData < b.keyData) {
              return -1
            }

            if (a.keyData > b.keyData) {
              return 1
            }

            return 0
          })
          .map(
            ({
              keyData,
              rollingStartIntervalNumber,
              rollingPeriod,
              transmissionRiskLevel,
              visitedCountries,
              origin,
              reportType,
              days_since_onset_of_symptoms
            }) => {
              if (origin !== region) {
                throw new Error('Origin does not match')
              }

              const rollingStartIntervalNumberBuffer = Buffer.alloc(4)
              const rollingPeriodBuffer = Buffer.alloc(4)
              const transmissionRiskLevelBuffer = Buffer.alloc(4)
              const reportTypeBuffer = Buffer.alloc(4)
              const daysSinceOnsetOfSymptomsBuffer = Buffer.alloc(4)

              rollingStartIntervalNumberBuffer.writeUInt32BE(
                rollingStartIntervalNumber
              )
              rollingPeriodBuffer.writeUInt32BE(rollingPeriod)
              transmissionRiskLevelBuffer.writeInt32BE(transmissionRiskLevel)
              reportTypeBuffer.writeInt32BE(reportTypes[reportType] || 0)
              daysSinceOnsetOfSymptomsBuffer.writeUInt32BE(
                days_since_onset_of_symptoms
              )

              return Buffer.concat([
                Buffer.from(Buffer.from(keyData, 'base64').toString('utf-8')),
                rollingStartIntervalNumberBuffer,
                rollingPeriodBuffer,
                transmissionRiskLevelBuffer,
                ...visitedCountries.map(country => Buffer.from(country)),
                Buffer.from(origin),
                reportTypeBuffer,
                daysSinceOnsetOfSymptomsBuffer
              ])
            }
          )
      )

      if (data.toString('hex') !== signatureData.parse.econtent) {
        throw new BadRequest('Signature does not match')
      }

      const resolvedKeys = keys.map(
        ({
          keyData,
          rollingStartIntervalNumber,
          rollingPeriod,
          transmissionRiskLevel,
          visitedCountries,
          reportType,
          days_since_onset_of_symptoms
        }) => ({
          keyData,
          rollingPeriod,
          rollingStartNumber: rollingStartIntervalNumber,
          transmissionRiskLevel,
          regions: visitedCountries,
          origin: region,
          reportType,
          daysSinceOnset: days_since_onset_of_symptoms
        })
      )

      const { rows: batchRows } = await server.pg.write.query(
        uploadBatchInsert({
          id,
          batchTag: batchtag,
          certificateId: certificateId,
          signature: batchsignature
        })
      )

      const [{ uploadBatchId }] = batchRows

      const { rowCount: exposureRowCount } = await server.pg.write.query(
        exposureInsert({
          uploadBatchId,
          exposures: resolvedKeys
        })
      )

      if (exposureRowCount && options.aws.batchQueueUrl) {
        const message = {
          QueueUrl: options.aws.batchQueueUrl,
          MessageBody: JSON.stringify({})
        }

        await sqs.sendMessage(message).promise()
      }

      response.status(204)
    }
  })

  server.route({
    method: 'GET',
    url: '/efgs/download/:date',
    schema: schema.download,
    handler: async (request, response) => {
      const { id } = await request.authenticate()
      const { date } = request.params

      const { rowCount, rows: batchRows } = await server.pg.read.query(
        selectBatch({
          batchTag: request.query.batchTag || request.headers.batchtag || null,
          date
        })
      )

      if (rowCount === 0) {
        response.status(204)
      } else {
        const [{ id: batchId, batchTag, nextBatchTag }] = batchRows
        const { rows: exposureRows } = await server.pg.read.query(
          selectExposures({ batchId, id })
        )

        response.headers({ batchTag, nextBatchTag })

        return {
          batchTag,
          nextBatchTag,
          keys: exposureRows
        }
      }
    }
  })

  done()
}

module.exports = fp(efgs)
