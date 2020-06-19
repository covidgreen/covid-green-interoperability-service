const fetch = require('node-fetch')
const querystring = require('querystring')
const SQL = require('@nearform/sql')
const { getBatchSize, getDatabase, runIfDev } = require('./utils')

async function triggerCallbacks(client, batchTag) {
  const { rows } = await client.query(SQL`SELECT url FROM callbacks`)

  for (const { url } of rows) {
    try {
      const query = querystring.stringify({
        batchTag,
        date: new Date().toISOString().substr(0, 10)
      })

      await fetch(`${url}?${query}`, { method: 'GET' })

      console.log(`request succeeded to ${url}`)
    } catch {
      console.log(`request failed to ${url}`)
    }
  }
}

async function updateExposures(client, batchSize, batchId) {
  const query = SQL`
    WITH batch AS (
      SELECT id FROM exposures
      WHERE download_batch_id IS NULL
      LIMIT ${batchSize}
    )
    UPDATE exposures SET download_batch_id = ${batchId}
    WHERE id IN (SELECT id FROM batch)`

  await client.query(query)
}

async function createBatch(client, batchSize) {
  const query = SQL`
    INSERT INTO download_batches DEFAULT VALUES
    RETURNING id`

  const { rows } = await client.query(query)
  const [{ id }] = rows

  await updateExposures(client, batchSize, id)

  console.log(`created batch ${id}`)

  return id
}

async function countPendingExposures(client) {
  const query = SQL`
    SELECT COUNT(id) AS "count"
    FROM exposures
    WHERE download_batch_id IS NULL`

  const { rows } = await client.query(query)
  const [{ count }] = rows

  return Number(count)
}

exports.handler = async function (event) {
  const client = await getDatabase()
  const pendingExposures = await countPendingExposures(client)
  const batchSize = await getBatchSize()
  const promises = []

  const batchCount = event.Records ? 
    Math.floor(pendingExposures / batchSize) :
    Math.ceil(pendingExposures / batchSize)


  for (let i = 0; i < batchCount; i++) {
    const id = await createBatch(client, batchSize)
    
    promises.push(triggerCallbacks(client, id))
  }

  await Promise.all(promises)
}

runIfDev(exports.handler)
