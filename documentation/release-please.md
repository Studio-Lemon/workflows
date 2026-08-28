# Release Please Workflow

The reusable `release-please` workflow runs [Release Please](https://github.com/googleapis/release-please) when changes are pushed to your default branch. It creates or updates the release pull request and, after that pull request is merged, creates the GitHub release.

## Inputs

### `config_file` (optional)

- **Type:** `string`
- **Description:** Path to the Release Please configuration file.
- **Default:** `release-please-config.json`

### `manifest_file` (optional)

- **Type:** `string`
- **Description:** Path to the Release Please manifest file.
- **Default:** `.release-please-manifest.json`

## Secrets

### `release_please_token` (required)

A personal access token (PAT) with permission to create and merge pull requests and releases in the repository. Do not use `GITHUB_TOKEN`: releases created with that token do not trigger downstream workflows such as a release deployment workflow.

Store the PAT as a repository or organization Actions secret named `RELEASE_PLEASE_TOKEN`.

## How to Use

Create a caller workflow in the consuming repository at `.github/workflows/release-please.yml`:

```yaml
name: Release Please

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    uses: Studio-Lemon/workflows/.github/workflows/release-please.yml@main
    secrets:
      release_please_token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
```

The caller's branch must match the repository's release source branch. For a different branch, replace `main` in the `branches` list.

### Using Custom File Paths

```yaml
jobs:
  release-please:
    uses: Studio-Lemon/workflows/.github/workflows/release-please.yml@main
    with:
      config_file: .github/release-please-config.json
      manifest_file: .github/.release-please-manifest.json
    secrets:
      release_please_token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
```

## Requirements

- The consuming repository must contain a Release Please configuration file and manifest file, unless custom paths are supplied.
- The caller workflow must grant `contents: write` and `pull-requests: write`.
- `RELEASE_PLEASE_TOKEN` must be configured as an Actions secret.

## Notes

- Pin `@main` to a commit SHA when your repository requires immutable workflow dependencies.
- The reusable workflow does not define `push` or `workflow_dispatch`; those triggers belong in the caller workflow.
