const SQL = require('@nearform/sql')

const uploadBatchInsert = ({ id, batchTag }) =>
  SQL`INSERT INTO upload_batches (nation_id, tag)
      VALUES (${id}, ${batchTag})
      ON CONFLICT ON CONSTRAINT upload_batches_tag_unique
      DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id AS "uploadBatchId"`

const exposureInsert = ({ exposures, uploadBatchId }) => {
  const query = SQL`
    INSERT INTO exposures (
      upload_batch_id,
      key_data,
      rolling_period,
      rolling_start_number,
      transmission_risk_level,
      regions
    ) VALUES
  `

  for (const [
    index,
    {
      keyData,
      rollingPeriod,
      rollingStartNumber,
      transmissionRiskLevel,
      regions
    }
  ] of exposures.entries()) {
    query.append(
      SQL`(
        ${uploadBatchId},
        ${keyData},
        ${rollingPeriod},
        ${rollingStartNumber},
        ${transmissionRiskLevel},
        ${regions}
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

module.exports = { exposureInsert, uploadBatchInsert }
