## Dummy e-comerce order handling implementation (only use as a sendbox)

## Quick start

Create .env or provide environment variables according to [.env.example](.env.example)

```
yarn && yarn build
```

## Run (dev)

Start app (customers generator)

```
yarn start-app
```

Start sync (live)

```
yarn start-sync:live
```

Start sync (full reindex)

```
yarn start-sync:full-reindex
```

## Run (prod)

Start app (customers generator)

```
node dist/app
```

Start sync (live)

```
node dist/sync
```

Start sync (full reindex)

```
yarn dist/sync --full-reindex
```

## Issues
### ./app.ts
* ./app.ts:13 ./sync.ts:96 connection error handling
* ./app.ts:17 redundant count call. Unrecommended inline async operation
* ./app.ts:20 review `setInterval` usage, missing error handling
* ./app.ts:38 abbreviated `state`
* ./app.ts:40 abbreviated `countryCode`
### ./sync.ts
* ./sync.ts:102 ./lifecycle.ts:10 missing error handling
* ./sync.ts:76 missing dry run
* ./sync.ts:76 potential overflow, review or consider not to use event emitter
* ./sync.ts:77 missing `update` handling
### ./lifecycle.ts
* ./lifecycle.ts:5 review `interval` property lifecycle
### misc
* ./README.md:3 missing `engines` specification in ./package.json
* ./package.json:27 `devDependencies` misuse
