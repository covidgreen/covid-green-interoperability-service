const SQL = require('@nearform/sql')

const uploadBatchInsert = ({ id, batchTag }) =>
  SQL`INSERT INTO upload_batches (nation_id, tag)
      VALUES (${id}, ${batchTag})
      ON CONFLICT ON CONSTRAINT upload_batches_tag_unique
      DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id AS "uploadBatchId"`

const prepareExposureCopy = () => 'CREATE TEMP TABLE temp_exposures (LIKE exposures INCLUDING DEFAULTS) ON COMMIT DROP'

const exposureCopy = () => {
  return `
    COPY temp_exposures (
      upload_batch_id,
      key_data,
      rolling_start_number,
      transmission_risk_level,
      rolling_period,
      regions,
      origin
    ) FROM STDIN WITH (FORMAT csv)
   `
}

const completeExposureCopy = () => `
    INSERT INTO exposures
    SELECT * FROM temp_exposures
    ON CONFLICT ON CONSTRAINT exposures_key_data_unique DO NOTHING
  `

module.exports = {
  prepareExposureCopy,
  exposureCopy,
  completeExposureCopy,
  uploadBatchInsert
}
