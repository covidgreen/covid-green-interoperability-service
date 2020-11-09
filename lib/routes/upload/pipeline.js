const copyFrom = require('pg-copy-streams').from
const stringify = require('csv-stringify')
const { pipeline } = require('stream')

const {
  exposureCopy,
  prepareExposureCopy,
  completeExposureCopy
} = require('./query')

async function pp(pool, fn) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN TRANSACTION')
    await client.query(prepareExposureCopy())

    await new Promise((resolve, reject) => {
      const csv = stringify()
      const db = client.query(copyFrom(exposureCopy()))

      pipeline(
        csv,
        db,
        err => err ? reject(err) : resolve()
      )

      fn(csv)

      csv.end()
    })

    const { rowCount } = await client.query(completeExposureCopy())

    await client.query('COMMIT')

    client.release()

    return rowCount
  } catch(error) {
    client.release(error)
    throw error
  }
}

module.exports = pp