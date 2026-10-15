# @tummycrypt/tinyland-grafana

## 1.0.0

### Major Changes

- RU1 stack: TypeScript 7.0.2 (the native compiler, as the `typescript`
  package), vitest 5.0.3 and vite 8.3.3, all pinned exact (RU5). Node toolchain
  22.22.0; `engines.node` is now `>=22.17.0`. rules_ts 3.10.1 reads the
  TypeScript version from package.json.
- Bazel-only distribution (RU6/RU8). The package is `private: true`; the npm and
  GitHub Packages publish workflow, `publishConfig` and `prepublishOnly` are
  removed. Releases are a signed git tag, a GitHub release and an entry in
  `xoxd-ai/bazel-registry`.
- The unused `tummycrypt_tinyland_otel` `bazel_dep` and its
  `node_modules/@tummycrypt/tinyland-otel` link are removed. Nothing in this
  package imports otel, so consumers no longer receive an otel edge from it.
- Repository, homepage and registry URLs point at `xoxd-ai`.
- `//:pkg` now ships the `.d.ts` declarations under `dist/`. 0.2.x linked a
  package whose `types` entry pointed at files that were not in the Bazel
  artifact.
- Declarations are emitted by TypeScript 7. Member order inside the inferred
  dashboard JSON types differs, and a few optional members that only some panels
  carry are typed `{}` instead of `undefined`. Runtime values are unchanged.

The runtime API is unchanged: the same exports, the same dashboard JSON
(`./dashboards/*`) and the same environment variables.

### Migration

1. Consume the module through Bazel, not npm:

   ```starlark
   bazel_dep(name = "tummycrypt_tinyland_grafana", version = "1.0.0")
   ```

   with `--registry=https://raw.githubusercontent.com/xoxd-ai/bazel-registry/main`
   ahead of BCR, then link it into the app's node_modules:

   ```starlark
   npm_link_package(
       name = "node_modules/@tummycrypt/tinyland-grafana",
       src = "@tummycrypt_tinyland_grafana//:pkg",
   )
   ```

2. Drop any `@tummycrypt/tinyland-grafana` entry from package.json and the pnpm
   lockfile. Versions on npmjs and GitHub Packages are frozen at 0.2.x and will
   be deprecated with a pointer here.
3. If your graph relied on this module to bring in `tummycrypt_tinyland_otel`,
   declare your own `bazel_dep` on otel at the version you use.
4. Consumers that typecheck against the shipped `.d.ts` files should be on
   TypeScript 7.0.2 (the estate pin) or 6.x; the declarations use no TS 7-only
   syntax.

## 0.2.4

- Materialize dashboard JSON assets into `dist/dashboards` under RBE (TIN-1721).

## 0.2.3

- Resolve tinyland-otel through the Bazel module graph instead of npm.

## 0.2.2

### Patch Changes

- Roll forward published package versions so the next release re-establishes npm artifact truth for the current repo contents.
- Updated dependencies
  - @tummycrypt/tinyland-otel@0.2.2

## 0.2.1

### Patch Changes

- 429a49c: Strip .js.map sourcemaps from published packages and resolve workspace:\* dependencies to real version ranges.
- Updated dependencies [429a49c]
  - @tummycrypt/tinyland-otel@0.2.1
