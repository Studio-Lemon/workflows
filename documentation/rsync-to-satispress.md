# rsync-to-satispress Action

A composite action that deploys a WordPress theme or plugin to a satispress server via rsync. Exclude patterns are read automatically from `.gitattributes` `export-ignore` entries, so there is only one place to manage what gets shipped.

## Inputs

### `type` (required)

- **Type:** `string`
- **Values:** `theme` or `plugin`
- **Description:** Determines the remote path — `files/wp-content/themes/<name>` or `files/wp-content/plugins/<name>`.

### `name` (required)

- **Type:** `string`
- **Description:** The theme or plugin directory name on the remote server (e.g. `wp-lemon`, `lemon-woo`).

### `remote_host` (required)

- **Type:** `string`
- **Description:** SSH hostname of the satispress server.

### `remote_port` (optional)

- **Type:** `string`
- **Default:** `22`
- **Description:** SSH port.

### `remote_user` (required)

- **Type:** `string`
- **Description:** SSH user on the remote server. Pass a repository secret here — never hardcode it.

- **Type:** `string`
- **Description:** SSH user on the remote server.

### `deploy_key` (required)

- **Type:** `string`
- **Description:** Private SSH key for deployment. Pass a repository secret here — never hardcode it.

## How It Works

1. Reads `.gitattributes` line by line and collects every pattern marked with `export-ignore`.
2. Prepends the fixed flags `-avzr --delete --delete-excluded` and appends `--exclude=node_modules` unconditionally.
3. Logs the final exclude list for easy inspection in the Actions output.
4. Runs `burnett01/rsync-deployments` with the dynamically built switches string.

This means your `.gitattributes` is the single source of truth for what is excluded from both `git archive` ZIPs and rsync deployments.

## Usage

The action is designed to run inside an existing job that already has the repository checked out.

```yaml
- uses: Studio-Lemon/workflows/.github/actions/rsync-to-satispress@main
  with:
    type: theme
    name: wp-lemon
    remote_host: packagist.studiolemon.nl
    remote_user: packagist
    deploy_key: ${{ secrets.DEPLOY_KEY }}
```

## Example .gitattributes

```
.* export-ignore
yarn.lock export-ignore
composer.lock export-ignore
node_modules export-ignore
docs export-ignore
CHANGELOG.md export-ignore
tests export-ignore
```

Any pattern you add here is automatically picked up by both `git archive` (ZIP releases) and this rsync action.
