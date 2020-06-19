const AWS = require('aws-sdk')
const pg = require('pg')

const isProduction = /^\s*production\s*$/i.test(process.env.NODE_ENV)
const ssm = new AWS.SSM({ region: process.env.AWS_REGION })
const secretsManager = new AWS.SecretsManager({ region: process.env.AWS_REGION })

async function getParameter(id) {
  const response = await ssm
    .getParameter({ Name: `${process.env.CONFIG_VAR_PREFIX}${id}` })
    .promise()

  return response.Parameter.Value
}

async function getSecret(id) {
  const response = await secretsManager
    .getSecretValue({ SecretId: `${process.env.CONFIG_VAR_PREFIX}${id}` })
    .promise()

  return JSON.parse(response.SecretString)
}

async function getBatchSize() {
  if (isProduction) {
    return Number(await getParameter('batch_size'))
  } else {
    return Number(process.env.BATCH_SIZE)
  }
}

async function getDatabase() {
  require('pg-range').install(pg)

  let client

  if (isProduction) {
    const [{ username: user, password }, host, port, ssl, database] = await Promise.all([
      getSecret('rds'),
      getParameter('db_host'),
      getParameter('db_port'),
      getParameter('db_ssl'),
      getParameter('db_database')
    ])

    client = new pg.Client({
      host,
      database,
      user,
      password,
      port: Number(port),
      ssl: ssl === 'true'
    })
  } else {
    const { user, password, host, port, ssl, database } = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      ssl:  /true/i.test(process.env.DB_SSL),
      database: process.env.DB_DATABASE
    }

    client = new pg.Client({
      host,
      database,
      user,
      password,
      port: Number(port),
      ssl: ssl === 'true'
    })
  }

  await client.connect()

  return client
}

async function getJwtSecret() {
  if (isProduction) {
    const { key } = await getSecret('jwt')

    return key
  } else {
    return process.env.JWT_SECRET
  }
}

function runIfDev(fn) {
  if (!isProduction) {
    fn(JSON.parse(process.argv[2] || '{}'))
      .then(result => {
        console.log(result)
        process.exit(0)
      })
      .catch(error => {
        console.log(error)
        process.exit(1)
      })
  }
}

module.exports = {
  getBatchSize,
  getDatabase,
  getJwtSecret,
  runIfDev
}
