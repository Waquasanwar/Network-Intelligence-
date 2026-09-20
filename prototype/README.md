# Live prototype

A browser-only build of the product that runs with no server: the same domain logic as the
Next.js app (`src/lib/matching`, `availability`, `ai/heuristic`, `csv`, `authz`) bundled with a
vanilla TypeScript UI, seeded with the demo network, and persisted through the claude.ai artifact
data store (falls back to localStorage anywhere else).

```bash
node prototype/build.mjs      # writes prototype/dist/index.html (single file)
```

Publish `prototype/dist/index.html` as an artifact with `capabilities: { db: {} }` for shared,
persistent data. Everything the user enters (people, conversations, decisions, imports) is stored
in named collections and can be exported later into the hosted application.
