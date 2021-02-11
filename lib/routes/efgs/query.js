const SQL = require('@nearform/sql')

const certificateSelect = ({ fingerprint, host }) =>
  SQL`SELECT c.id AS "certificateId"
      FROM certificates c
      INNER JOIN nations n ON n.id = c.nation_id
      WHERE host = ${host} AND fingerprint = ${fingerprint}
      AND type = 'signing' AND revoked IS FALSE`

const exposureInsert = ({ exposures, uploadBatchId }) => {
  const query = SQL`
    INSERT INTO exposures (
      upload_batch_id,
      key_data,
      rolling_period,
      rolling_start_number,
      transmission_risk_level,
      regions,
      origin,
      report_type,      
      days_since_onset
    ) VALUES
  `

  for (const [
    index,
    {
      keyData,
      rollingPeriod,
      rollingStartNumber,
      transmissionRiskLevel,
      regions,
      origin,
      reportType,
      daysSinceOnset
    }
  ] of exposures.entries()) {
    query.append(
      SQL`(
        ${uploadBatchId},
        ${keyData},
        ${rollingPeriod},
        ${rollingStartNumber},
        ${transmissionRiskLevel},
        ${regions},
        ${origin},
        ${reportType},
        ${daysSinceOnset}
      )`
    )

    if (index < exposures.length - 1) {
      query.append(SQL`, `)
    }
  }

  query.append(
    SQL` ON CONFLICT ON CONSTRAINT exposures_key_data_unique DO NOTHING`
  )

  return query
}

const selectBatch = ({ batchTag, date }) => {
  const query = SQL`SELECT id, tag AS "batchTag", next AS "nextBatchTag" FROM download_batches WHERE `

  if (batchTag) {
    query.append(SQL`tag = ${batchTag}`)
  } else {
    query.append(SQL`created_at >= ${new Date(date)}::TIMESTAMPTZ`)
  }

  query.append(SQL` ORDER BY id ASC LIMIT 1`)

  return query
}

const selectExposures = ({ batchId, id }) =>
  SQL`SELECT
        e.key_data AS "keyData",
        e.rolling_start_number AS "rollingStartIntervalNumber",
        e.transmission_risk_level AS "transmissionRiskLevel",
        e.rolling_period AS "rollingPeriod",
        e.regions AS "visitedCountries",
        e.origin AS "origin",
        e.report_type AS "reportType",
        e.days_since_onset AS "days_since_onset_of_symptoms"
      FROM exposures e
      INNER JOIN upload_batches b ON b.id = e.upload_batch_id
      WHERE download_batch_id = ${batchId}
      AND b.nation_id != ${id}`

const uploadBatchInsert = ({ id, batchTag, certificateId, signature }) =>
  SQL`INSERT INTO upload_batches (nation_id, tag, certificate_id, signature)
      VALUES (${id}, ${batchTag}, ${certificateId}, ${signature})
      ON CONFLICT ON CONSTRAINT upload_batches_tag_unique
      DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id AS "uploadBatchId"`

module.exports = {
  certificateSelect,
  exposureInsert,
  selectBatch,
  selectExposures,
  uploadBatchInsert
}
