# Theme Release Workflow

This reusable `theme-release` workflow can be called from a central `.github` repository or from other repositories to build and publish a WordPress theme ZIP.

## Overview

The workflow automates the process of creating a release-ready ZIP archive for WordPress themes. It packages your theme files, optionally builds blocks, and creates a GitHub release with the ZIP file attached.

## Features

- ✅ Creates clean ZIP archives with proper directory structure
- ✅ Includes `dist` folder automatically if present
- ✅ Includes `blocks` folder automatically if present
- ✅ Optional block building with yarn
- ✅ Automatically creates GitHub releases on tag push
- ✅ No manual unzip/rezip steps - uses efficient `git archive` with `--add-file` approach

## Inputs

### `theme_name` (required)
- **Type:** `string`
- **Description:** Logical theme name (e.g., `lemon-theme`). The workflow will append `.zip` to create the archive filename.
- **Default:** `'theme'`

### `build_blocks` (optional)
- **Type:** `boolean`
- **Description:** Whether to build blocks before creating the ZIP. When enabled, runs `yarn install` and `yarn run blocks:build`.
- **Default:** `false`

## How to Use

### Calling from Another Repository (Centralized Approach)

Add this to your theme repository's `.github/workflows` directory (example: `.github/workflows/release.yml`):

```yaml
name: Create Release zip

on:
  release:
    types: [published]
  workflow_dispatch:

jobs:
  release:
    uses: Studio-Lemon/workflows/.github/workflows/theme-release.yml@main
    with:
      theme_name: 'lemon-theme'
      build_blocks: true
    secrets: inherit
```

### Calling Locally (Same Repository)

You can also call the workflow locally from the same repository:

```yaml
jobs:
  release:
    uses: ./.github/workflows/theme-release.yml
    with:
      theme_name: 'my-theme'
      build_blocks: false
```

## Triggers

The workflow is designed to be called via `workflow_call`, meaning it's triggered by other workflows. Common triggers in the calling workflow include:

- **Tag pushes:** Create releases when version tags are pushed
  ```yaml
  on:
    push:
      tags:
        - 'v*'
  ```
  
- **Manual dispatch:** Manually trigger releases from GitHub UI
  ```yaml
  on:
    workflow_dispatch:
  ```

## What Gets Included in the ZIP

1. **Git-tracked files** - All files committed to your repository (via `git archive`)
2. **`dist` folder** - Automatically included if present (compiled assets)
3. **`blocks` folder** - Automatically included if present (built blocks)

### Excluded Files

Files excluded by `.gitattributes` with `export-ignore` will not be included in the ZIP.

## Archive Structure

The created ZIP file will have this structure:

```
theme-name.zip
└── theme-name/
    ├── style.css
    ├── functions.php
    ├── dist/
    │   └── (compiled assets)
    ├── blocks/
    │   └── (built blocks)
    └── (other theme files)
```

## GitHub Release

When triggered by a tag push (refs starting with `refs/tags/`), the workflow will:

1. Create a new GitHub release for that tag
2. Upload the ZIP file as a release asset
3. Make the release publicly available

## Requirements

- Repository must have appropriate permissions for GitHub releases
- If using `build_blocks: true`, repository must have:
  - `package.json` with blocks build script
  - Block building configured in your theme

## Notes

- Use `secrets: inherit` to forward the caller's secrets to the workflow (GitHub Actions will only allow this when calling a workflow in the same organization or with proper permissions)
- The workflow uses an efficient approach that avoids unnecessary unzip/rezip operations
- Build artifacts (`dist`, `blocks`) are added directly to the archive without extraction
- The ZIP file is created in the repository root and named `{theme_name}.zip`

## Example Repositories

Check out these repositories using this workflow:
- (Add your theme repositories here as examples)

## Troubleshooting

### ZIP doesn't include dist or blocks folders
- Ensure these folders exist after the build step
- Check that the folders aren't empty
- Verify the folders are created in the correct location (repository root)

### Block build fails
- Verify `yarn run blocks:build` works locally
- Check that `package.json` includes the blocks build script
- Ensure all dependencies are listed in `package.json`

### No GitHub release is created
- Verify the workflow is triggered by a tag push (`git push --tags`)
- Check repository permissions allow creating releases
- Ensure `secrets: inherit` is set in the calling workflow
