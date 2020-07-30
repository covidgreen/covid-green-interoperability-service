const S = require('fluent-schema')

const list = {
  response: {
    200: S.array().items(
      S.object()
        .prop('id', S.string().format('uuid').required())
        .prop('url', S.string().required())
    )
  }
}

const create = {
  body: S.object()
    .prop('url', S.string().required()),
  response: {
    201: S.object()
      .prop('id', S.string().format('uuid').required())
      .prop('url', S.string().required())
  }
}

const update = {
  body: S.object()
    .prop('url', S.string().required()),
  params: S.object()
    .prop('id', S.string().format('uuid').required()),
  response: {
    204: S.null()
  }
}

const remove = {
  params: S.object()
    .prop('id', S.string().format('uuid').required()),
  response: {
    204: S.null()
  }
}

module.exports = { list, create, update, remove }
