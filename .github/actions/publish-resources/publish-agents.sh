#!/usr/bin/env bash
set -euo pipefail

source_root="${1:?Usage: publish-agents.sh SOURCE_ROOT TARGET_DIR}"
target_dir="${2:?Usage: publish-agents.sh SOURCE_ROOT TARGET_DIR}"
source_dir="$source_root/resources/agents"
manifest="$target_dir/manifest.json"

if [ ! -d "$source_dir" ]; then
    echo "::error::No agent instructions found at $source_dir"
    exit 1
fi

if ! version=$(jq -er '.version | select(type == "string" and length > 0)' "$source_root/package.json"); then
    echo "::error::The source package.json must contain a non-empty version string."
    exit 1
fi
source_commit=$(git -C "$source_root" rev-parse HEAD)

if [ -f "$manifest" ]; then
    if ! previous_commit=$(jq -er '.source_commit | select(type == "string") | select(test("^[0-9a-f]{40}$|^[0-9a-f]{64}$"))' "$manifest"); then
        echo "::error::The published manifest must contain a valid source commit."
        exit 1
    fi

    if ! git -C "$source_root" cat-file -e "$previous_commit^{commit}" 2>/dev/null; then
        if ! git -C "$source_root" fetch origin "$previous_commit"; then
            echo "::error::Could not fetch the previously published source commit."
            exit 1
        fi
    fi

    if ! git -C "$source_root" merge-base --is-ancestor "$previous_commit" "$source_commit"; then
        echo "::error::Refusing to replace published instructions with an older or diverged source commit."
        exit 1
    fi
fi

file_count=$(find "$source_dir" -type f | wc -l | tr -d ' ')
if [ "$file_count" -eq 0 ]; then
    echo "::error::The agent instruction set is empty."
    exit 1
fi

mkdir -p "$target_dir"

# Pin archive metadata so unchanged instructions have an identical checksum.
tar --sort=name \
    --mtime='UTC 1970-01-01' \
    --owner=0 --group=0 --numeric-owner \
    --format=gnu \
    -cf - -C "$source_dir" . | gzip -n > "$target_dir/agents.tar.gz"

checksum=$(sha256sum "$target_dir/agents.tar.gz" | cut -d' ' -f1)
released_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# false is the initial release within a version; later changes count up from 1.
revision=false

if [ -f "$manifest" ]; then
    revision=$(jq -c --arg sha "$checksum" --arg version "$version" '
        (.revision // false) as $current
        | if .version != $version then false
          elif .sha256 == $sha then $current
          else (if $current == false then 0 else $current end) + 1
          end' "$manifest")

    previous=$(jq -r --arg sha "$checksum" --arg version "$version" \
        'select(.sha256 == $sha and .version == $version) | "\(.released_at)\t\(.source_commit)"' \
        "$manifest")

    if [ -n "$previous" ]; then
        released_at=$(printf '%s' "$previous" | cut -f1)
        source_commit=$(printf '%s' "$previous" | cut -f2)
    fi
fi

jq -n \
    --arg version "$version" \
    --arg released_at "$released_at" \
    --arg sha256 "$checksum" \
    --arg source_commit "$source_commit" \
    --argjson file_count "$file_count" \
    --argjson revision "$revision" \
    '{
        version: $version,
        agents_revision: $sha256,
        revision: $revision,
        released_at: $released_at,
        sha256: $sha256,
        file_count: $file_count,
        source_commit: $source_commit,
        tarball: "agents/agents.tar.gz"
    }' > "$manifest"

echo "Packaged $file_count agent file(s) for wp-lemon $version ($checksum)"
