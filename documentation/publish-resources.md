# Publish WP Lemon resources

Composite action that publishes agent instructions and optionally generated docs
and the changelog to a checked-out documentation repository.

## Caller setup

The caller owns the runner, permissions, checkouts and concurrency. Use an Ubuntu
runner with Bash, Git, jq, GNU tar and gzip. Check out the WP Lemon source at
`./wp_lemon` with `fetch-depth: 0`, and the docs repository at `./docs` with a token
that can push to it.

Both full-release and agents-only callers must use the same concurrency group
with cancellation disabled. GitHub keeps at most one pending run per group; newer
pending runs can replace older pending runs.

```yaml
permissions:
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    concurrency:
      group: wp-lemon-resources-publication
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v6
        with:
          ref: ${{ github.event.release.tag_name || github.sha }}
          fetch-depth: 0
          path: ./wp_lemon
      - uses: actions/checkout@v6
        with:
          repository: Studio-Lemon/wp-lemon-docs
          token: ${{ secrets.DOCS_TOKEN }}
          path: ./docs
      - uses: Studio-Lemon/workflows/.github/actions/publish-resources@main
        with:
          publish_docs: 'true'
```

For instruction-only publishing, pass `publish_docs: 'false'`. Both values are
strings; any other value fails explicitly. The action itself takes no secrets:
authentication comes from the caller's docs checkout.

## Publication behavior

- Agents are read from `wp_lemon/resources/agents/`. Missing or empty instructions
  fail the run.
- `docs/agents/agents.tar.gz` is deterministic. The manifest retains the theme
  version from the source's `package.json`; `agents_revision` and `sha256` identify
  the instruction payload independently of that version.
- `revision` is `false` for the first publication of a theme version. Each
  instruction change within the same version increments it (`1`, `2`, ...), and a
  new theme version resets it to `false`.
- Unchanged instructions with the same version preserve their timestamp and
  source commit. Repeated unchanged publications do not create commits.
- An older or diverged source commit is rejected before replacing published
  instructions. To revert intentionally, commit the revert on the stable branch.
- With `publish_docs: 'true'`, generated docs and the changelog are copied too.
  With `'false'`, only `agents/` is staged and published.

The action and `publish-agents.sh` are packaged together. Keep both available in
source archives; an `export-ignore` rule excluding them breaks remote action
downloads. No publisher checkout or WP Lemon build script is required.

## Tests

```bash
node --test tests/publish-agents.test.js
```

The publishing test workflow runs on action, test and archive-setting changes.
