# Contact Tracing Interoperability Service

### Set up
​
The interoperability service consists of both a Fastify server. To get this running will require the following steps.
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
