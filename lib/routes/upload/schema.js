const S = require('fluent-schema')

const upload = {
  body: S.object()
    .prop('batchTag', S.string().required())
    .prop(
      'exposures',
      S.array().required().items(
        S.object()
          .prop('keyData', S.string().required())
          .prop('rollingStartNumber', S.number().required())
          .prop('transmissionRiskLevel', S.number().required())
          .prop('rollingPeriod', S.number().required())
          .prop('regions', S.array().items(S.string()).required())
      )
    ),
  response: {
    201: S.object().prop('batchTag', S.string()),
    204: S.null()
  }
}

module.exports = { upload }
