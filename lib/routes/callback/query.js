const SQL = require('@nearform/sql')

const deleteCallback = ({ id, nationId }) =>
  SQL`DELETE FROM callbacks WHERE id = ${id} AND nation_id = ${nationId}`

const insertCallback = ({ nationId, url }) =>
  SQL`INSERT INTO callbacks (nation_id, url)
      VALUES (${nationId}, ${url})
      RETURNING id`

const selectCallback = ({ nationId }) =>
  SQL`SELECT id, url FROM callbacks WHERE nation_id = ${nationId}`

const updateCallback = ({ id, nationId, url }) =>
  SQL`UPDATE callbacks SET url = ${url}
      WHERE id = ${id} AND nation_id = ${nationId}`

module.exports = { deleteCallback, insertCallback, selectCallback, updateCallback }
