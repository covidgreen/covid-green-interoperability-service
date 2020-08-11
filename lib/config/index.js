const envSchema = require('env-schema')
const S = require('fluent-schema')
const AWS = require('aws-sdk')
const { version } = require('../../package.json')

async function getConfig() {
  const env = envSchema({
    dotenv: true,
    schema: S.object()
      .prop('CONFIG_VAR_PREFIX', S.string())
      .prop('NODE_ENV', S.string())
      .prop('API_HOST', S.string())
      .prop('API_PORT', S.string())
      .prop('CORS_ORIGIN', S.string())
      .prop('DB_HOST', S.string())
      .prop('DB_READ_HOST', S.string())
      .prop('DB_PORT', S.string())
      .prop('DB_USER', S.string())
      .prop('DB_PASSWORD', S.string())
      .prop('DB_DATABASE', S.string())
      .prop('DB_SSL', S.boolean())
      .prop(
        'LOG_LEVEL',
        S.string()
          .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
          .default('info')
      )
      .prop('AWS_ACCESS_KEY_ID', S.string())
      .prop('AWS_SECRET_ACCESS_KEY', S.string())
      .prop('AWS_REGION', S.string())
      .prop('JWT_SECRET', S.string())
      .prop('BATCH_URL', S.string())
  })

  const isProduction = /^\s*production\s*$/i.test(env.NODE_ENV)

  const config = {
    isProduction,
    fastify: {
      host: env.API_HOST,
      port: +env.API_PORT
    },
    fastifyInit: {
      trustProxy: 2,
      logger: {
        level: env.LOG_LEVEL
      }
    },
    underPressure: {},
    cors: { origin: /true/i.test(env.CORS_ORIGIN) },
    pgPlugin: {
      read: env.DB_READ_HOST,
      write: env.DB_HOST,
      config: {
        port: +env.DB_PORT,
        ssl: env.DB_SSL,
        database: env.DB_DATABASE,
        user: env.DB_USER,
        password: env.DB_PASSWORD
      }
    },
    swagger: {
      routePrefix: '/docs',
      exposeRoute: true,
      swagger: {
        info: {
          title: 'Contact Tracing Interoperability Service',
          description: 'Interoperability service for contact tracing',
          version
        }
      }
    },
    security: {
      jwtSecret: env.JWT_SECRET
    },
    aws: {
      batchQueueUrl: env.BATCH_URL
    }
  }

  if (isProduction) {
    const ssm = new AWS.SSM({ region: env.AWS_REGION })
    const secretsManager = new AWS.SecretsManager({ region: env.AWS_REGION })

    const getParameter = async id => {
      const response = await ssm
        .getParameter({ Name: `${env.CONFIG_VAR_PREFIX}${id}` })
        .promise()

      return response.Parameter.Value
    }

    const getSecret = async id => {
      const response = await secretsManager
        .getSecretValue({ SecretId: `${env.CONFIG_VAR_PREFIX}${id}` })
        .promise()

      return JSON.parse(response.SecretString)
    }

    const jwtSecret = await getSecret('jwt')
    const rdsSecret = await getSecret('rds')

    config.fastify.host = await getParameter('interop_host')
    config.fastify.port = Number(await getParameter('interop_port'))
    config.fastifyInit.logger.level = await getParameter('log_level')
    config.cors.origin = /true/i.test(await getParameter('cors_origin'))
    config.aws.batchQueueUrl = await getParameter('batch_url')

    config.pgPlugin.read = await getParameter('db_reader_host')
    config.pgPlugin.write = await getParameter('db_host')
    config.pgPlugin.config.port = Number(await getParameter('db_port'))
    config.pgPlugin.config.ssl = /true/i.test(await getParameter('db_ssl'))
    config.pgPlugin.config.database = await getParameter('db_database')

    config.pgPlugin.config.user = rdsSecret.username
    config.pgPlugin.config.password = rdsSecret.password
    config.security.jwtSecret = jwtSecret.key
  }

  return config
}

module.exports = getConfig
