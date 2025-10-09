This reusable `spinup-initial-deploy` workflow can be called from a central `.github` repository or from other repositories to build and deploy WordPress themes to SpinupWP servers.

## Features

- **Auto-detects theme name** from `web/app/themes/` directory (or accepts manual override)
- **Configurable PHP and Node.js versions**
- **Centralized SATISPRESS_TOKEN** (optional - falls back to workflow repo token)
- **Full build pipeline** with Composer dependencies and Yarn asset compilation
- **Rsync deployment** to remote server
- **Cache clearing** via SpinupWP CLI

## How to call from another repository (centralized `.github` repo)

Add this to the calling repository's `.github/workflows` directory (example: `.github/workflows/deploy-staging.yml`):

### Simple usage (auto-detect theme)
```yaml
name: Deploy to Staging

on:
    push:
        branches: [staging]
    workflow_dispatch:

jobs:
    deploy:
        uses: Studio-Lemon/workflows/.github/workflows/spinup-initial-deploy.yml@main
        secrets:
            SSH_KEY: ${{ secrets.SSH_KEY }}
            SSH_USER: ${{ secrets.SSH_USER }}
            SSH_HOST: ${{ secrets.SSH_HOST }}
            # SATISPRESS_TOKEN is optional - will use workflow repo token if not provided
```

### Advanced usage (custom configuration)
```yaml
name: Deploy to Staging

on:
    push:
        branches: [staging]
    workflow_dispatch:

jobs:
    deploy:
        uses: Studio-Lemon/workflows/.github/workflows/spinup-initial-deploy.yml@main
        with:
            theme: 'my-custom-theme'  # Optional - will auto-detect if not provided
            php_version: '8.2'        # Optional - defaults to '8.3'
            node_version: '18'        # Optional - defaults to 'lts/*'
        secrets:
            SSH_KEY: ${{ secrets.SSH_KEY }}
            SSH_USER: ${{ secrets.SSH_USER }}
            SSH_HOST: ${{ secrets.SSH_HOST }}
            SATISPRESS_TOKEN: ${{ secrets.CUSTOM_SATISPRESS_TOKEN }}  # Optional override
```

## How to call locally (same repo)

You can also call the workflow locally (from the same repository) by using a `uses` reference to the local path:

```yaml
jobs:
    deploy-local:
        uses: ./.github/workflows/spinup-initial-deploy.yml
        with:
            theme: 'my-theme'
        secrets:
            SSH_KEY: ${{ secrets.SSH_KEY }}
            SSH_USER: ${{ secrets.SSH_USER }}
            SSH_HOST: ${{ secrets.SSH_HOST }}
            SATISPRESS_TOKEN: ${{ secrets.SATISPRESS_TOKEN }}
```

## Required Repository Structure

Your calling repository should have this structure:
```
├── web/
│   └── app/
│       └── themes/
│           └── your-theme-name/
│               ├── resources/
│               │   └── assets/
│               │       ├── config.json
│               │       └── config.production.json
│               ├── yarn.lock
│               └── package.json
├── composer.json
└── .github/
    └── workflows/
        └── deploy.yml
```

## Setup Instructions

### 1. Workflow Repository Setup (one-time)
In the `Studio-Lemon/workflows` repository, add these secrets:
- `WORKFLOW_SATISPRESS_TOKEN`: Your default Satispress token (used as fallback)

### 2. Calling Repository Setup
In each repository that uses this workflow, add these secrets:
- `SSH_KEY`: SSH private key for deployment server
- `SSH_USER`: SSH username for deployment server  
- `SSH_HOST`: SSH hostname for deployment server
- `SATISPRESS_TOKEN`: (Optional) Override token if different from workflow repo token

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `theme` | Theme name (e.g. 'lemon-theme') | No | Auto-detected from `web/app/themes/` |
| `php_version` | PHP version to use | No | `'8.3'` |
| `node_version` | Node.js version to use | No | `'lts/*'` |

## Secrets

| Secret | Description | Required |
|--------|-------------|----------|
| `SSH_KEY` | SSH private key for deployment | Yes |
| `SSH_USER` | SSH username for deployment | Yes |
| `SSH_HOST` | SSH hostname for deployment | Yes |
| `SATISPRESS_TOKEN` | Satispress authentication token | No* |

*Falls back to `WORKFLOW_SATISPRESS_TOKEN` from workflows repository if not provided

## What the workflow does

1. **Checkout** the calling repository
2. **Auto-detect theme** from `web/app/themes/` directory (unless specified)
3. **Setup PHP** with specified version
4. **Install Composer dependencies** with Satispress authentication
5. **Rsync Composer files** to server (excluding theme directory)
6. **Setup Node.js** and install Yarn dependencies  
7. **Build assets** (copies `config.production.json` to `config.json` and runs `yarn production`)
8. **Deploy theme** via rsync to server
9. **Clear cache** using SpinupWP CLI

## Notes

- Use `secrets: inherit` when calling from the same organization
- The workflow expects a `config.production.json` file that gets copied to `config.json` during build
- Theme auto-detection finds the first directory in `web/app/themes/`
- If no SATISPRESS_TOKEN is provided, authentication is skipped with a warning
- The workflow runs `wp spinupwp cache purge-site` to clear caches after deployment

This README is intentionally concise — edit as needed for your org's conventions.