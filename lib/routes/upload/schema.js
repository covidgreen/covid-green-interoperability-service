const S = require('fluent-schema')

const upload = {
  body: S.object()
    .prop('batchTag', S.string().required())
    .prop('payload', S.string().required()),
  response: {
    201: S.object().prop('batchTag', S.string()),
    204: S.null()
  }
}

module.exports = { upload }
