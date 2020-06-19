const fp = require('fastify-plugin')
const { Forbidden } = require('http-errors')

async function jwt(server, options) {
  function authenticate() {
    try {
      const data = server.jwt.verify(
        this.headers.authorization.replace(/^Bearer /, '')
      )

      this.log.info(data, 'authorised user')

      return data
    } catch (error) {
      this.log.info(error, 'error verifying jwt')

      throw new Forbidden()
    }
  }

  server.register(require('fastify-jwt'), { secret: options.security.jwtSecret })
  server.decorateRequest('authenticate', authenticate)
}

module.exports = fp(jwt)
