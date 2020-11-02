const SQL = require('@nearform/sql')

const metricsInsert = ({ event, region, value }) =>
  SQL`INSERT INTO metrics (date, event, region, value)
      VALUES (CURRENT_DATE, ${event}, ${region}, ${value})
      ON CONFLICT ON CONSTRAINT metrics_pkey
      DO UPDATE SET value = metrics.value + ${value}`

const metricsSelect = ({ metrics, startDate, endDate, summary, daily }) => {
  const query = SQL`SELECT `

  if (summary) {
    query.append(SQL`event, SUM(value) AS "value"`)
  } else if (daily) {
    query.append(SQL`date, event, SUM(value) AS "value"`)
  } else {
    query.append(SQL`date, event, region, value`)
  }

  query.append(
    SQL` FROM metrics WHERE date >= ${new Date(
      startDate
    )} AND date <= ${new Date(endDate)} `
  )

  if (metrics.length > 0) {
    query.append(SQL`AND event IN (`)
    query.append(
      SQL.glue(
        metrics.map(metric => SQL`${metric}`),
        ', '
      )
    )
    query.append(SQL`)`)
  }

  if (summary) {
    query.append(SQL` GROUP BY event ORDER BY event`)
  } else if (daily) {
    query.append(SQL` GROUP BY event, date ORDER BY date, event`)
  } else {
    query.append(SQL` ORDER BY date, event, region`)
  }

  return query
}

module.exports = { metricsInsert, metricsSelect }
