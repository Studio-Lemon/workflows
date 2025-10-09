This reusable `release` workflow can be called from a central `.github` repository or from other repositories to build and publish a plugin ZIP.

How to call from another repository (centralized `.github` repo)

-   Add this to the calling repository's `.github/workflows` directory (example: `.github/workflows/trigger-plugin-release.yml`):

```yaml
name: Call plugin release

on:
    workflow_dispatch:

jobs:
    call-release:
        uses: Studio-Lemon/workflows/.github/workflows/release-plugin/plugin-release.yml@main
        with:
            plugin_name: 'lemon-woo'
        secrets: inherit
```

Notes:

-   Use `secrets: inherit` to forward the caller's secrets to the called workflow (GitHub Actions will only allow this when calling a workflow in the same organization or with proper permissions).
-   The `plugin_dir` path is relative to the repository root of the calling repository.

How to call locally (same repo)

You can also call the workflow locally (from the same repository) by using a `uses` reference to the local path:

```yaml
jobs:
    call-local:
        uses: ./.github/workflows/plugin-release.yml
        with:
            plugin_name: 'lemon-woo'
```

This README is intentionally short — edit as needed for your org's conventions.
