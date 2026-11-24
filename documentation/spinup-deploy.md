This reusable `spinup-initial-deploy` workflow can be called from a central `.github` repository or from other repositories to build and deploy WordPress themes to SpinupWP servers.

## Features

- **Auto-detects theme name** from `web/app/themes/` directory (or accepts manual override)
- **Configurable PHP and Node.js versions**
- **Optional SATISPRESS_TOKEN** from the calling repository or organization
- **Full build pipeline** with Composer dependencies and Yarn asset compilation
- **Rsync deployment** to remote server
- **Staging and production targets** using GitHub Environment secrets (staging by default)
- **Cache clearing** via SpinupWP CLI

## How to call from another repository (centralized `.github` repo)

Add this to the calling repository's `.github/workflows` directory (example: `.github/workflows/deploy-staging.yml`):

### Simple Initial Deploy
```yaml
name: Initial Deploy to Staging

on:
    workflow_dispatch:

jobs:
    deploy:
        uses: Studio-Lemon/workflows/.github/workflows/spinup-deploy.yml@main
        secrets: inherit
        with:
            initial_deploy: true
```

### Simple Regular Deploy
```yaml
name: Deploy to Staging
on:
    push:
        branches: [staging]
jobs:
    deploy:
        uses: Studio-Lemon/workflows/.github/workflows/spinup-deploy.yml@main
        secrets: inherit
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
        uses: Studio-Lemon/workflows/.github/workflows/spinup-deploy.yml@main
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

### Deploy to production

For a fixed production target, select the `production` GitHub Environment.
This is an alternative to the single dropdown workflow below, not an additional
workflow you need to maintain.

```yaml
name: Deploy to Production

on:
    workflow_dispatch:

jobs:
    deploy:
        uses: Studio-Lemon/workflows/.github/workflows/spinup-deploy.yml@main
        with:
            environment: production
        secrets: inherit
```

### Choose the target for a manual deployment

Use one calling workflow with a dropdown. The reusable workflow binds each
server-facing job to the selected GitHub Environment and reads its secrets:

```yaml
name: Deploy

on:
    workflow_dispatch:
        inputs:
            environment:
                description: Deployment target
                required: true
                type: choice
                default: staging
                options:
                    - staging
                    - production

jobs:
    deploy:
        uses: Studio-Lemon/workflows/.github/workflows/spinup-deploy.yml@main
        with:
            environment: ${{ inputs.environment }}
        secrets: inherit
```

No conditional secret expressions or target-prefixed secret names are needed.
Configure `SSH_USER` and `SSH_HOST` in both environments, as described below.
The `environment` binding belongs inside the reusable workflow; GitHub does
not allow it on the caller's `uses` job.

## How to call locally (same repo)

You can also call the workflow locally (from the same repository) by using a `uses` reference to the local path:

```yaml
jobs:
    deploy-local:
        uses: ./.github/workflows/spinup-deploy.yml
        with:
            theme: 'my-theme'
        secrets: inherit
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

### 1. Create environments in the calling repository

Under **Settings > Environments**, create `staging` and `production`. Use the
same secret names in each environment:

| Environment | Secret | Value |
|-------------|--------|-------|
| `staging` | `SSH_USER` | Staging site's SSH username |
| `staging` | `SSH_HOST` | Staging server hostname |
| `production` | `SSH_USER` | Production site's SSH username |
| `production` | `SSH_HOST` | Production server hostname |

### 2. Configure shared secrets

Under **Settings > Secrets and variables > Actions**, add:

- `SSH_KEY`: Shared SSH private key authorized for both targets
- `SATISPRESS_TOKEN`: Optional Satispress token for the Composer build

If SSH keys differ, put `SSH_KEY` in each environment instead. Environment
secrets take precedence over repository or organization secrets with the same
name. Keep `SATISPRESS_TOKEN` at repository or organization scope because build
jobs do not bind to a deployment environment. Secrets stored only in the
`Studio-Lemon/workflows` repository are not available to callers.

Pass `secrets: inherit` from the caller, as shown in the dropdown example.
Explicit same-name secret mappings, as in the advanced example, also work.
Each server-facing job checks for missing credentials and an invalid SSH key
before connecting.

### Compatibility and environment protections

Existing callers still default to staging. Repository-level SSH secrets remain
usable as fallbacks, but for a two-target setup remove repository/organization
`SSH_USER` and `SSH_HOST` fallbacks after populating both environments. Otherwise
a missing environment secret can resolve to a shared value instead of failing.
The workflow checks that credentials exist; it cannot verify that a host
actually belongs to the selected environment.

Create both environments explicitly before deployment. GitHub can create a
referenced environment automatically, without secrets or protection rules.
Required reviewers and branch restrictions are optional settings on each
environment. They apply to every environment-bound job, so the separate PHP,
theme, cache and initial environment-file jobs can each require approval.
Build jobs remain environment-independent.

Both targets must use the existing remote layout: `files` for PHP files and
`files/web/app/themes/` for themes. No server configuration is changed.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `environment` | GitHub Environment selecting deployment secrets: `staging` or `production` | No | `staging` |
| `theme` | Theme name (e.g. 'lemon-theme') | No | Auto-detected from `web/app/themes/` |
| `php_version` | PHP version to use | No | `'8.3'` |
| `node_version` | Node.js version to use | No | `'lts/*'` |

## Secrets

| Secret | Description | Required |
|--------|-------------|----------|
| `SSH_KEY` | SSH private key from selected environment or shared repository/organization secrets | Yes |
| `SSH_USER` | SSH username from selected environment | Yes |
| `SSH_HOST` | SSH hostname from selected environment | Yes |
| `SATISPRESS_TOKEN` | Repository/organization Satispress authentication token | No |

Use `secrets: inherit` or explicitly pass the names in the caller. Required
secret declarations check the caller's secret contract; runtime validation
also checks that the selected values are nonempty.

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

- Unsupported or empty environment values fail before SSH-key validation or any build/deployment work.
- On an initial deployment, the caller's `.env.example` is copied unchanged to `files/.env`. Selecting production does not generate production settings; prepare the file for the intended target before using `initial_deploy: true`.
- Production approval gates and branch restrictions are configured on the calling repository's GitHub Environment, not added by this workflow.
- Use `secrets: inherit` when calling from the same organization
- The workflow expects a `config.production.json` file that gets copied to `config.json` during build
- Theme auto-detection finds the first directory in `web/app/themes/`
- If no SATISPRESS_TOKEN is provided, authentication is skipped with a warning
- The workflow runs `wp spinupwp cache purge-site` to clear caches after deployment

This README is intentionally concise — edit as needed for your org's conventions.