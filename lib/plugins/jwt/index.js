const fp = require('fastify-plugin')
const SQL = require('@nearform/sql')
const { Unauthorized } = require('http-errors')

async function jwt(server, options) {
  async function authenticate() {
    try {
      const data = server.jwt.verify(
        this.headers.authorization.replace(/^Bearer /, '')
      )
      const query = SQL`SELECT id, public_key AS "publicKey", region FROM nations WHERE id = ${data.id}`
      const { rowCount, rows } = await server.pg.read.query(query)

      if (rowCount === 0) {
        throw new Error()
      }

      const [{ id, publicKey, region }] = rows

      this.log.info(data, 'authorised user')

      return { id, publicKey, region }
    } catch (error) {
      this.log.info(error, 'error verifying jwt')

      throw new Unauthorized()
    }
  }

  server.register(require('fastify-jwt'), {
    secret: options.security.jwtSecret
  })
  server.decorateRequest('authenticate', authenticate)
}

module.exports = fp(jwt)
