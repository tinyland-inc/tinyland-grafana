# @tummycrypt/tinyland-grafana

Grafana API client, configuration and dashboard definitions for Tinyland
observability. It exports `GrafanaClient`, the configuration helpers
(`configureGrafana`, `buildGrafanaConfig`, `validateGrafanaConfig`, ...), time
range utilities, and four dashboards (`a11y-monitoring`, `security-monitoring`,
`service-topology`, `trpc-performance`) as JSON modules and under
`./dashboards/*`.

## Install (Bazel only)

This package is distributed only as a Bazel module from
[xoxd-ai/bazel-registry](https://github.com/xoxd-ai/bazel-registry). It is not
published to npm.

```starlark
# MODULE.bazel
bazel_dep(name = "tummycrypt_tinyland_grafana", version = "1.0.0")
```

```starlark
# BUILD.bazel
npm_link_package(
    name = "node_modules/@tummycrypt/tinyland-grafana",
    src = "@tummycrypt_tinyland_grafana//:pkg",
)
```

`.bazelrc`:

```
common --registry=https://raw.githubusercontent.com/xoxd-ai/bazel-registry/main
common --registry=https://bcr.bazel.build
```

## Development

```bash
pnpm install
pnpm typecheck && pnpm test && pnpm build
bazel build //:pkg //:typecheck
bazel test //...
```

Toolchain: TypeScript 7.0.2, vitest 5.0.3, vite 8.3.3 (exact), Node 22,
pnpm 10.13.1, Bazel 8.1.1.

## Release

A release is a signed annotated tag `vX.Y.Z`, a GitHub release, and a
bazel-registry PR whose `source.json` integrity is computed from the real
`archive/refs/tags/vX.Y.Z.tar.gz`. Keep `package.json`, `MODULE.bazel` and the
`npm_package` version in `BUILD.bazel` in step.
