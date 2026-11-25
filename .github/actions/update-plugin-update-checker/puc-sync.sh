#!/usr/bin/env bash
# Replaces a vendored YahnisElsts/plugin-update-checker folder with the latest
# upstream release and migrates the namespace usage in the rest of the codebase.
#
# Inputs (environment):
#   PUC_PATH        Folder containing plugin-update-checker.php. Auto-detected when empty.
#   UPSTREAM        Upstream repository. Default: YahnisElsts/plugin-update-checker
#   TARGET_TAG      Release tag to install. Default: latest release.
#   PUC_TARBALL     Local tarball to use instead of downloading (tests).
#   PUC_LATEST_TAG  Skip the API lookup and use this tag as latest release (tests).
#   BODY_FILE       Where to write the pull request body. Default: $RUNNER_TEMP/puc-pr-body.md
#   GITHUB_OUTPUT   Receives: updated, path, current, latest, tag, namespace_changed,
#                   vendor_exception_added, body_file
set -euo pipefail

UPSTREAM="${UPSTREAM:-YahnisElsts/plugin-update-checker}"
BODY_FILE="${BODY_FILE:-${RUNNER_TEMP:-/tmp}/puc-pr-body.md}"
OUTPUT="${GITHUB_OUTPUT:-/dev/null}"
HEADER_PATTERN='Plugin Update Checker Library [0-9]'

out() { echo "$1=$2" >> "$OUTPUT"; }
fail() { echo "::error::$*" >&2; exit 1; }

header_version() {
	sed -nE 's/.*Plugin Update Checker Library ([0-9]+(\.[0-9]+)*).*/\1/p' "$1" | head -n1
}

# True when $1 is a strictly lower version than $2.
version_lt() {
	[ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | head -n1)" = "$1" ]
}

# --- 1. Locate the vendored library ------------------------------------------
puc_path="${PUC_PATH:-}"
puc_path="${puc_path#./}"
puc_path="${puc_path%/}"

if [ -z "$puc_path" ]; then
	mapfile -t candidates < <(
		find . -name plugin-update-checker.php \
			-not -path '*/node_modules/*' -not -path './vendor/*' -not -path './.git/*' \
			-print0 | xargs -0 -r grep -l "$HEADER_PATTERN" | xargs -r -n1 dirname | sed 's#^\./##' | sort
	)
	[ "${#candidates[@]}" -gt 0 ] || fail "Could not find plugin-update-checker.php. Set the puc_path input."
	[ "${#candidates[@]}" -eq 1 ] || fail "Found several copies (${candidates[*]}). Set the puc_path input."
	puc_path="${candidates[0]}"
fi

[ -f "$puc_path/plugin-update-checker.php" ] || fail "$puc_path/plugin-update-checker.php does not exist."

current="$(header_version "$puc_path/plugin-update-checker.php")"
[ -n "$current" ] || fail "Could not read the library version from $puc_path/plugin-update-checker.php."
echo "Current version in $puc_path: $current"

# --- 2. Find the latest upstream release -------------------------------------
if [ -n "${TARGET_TAG:-}" ]; then
	tag="$TARGET_TAG"
elif [ -n "${PUC_LATEST_TAG:-}" ]; then
	tag="$PUC_LATEST_TAG"
else
	tag="$(gh api "repos/$UPSTREAM/releases/latest" --jq .tag_name)"
fi
latest="${tag#v}"
echo "Latest version: $latest"

out path "$puc_path"
out current "$current"
out latest "$latest"
out tag "$tag"
out body_file "$BODY_FILE"

if [ -z "${TARGET_TAG:-}" ] && ! version_lt "$current" "$latest"; then
	echo "plugin-update-checker is up to date ($current)."
	out updated false
	out namespace_changed false
	exit 0
fi

# --- 3. Replace the folder with the upstream release -------------------------
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
tarball="${PUC_TARBALL:-$work/puc.tar.gz}"
# The GitHub tarball honours export-ignore, so build/ and examples/ stay out.
[ -n "${PUC_TARBALL:-}" ] || gh api "repos/$UPSTREAM/tarball/$tag" > "$tarball"
mkdir "$work/new"
tar -xzf "$tarball" -C "$work/new" --strip-components=1

[ -f "$work/new/plugin-update-checker.php" ] || fail "Downloaded release $tag has no plugin-update-checker.php."
fetched="$(header_version "$work/new/plugin-update-checker.php")"
[ "$fetched" = "$latest" ] || echo "::warning::Release $tag reports library version '$fetched' in its header."

rm -rf "$puc_path"
mkdir -p "$(dirname "$puc_path")"
mv "$work/new" "$puc_path"

# The library's vendor/ folder (Parsedown, readme parser) must be committed, but
# projects commonly ignore every vendor/ folder. Add a .gitignore exception for it.
vendor_ignored=false
vendor_probe="$puc_path/vendor/Parsedown.php"
if [ -e "$vendor_probe" ] && git check-ignore -q "$vendor_probe"; then
	vendor_ignored=true
	exception="!/$puc_path/vendor/"
	if ! grep -qxF "$exception" .gitignore 2>/dev/null; then
		{
			[ ! -s .gitignore ] || [ -z "$(tail -c1 .gitignore)" ] || echo
			echo "# plugin-update-checker ships its own vendor folder, which must be committed"
			echo "$exception"
			echo "$exception**"
		} >> .gitignore
	fi
	if git check-ignore -q "$vendor_probe"; then
		echo "::warning::$puc_path/vendor is still ignored by a more specific rule; it will be force-added."
	fi
fi
out vendor_exception_added "$vendor_ignored"

# --- 4. Work out the new namespace and migrate usages ------------------------
# The unversioned Puc/vN/PucFactory.php is the stable alias for a major version.
alias_factory="$(find "$puc_path/Puc" -maxdepth 2 -name PucFactory.php -path '*/v[0-9]/*' 2>/dev/null | sort | tail -n1 || true)"
[ -n "$alias_factory" ] || alias_factory="$(find "$puc_path/Puc" -maxdepth 2 -name PucFactory.php | sort -V | tail -n1)"
[ -n "$alias_factory" ] || fail "No PucFactory.php found in the new release."

new_namespace="$(sed -nE 's/^namespace +([^;]+);.*/\1/p' "$alias_factory" | head -n1)"
new_segment="${new_namespace##*\\}"
new_load_file="$(cd "$puc_path" && ls load-v*.php | sort -V | tail -n1)"
echo "New namespace: $new_namespace (loader: $new_load_file)"

php_files() {
	git ls-files -z -- '*.php' ":(exclude)$puc_path" | tr '\0' '\n'
}

rewritten=()
legacy=()
while IFS= read -r file; do
	[ -f "$file" ] || continue
	before="$(sha1sum < "$file")"
	NEW_SEGMENT="$new_segment" NEW_LOADER="$new_load_file" perl -0pi -e '
		s/(YahnisElsts(\\{1,2})PluginUpdateChecker\2)v\d+(?:p\d+)?\b/$1$ENV{NEW_SEGMENT}/g;
		s/\bload-v\d+p\d+\.php\b/$ENV{NEW_LOADER}/g;
	' "$file"
	[ "$before" = "$(sha1sum < "$file")" ] || rewritten+=("$file")
	if grep -qE '\bPuc_v[0-9]+(p[0-9]+)?_' "$file"; then legacy+=("$file"); fi
done < <(php_files)

namespace_changed=false
[ "${#rewritten[@]}" -eq 0 ] || namespace_changed=true
out namespace_changed "$namespace_changed"
out updated true

# --- 5. Build the pull request body ------------------------------------------
current_major="${current%%.*}"
latest_major="${latest%%.*}"

{
	echo "Updates the bundled [plugin-update-checker](https://github.com/$UPSTREAM) from \`$current\` to \`$latest\`."
	echo
	echo "- Folder: \`$puc_path/\` (replaced completely with release [\`$tag\`](https://github.com/$UPSTREAM/releases/tag/$tag))"
	echo "- Diff upstream: https://github.com/$UPSTREAM/compare/v$current...$tag"
	echo "- Namespace: \`$new_namespace\`"
	echo
	if [ "$current_major" != "$latest_major" ]; then
		echo "> [!WARNING]"
		echo "> This is a **major** upgrade ($current_major.x → $latest_major.x). Read the release notes below and test the update flow on a staging site before merging."
		echo
	fi

	echo "## Namespace migration"
	echo
	if [ "${#rewritten[@]}" -gt 0 ]; then
		echo "These files referenced an older namespace or loader file and were updated automatically:"
		echo
		printf -- '- `%s`\n' "${rewritten[@]}"
	else
		echo "No namespace or loader changes were needed outside \`$puc_path/\`."
	fi
	if [ "$vendor_ignored" = true ]; then
		echo
		echo "\`$puc_path/vendor/\` was ignored by \`.gitignore\`. An exception was added so the folder is committed."
	fi
	if [ "${#legacy[@]}" -gt 0 ]; then
		echo
		echo "> [!CAUTION]"
		echo "> These files still use the legacy \`Puc_v*_Factory\` API. It was not migrated automatically:"
		echo ">"
		printf '> - `%s`\n' "${legacy[@]}"
	fi

	echo
	echo "## PucFactory usage in this repository"
	echo
	usages="$(git grep -n -E 'PucFactory|Puc_v[0-9]+(p[0-9]+)?_Factory' -- '*.php' ":(exclude)$puc_path" || true)"
	if [ -n "$usages" ]; then
		echo '```'
		echo "$usages" | head -n 40
		echo '```'
	else
		echo "> [!NOTE]"
		echo "> No \`PucFactory\` usage found outside \`$puc_path/\`. Check where the library is loaded."
	fi

	echo
	echo "## Upstream release notes"
	tags="$(gh api "repos/$UPSTREAM/releases?per_page=100" --jq '.[] | select(.draft==false and .prerelease==false) | .tag_name' 2>/dev/null || true)"
	shown=0
	while IFS= read -r t; do
		[ -n "$t" ] || continue
		v="${t#v}"
		version_lt "$current" "$v" || continue
		version_lt "$latest" "$v" && continue
		body="$(gh api "repos/$UPSTREAM/releases/tags/$t" --jq '.body // ""' 2>/dev/null || true)"
		echo
		echo "<details><summary><b>$v</b></summary>"
		echo
		echo "${body:-_No release notes._}"
		echo
		echo "</details>"
		shown=$((shown + 1))
	done < <(echo "$tags" | sort -V)
	[ "$shown" -gt 0 ] || { echo; echo "_No release notes available._ See https://github.com/$UPSTREAM/releases"; }

	echo
	echo "---"
	echo "_Opened automatically by the Studio Lemon plugin-update-checker workflow._"
} > "$BODY_FILE"

echo "Prepared update $current -> $latest (namespace changed: $namespace_changed)."
