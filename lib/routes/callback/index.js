const fp = require('fastify-plugin')
const schema = require('./schema')
const { deleteCallback, insertCallback, selectCallback, updateCallback } = require('./query')

async function callback(server, options, done) {
  server.route({
    method: 'GET',
    url: '/callback',
    schema: schema.list,
    handler: async request => {
      const { id: nationId } = await request.authenticate()
      const { rows } = await server.pg.read.query(selectCallback({ nationId }))

      return rows
    }
  })

  server.route({
    method: 'POST',
    url: '/callback',
    schema: schema.create,
    handler: async request => {
      const { id: nationId } = await request.authenticate()
      const { url } = request.body
      const { rowCount, rows } = await server.pg.write.query(insertCallback({ nationId, url }))

      if (rowCount === 0) {
        throw new Error()
      }

      const [{ id }] = rows

      return { id, url }
    }
  })

  server.route({
    method: 'PUT',
    url: '/callback/:id',
    schema: schema.update,
    handler: async (request, response) => {
      const { id: nationId } = await request.authenticate()
      const { id } = request.params
      const { url } = request.body

      await server.pg.write.query(updateCallback({ id, nationId, url }))

      response.status(204)
    }
  })

  server.route({
    method: 'DELETE',
    url: '/callback/:id',
    schema: schema.remove,
    handler: async (request, response) => {
      const { id: nationId } = await request.authenticate()
      const { id } = request.params

      await server.pg.write.query(deleteCallback({ id, nationId }))

      response.status(204)
    }
  })

  done()
}

module.exports = fp(callback)
