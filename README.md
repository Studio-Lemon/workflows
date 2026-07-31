# Studio Lemon Reusable Workflows

Welcome to Studio Lemon's collection of reusable GitHub Actions workflows. This repository contains battle-tested, standardized workflows that help our development teams ship faster and more reliably.

## 🎯 Philosophy

**Don't reinvent the wheel every time.**

We believe in creating once, using everywhere. Instead of copy-pasting workflow configurations across multiple repositories and maintaining them separately, we centralize our common deployment and release patterns here. This approach ensures:

- ✅ **Consistency** across all our projects
- ✅ **Maintainability** - fix once, benefit everywhere
- ✅ **Speed** - new projects get deployment ready in minutes
- ✅ **Reliability** - workflows are battle-tested across multiple projects
- ✅ **Knowledge sharing** - best practices are encoded and documented

## 🚀 Available Workflows

### [Plugin Release](./documentation/plugin-release.md)

**File:** `.github/workflows/plugin-release.yml`

Automates the creation of plugin ZIP archives and GitHub releases.

- Builds plugin with npm/composer dependencies
- Creates clean ZIP archives with dist and blocks folders
- Publishes GitHub releases with assets
- Triggered on Git tags

**Quick Start:**

```yaml
uses: Studio-Lemon/workflows/.github/workflows/plugin-release.yml@main
with:
  plugin_name: "my-plugin"
secrets: inherit
```

### [Theme Release](./documentation/theme-release.md)

**File:** `.github/workflows/theme-release.yml`

Automates the creation of theme ZIP archives and GitHub releases.

- Builds theme blocks with yarn (optional)
- Creates clean ZIP archives with dist and blocks folders
- Publishes GitHub releases with assets
- Triggered on Git tags

**Quick Start:**

```yaml
uses: Studio-Lemon/workflows/.github/workflows/theme-release.yml@main
with:
  theme_name: "my-theme"
  build_blocks: true
secrets: inherit
```

### [SpinupWP Deploy](./documentation/spinup-deploy.md)

**File:** `.github/workflows/spinup-deploy.yml`

Complete WordPress theme deployment pipeline for SpinupWP servers.

- Auto-detects theme from repository structure
- Builds Composer dependencies with Satispress support
- Compiles frontend assets with Yarn
- Deploys via rsync to remote servers
- Clears SpinupWP caches

**Quick Start:**

```yaml
uses: Studio-Lemon/workflows/.github/workflows/spinup-deploy.yml@main
secrets: inherit
```

## 🔧 Available Actions

### [rsync to Satispress](./documentation/rsync-to-satispress.md)

**File:** `.github/actions/rsync-to-satispress/action.yml`

Composite action that deploys a theme or plugin to a satispress server via rsync. Reads `.gitattributes` `export-ignore` entries to build the exclude list automatically — no need to maintain excludes in two places.

Built into the `plugin-release` and `theme-release` workflows via the `deploy_to_satispress` input.

**Quick Start:**

```yaml
- uses: Studio-Lemon/workflows/.github/actions/rsync-to-satispress@main
  with:
    type: theme
    name: wp-lemon
    remote_host: packagist.studiolemon.nl
    remote_user: packagist
    deploy_key: ${{ secrets.DEPLOY_KEY }}
```

## 📖 How to Use

### 1. Call from Another Repository

Create a workflow file in your repository's `.github/workflows/` directory:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    uses: Studio-Lemon/workflows/.github/workflows/WORKFLOW_NAME.yml@main
    with:
      # workflow-specific inputs
    secrets:
      # required secrets
```

## 🛠 Development

### Adding New Workflows or Actions

1. Create the workflow file in `.github/workflows/` or the action in `.github/actions/<name>/action.yml`
2. Add `workflow_call` trigger (workflows) or `runs: using: composite` (actions) with appropriate inputs and secrets
3. Document it in the `documentation/` folder
4. Update this README

### Workflow Design Principles

- **Make inputs optional where possible** - provide sensible defaults
- **Auto-detect configuration** from repository structure when feasible
- **Centralize common secrets** in this repository to reduce setup burden
- **Fail fast** with clear error messages
- **Document everything** - inputs, outputs, secrets, and usage examples

## 📚 Resources

- [GitHub Actions Reusable Workflows Documentation](https://docs.github.com/en/actions/using-workflows/reusing-workflows)
- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Studio Lemon Development Guidelines](https://github.com/Studio-Lemon)

---

**Studio Lemon** • Building better workflows, one commit at a time 🍋
