<img alttext="COVID Green Logo" src="https://raw.githubusercontent.com/lfph/artwork/master/projects/covidgreen/stacked/color/covidgreen-stacked-color.png" width="300" />

# Contact Tracing Interoperability Service

### Set up
​
The interoperability service consists of a Fastify server. To get this running will require the following steps.
​
- Install the dependencies and create a basic environment configuration.
​
```bash
npm install
npm run create:env
```

- If this is your first time running the database, you have previously deleted it, or migrations have been added, you will need to run migrations.
​
```bash
npm run db:migrate
```
​
- Start the server in development mode.
​
```bash
npm run start:dev
```
​
### Development
​
There are a number of handy commands you can run to help with development.
​
|Command | Action |
|---|---|
|`npm run start:dev` | Run the server in dev mode, automatically restarts on file change |
|`npm run create:env`| Create a new .env file |
|`npm test`| Run unit tests |
|`npm run test:watch`| Run backend tests in watch mode, running on changed test files |
|`npm run db:migrate`| Run database migrations. |
|`npm run db:up`| Run the database server |
|`npm run db:down`| Shutdown the database server |
|`npm run db:delete`| Delete the database server. You will need to run `db:up` and `db:migrate` again. |
|`npm run lint`| Run eslint |
|`npm run lint:fix`| Run eslint in fix mode |

### Onboarding

1) Client (national back-end) generates an asymmetric key pair. Recommend matching GAEN requirements.

```sh
openssl ecparam -out private.pem -name prime256v1 -genkey -noout
```
```sh
openssl ec -in private.pem -pubout -out public.pem
```

2) Public key is provided to interop service and is used as input to `token` lambda, which returns a JWT as its output which is provided to the client. An `Authorization: Bearer {{token}}` header should be included in all requests from the client to the interop service.

```json
{
  "region": "{{region}}",
  "key": "{{publicKey}}"
}
```

3) Optionally, the client can create a callback URL. When a new batch is available for download, the interop service will make a GET request to this URL.

### Upload

Exposure keys should be regularly upload from the client to the interop service using the `POST /upload` endpoint. The request body should include two properties: `batchTag` and `payload`.

The `batchTag` can be chosen arbitrarily by the client. Any exposure keys will be appended to the batchTag on the interop service, and in the future may be used to revoke uploaded exposures.

The `payload` must be a compact format JWS where the payload is an array of exposures, signed by the private key generated during the onboarding process. Here is some sample JS code using the node-jose package.

```js
const jose = require('node-jose')
const fs = require('fs')
const uuid = require('uuid')
async function getUploadBody() {
  const privateKeyPem = fs.readFileSync('private.pem')
  const privateKey = await jose.JWK.asKey(privateKeyPem, 'pem')
  const sign = jose.JWS.createSign({ format: 'compact' }, privateKey)
  const exposures = [
    {
      transmissionRiskLevel: 0,
      rollingStartNumber: 2653721,
      keyData: "kRFEb8LFabuOTvPgrKKrtA==",
      rollingPeriod: 144,
      regions: ["IE"]
    }
  ]
  const batchTag = uuid.v4()
  const payload = await sign.update(JSON.stringify(exposures), 'utf8').final()
  return { batchTag, payload }
}
```

If new exposures get written, it will return a 200 response with the request `batchTag` as the response body. If the request is successful but no new exposures are stored, then it will return a 204 response with no body.

### Batching

Exposures that are uploaded are not available for download immediately. In order to improve caching options, exposures are grouped into batches either when the number of unbatched exposures exceeds a threshold (currently 1000), or after a fixed period of time (currently every 2 hours). The batches are then assigned a `batchTag` as a unique identifier - this is unrelated to the `batchTag` used when uploading the exposures.

### Download

New batches of exposures can be downloaded regularly by using the `GET /download/:date` endpoint. The date provided (YYYY-MM-DD format) is the date of the oldest batch that the client is interested in downloading. Additionally, the client can provide `batchTag` as a query parameter to get batches created after a given batch. The response will be a 200 with a body containing the `batchTag` and an array of `exposures`. If there are no batches available to download, the response will be 204 with no body.

For example, a request to `GET /download/2020-07-01` will return the first batch created on or after 1st July 2020.

```json
{
  "batchTag": "d66f3152-bf2d-49a9-94e5-006d4707f6c1",
  "exposures": [
    { ... }
  ]
}
```

A subsequent request to `GET /download/2020-07-01?batchTag=d66f3152-bf2d-49a9-94e5-006d4707f6c1` will then return the first batch created on or after 1st July 2020, and also created after a batch with the tag `d66f3152-bf2d-49a9-94e5-006d4707f6c1`.

```json
{
  "batchTag": "90ed69ee-da9d-4876-909e-46e6ac8b29e9",
  "exposures": [
    { ... }
  ]
}
```

## Team

### Lead Maintainers

* @colmharte - Colm Harte <colm.harte@nearform.com>
* @jasnell - James M Snell <jasnell@gmail.com>
* @aspiringarc - Gar Mac Críosta <gar.maccriosta@hse.ie>

### Core Team

* @ShaunBaker - Shaun Baker <shaun.baker@nearform.com>
* @floridemai - Paul Negrutiu <paul.negrutiu@nearform.com>
* @jackdclark - Jack Clark <jack.clark@nearform.com>
* @andreaforni - Andrea Forni <andrea.forni@nearform.com>
* @jackmurdoch - Jack Murdoch <jack.murdoch@nearform.com>

### Contributors

* @dennisgove - Dennis Gove <dgove1@bloomberg.net>
* @dharding - David J Harding <davidjasonharding@gmail.com>
* @fiacc - Fiac O'Brien Moran <fiacc.obrienmoran@nearform.com>

### Past Contributors

* TBD
* TBD

## Hosted By

<a href="https://www.lfph.io"><img alttext="Linux Foundation Public Health Logo" src="https://raw.githubusercontent.com/lfph/artwork/master/lfph/stacked/color/lfph-stacked-color.svg" width="200"></a>

[Linux Foundation Public Health](https://www.lfph.io)

## Acknowledgements

<a href="https://nearform.com"><img alttext="NearForm Logo" src="https://openjsf.org/wp-content/uploads/sites/84/2019/04/nearform.png" width="400" /></a>

## License

Copyright (c) 2020 NearForm
Copyright (c) The COVID Green Contributors

[Licensed](LICENSE) under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
