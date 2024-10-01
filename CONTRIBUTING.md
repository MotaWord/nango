# Contributes

You can run Nango locally with Docker ([step-by-step guide](https://docs.nango.dev/host/self-host/local)), contribute an API ([step-by-step guide](https://docs.nango.dev/customize/guides/contribute-an-api)) and contribute an integration template ([step-by-step guide](https://docs.nango.dev/contribute-an-integration-template)).

The exact mechanism to build and run multiple containers can be seen here: https://github.com/NangoHQ/nango/blob/master/.github/workflows/build-images.yaml

## Develop locally

To develop on the platform locally follow those steps:

```sh
git clone https://github.com/NangoHQ/nango.git
```

Install the project

```sh
npm i
```

Set your envs

```sh
cp .env.example .env
```

Launch the databases and queue

```sh
npm run dev:docker
```

Launch Nango

```sh
# In two different shell
npm run dev:watch
npm run dev:watch:apps
```

Go to [http://localhost:3000](http://localhost:3000)

If you are encountering an Elasticsearch error like this:
`index_create_block_exception: [index_create_block_exception] Reason: blocked by: [FORBIDDEN/10/cluster create-index blocked (api)]`
then clear your local Elasticsearch/Opensearch volume and start with a clean ES container.

## Run integrations

Start by creating a folder that will contains your integrations

```sh
mkdir nango-integrations
cd nango-integrations
```

Install the CLI

```sh
npm i -g nango
```

```sh
nango init
```

Change the .env file `NANGO_SECRET_KEY_DEV` and `NANGO_HOSTPORT`.
And deploy your changes

```sh
nango deploy dev
```

To know more about the CLI, check the [documentation](https://docs.nango.dev/reference/cli).
