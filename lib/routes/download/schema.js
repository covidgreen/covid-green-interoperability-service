const S = require('fluent-schema')

const download = {
  params: S.object().prop(
    'date',
    S.string()
      .format('date')
      .required()
  ),
  query: S.object().prop('batchTag', S.string()),
  response: {
    200: S.object()
      .prop('batchTag', S.string().required())
      .prop(
        'exposures',
        S.array().items(
          S.object()
            .prop('keyData', S.string().required())
            .prop('rollingStartNumber', S.number().required())
            .prop('transmissionRiskLevel', S.number().required())
            .prop('rollingPeriod', S.number().required())
            .prop(
              'regions',
              S.array()
                .items(S.string())
                .required()
            )
        )
      ),
    204: S.null()
  }
}

module.exports = { download }
