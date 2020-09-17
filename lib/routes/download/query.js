const SQL = require('@nearform/sql')

const selectBatch = ({ batchTag, date }) => {
  const query = SQL`SELECT id, tag FROM download_batches WHERE `

  if (batchTag) {
    query.append(
      SQL`id > (SELECT id FROM download_batches WHERE tag = ${batchTag})`
    )
  } else {
    query.append(SQL`created_at >= ${new Date(date)}::TIMESTAMPTZ`)
  }

  query.append(SQL` ORDER BY id ASC LIMIT 1`)

  return query
}

const selectExposures = ({ batchId, id }) =>
  SQL`SELECT
        e.key_data AS "keyData",
        e.rolling_start_number AS "rollingStartNumber",
        e.transmission_risk_level AS "transmissionRiskLevel",
        e.rolling_period AS "rollingPeriod",
        e.regions AS "regions"
      FROM exposures e
      INNER JOIN upload_batches b ON b.id = e.upload_batch_id
      WHERE download_batch_id = ${batchId}
      AND b.nation_id != ${id}`

module.exports = { selectBatch, selectExposures }
