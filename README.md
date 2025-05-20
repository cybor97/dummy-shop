## Dummy e-commerce order handling implementation (only use as a sandbox)

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

### ./sync.ts
- ./sync.ts:76 potential overflow, review or consider not to use event emitter
