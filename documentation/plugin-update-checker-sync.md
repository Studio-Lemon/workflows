# Plugin Update Checker Sync Workflow

The reusable `plugin-update-checker-sync` workflow keeps a vendored copy of [YahnisElsts/plugin-update-checker](https://github.com/YahnisElsts/plugin-update-checker) (PUC) current. Run it weekly from the calling repository and it opens a pull request whenever upstream publishes a newer release.

## What It Does

1. **Finds the library.** Locates the folder containing `plugin-update-checker.php` (the file with the `Plugin Update Checker Library X.Y` header) and reads the installed version from it.
2. **Checks upstream.** Looks up the latest release of `YahnisElsts/plugin-update-checker`. Nothing happens when you are up to date.
3. **Skips open updates.** If a pull request for that version is still open, the run ends. A closed pull request or deleted branch does not block it, so the next run opens a new pull request for that version (the branch is force-pushed).
4. **Renews the folder completely.** Deletes the old folder and replaces it with the upstream release tarball. The tarball honours upstream's `export-ignore`, so `build/` and `examples/` stay out. Removed upstream files disappear from your repository too.
5. **Migrates the namespace.** Reads the new namespace from the release (for example `YahnisElsts\PluginUpdateChecker\v6`) and rewrites every tracked PHP file outside the library folder that references an older one: `use` statements, fully-qualified calls, and double-escaped strings. References to `load-vXpY.php` are updated to the new loader file.
6. **Keeps `vendor/` committed.** The library ships its own `vendor/` folder, which must be in the repository. If a `.gitignore` rule ignores it, the workflow adds an exception (`!/<puc_path>/vendor/`) and force-adds the whole library folder, so the folder is part of the pull request either way.
7. **Lints.** Runs `php -l` on all changed PHP files.
8. **Opens the pull request** on `chore/plugin-update-checker-<version>` with:
   - a major upgrade warning when the major version changes
   - the list of files whose namespace was migrated
   - a caution list of files that still use the legacy `Puc_v*_Factory` API (not migrated automatically)
   - every `PucFactory` usage in the repository
   - the upstream release notes of every version between yours and the new one
9. **Cleans up.** Older, still open update pull requests from this workflow are closed as superseded.

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `puc_path` | `string` | auto-detect | Folder containing `plugin-update-checker.php`. Required only when the repository has several copies. |
| `target_version` | `string` | latest release | Install a specific upstream tag such as `v5.7`. Useful through `workflow_dispatch`. |
| `base_branch` | `string` | default branch | Branch the pull request targets. |
| `labels` | `string` | `dependencies` | Comma-separated labels. Missing labels are created. |
| `reviewers` | `string` | none | Comma-separated users or `org/team` slugs. |
| `draft` | `boolean` | `false` | Open the pull request as a draft. |
| `php_version` | `string` | `8.4` | PHP version used for linting. |

## Secrets

### `pr_token` (optional)

A PAT with `contents: write` and `pull-requests: write`. Pull requests opened with the default `GITHUB_TOKEN` do not trigger other workflows, so your CI will not run on them. Pass a PAT (for example the existing `RELEASE_PLEASE_TOKEN`) to get CI checks on the update pull request.

## Repository Setting

Enable **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests** in the calling repository (or organization), otherwise `gh pr create` fails with the default token.

## How to Use

`schedule` cannot be declared in a reusable workflow, so the caller owns the cron:

```yaml
name: Plugin Update Checker

on:
  schedule:
    - cron: "0 6 * * 1" # Mondays at 06:00 UTC
  workflow_dispatch:
    inputs:
      target_version:
        description: "Specific tag to install (empty = latest)"
        required: false
        default: ""

permissions:
  contents: write
  pull-requests: write

jobs:
  puc:
    uses: Studio-Lemon/workflows/.github/workflows/plugin-update-checker-sync.yml@main
    with:
      target_version: ${{ inputs.target_version }}
      reviewers: "Levdbas"
    secrets:
      pr_token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
```

## Limitations

- Only tracked `*.php` files are migrated. Namespaces mentioned in docs or non-PHP files are not touched.
- The legacy `Puc_v4_Factory` API is reported but not rewritten, because migrating it needs a `use` statement and a code review.
- Libraries installed through Composer (`yahnis-elsts/plugin-update-checker`) are not detected. Use Dependabot or Renovate for those.
- Always read the release notes in the pull request before merging a major upgrade, and test the update flow on staging.

## Underlying Action

The logic lives in the composite action `.github/actions/update-plugin-update-checker` (`puc-sync.sh`). It can be used on its own in a job that already has the repository checked out. It outputs `updated`, `path`, `current`, `latest`, `namespace_changed`, `vendor_exception_added` and `body_file`, and leaves the changes uncommitted in the working tree.
