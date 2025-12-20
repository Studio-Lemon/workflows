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
  plugin_name: 'my-plugin'
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
  theme_name: 'my-theme'
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

### Adding New Workflows

1. Create the workflow file in `.github/workflows/`
2. Add `workflow_call` trigger with appropriate inputs and secrets
3. Document the workflow in the `documentation/` folder
4. Update this README with the new workflow
5. Test the workflow in a sample repository

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