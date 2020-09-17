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
      .prop('nextBatchTag', S.oneOf([S.null(), S.string()]).required())
      .prop(
        'keys',
        S.array().items(
          S.object()
            .prop('keyData', S.string().required())
            .prop('rollingStartIntervalNumber', S.number().required())
            .prop('transmissionRiskLevel', S.number().required())
            .prop('rollingPeriod', S.number().required())
            .prop(
              'visitedCountries',
              S.array()
                .items(S.string())
                .required()
            )
            .prop('origin', S.string().required())
            .prop('reportType', S.oneOf([S.null(), S.string()]).required())
            .prop(
              'days_since_onset_of_symptoms',
              S.oneOf([S.null(), S.string()]).required()
            )
        )
      ),
    204: S.null()
  }
}

const upload = {
  body: S.object().prop(
    'keys',
    S.array()
      .items(
        S.object()
          .prop('keyData', S.string().required())
          .prop('rollingStartIntervalNumber', S.number().required())
          .prop('rollingPeriod', S.number().required())
          .prop('transmissionRiskLevel', S.number())
          .prop(
            'visitedCountries',
            S.array()
              .items(S.string())
              .required()
          )
          .prop('origin', S.string().required())
          .prop('days_since_onset_of_symptoms', S.number().required())
          .prop(
            'reportType',
            S.string()
              .enum([
                'CONFIRMED_CLINICAL_DIAGNOSIS',
                'CONFIRMED_TEST',
                'RECURSIVE',
                'REVOKED',
                'SELF_REPORTED',
                'UNKNOWN'
              ])
              .required()
          )
      )
      .required()
  ),
  headers: S.object()
    .prop('batchTag', S.string())
    .prop('batchSignature', S.string()),
  response: {
    204: S.null()
  }
}

module.exports = { download, upload }
