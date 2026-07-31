# Plugin Release Workflow

This reusable `plugin-release` workflow can be called from a central `.github` repository or from other repositories to build and publish a WordPress plugin ZIP.

## Inputs

### `plugin_name` (required)

- **Type:** `string`
- **Description:** Logical plugin name (e.g. `lemon-woo`). Used as the ZIP filename and directory prefix inside the archive.
- **Default:** `plugin`

### `node_version` (optional)

- **Type:** `string`
- **Description:** Node.js version to use for building.
- **Default:** `lts/*`

### `deploy_to_satispress` (optional)

- **Type:** `boolean`
- **Description:** When `true`, deploys the plugin to the satispress server via rsync after the release. Requires `remote_host`, `remote_user` secret, and the `deploy_key` secret.
- **Default:** `false`

### `remote_host` (optional)

- **Type:** `string`
- **Description:** SSH hostname of the satispress server.

### `remote_port` (optional)

- **Type:** `number`
- **Description:** SSH port of the satispress server.
- **Default:** `22`

## Secrets

> Set these in your repository's **Settings → Secrets and variables → Actions**.

### `satispress_deploy_key` (optional)

- **Description:** Private SSH key used for the rsync deployment. Required when `deploy_to_satispress` is `true`.

### `satispress_user` (optional)

- **Description:** SSH user on the satispress server. Kept as a secret to avoid leaking server configuration. Required when `deploy_to_satispress` is `true`.

## How to Use

### Calling from Another Repository (Centralized Approach)

```yaml
name: Call plugin release

on:
  workflow_dispatch:

jobs:
  call-release:
    uses: Studio-Lemon/workflows/.github/workflows/plugin-release.yml@main
    with:
      plugin_name: "lemon-woo"
    secrets: inherit
```

### With Satispress Deployment

Set `SATISPRESS_DEPLOY_KEY` and `SATISPRESS_USER` as repository secrets, then use `secrets: inherit`.

```yaml
jobs:
  call-release:
    uses: Studio-Lemon/workflows/.github/workflows/plugin-release.yml@main
    with:
      plugin_name: "lemon-woo"
      deploy_to_satispress: true
      remote_host: packagist.studiolemon.nl
    secrets: inherit
```

The deploy step uses the [rsync-to-satispress](./rsync-to-satispress.md) action with `type` automatically set to `plugin`. Exclude patterns are read from your `.gitattributes` `export-ignore` entries.

### Calling Locally (Same Repository)

```yaml
jobs:
  call-local:
    uses: ./.github/workflows/plugin-release.yml
    with:
      plugin_name: "lemon-woo"
```

## Notes

- Use `secrets: inherit` to forward the caller's secrets to the called workflow (only allowed within the same organization or with proper permissions).
