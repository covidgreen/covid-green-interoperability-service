const SQL = require('@nearform/sql')
const { getBatchSize, getDatabase, runIfDev } = require('./utils')

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

async function updatePreviousBatch(client, tag) {
  const query = SQL`
    UPDATE download_batches
    SET next = ${tag}
    WHERE id IN (
      SELECT id
      FROM download_batches
      WHERE next IS NULL AND tag != ${tag}
      ORDER BY created_at ASC
      LIMIT 1
    )`

  await client.query(query)
}

async function createBatch(client, batchSize) {
  const query = SQL`
    INSERT INTO download_batches DEFAULT VALUES
    RETURNING id, tag`

  const { rows } = await client.query(query)
  const [{ id, tag }] = rows

  await updateExposures(client, batchSize, id)
  await updatePreviousBatch(client, tag)

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

exports.handler = async function(event) {
  const client = await getDatabase()
  const pendingExposures = await countPendingExposures(client)
  const batchSize = await getBatchSize()

  const batchCount = event.Records
    ? Math.floor(pendingExposures / batchSize)
    : Math.ceil(pendingExposures / batchSize)

  for (let i = 0; i < batchCount; i++) {
    await createBatch(client, batchSize)
  }
}

runIfDev(exports.handler)
