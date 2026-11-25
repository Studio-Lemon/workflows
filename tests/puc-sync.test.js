const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const script = path.resolve(__dirname, '../.github/actions/update-plugin-update-checker/puc-sync.sh');
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

function write(file, content) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, content);
}

function library(root, version, segment) {
	const minor = version.replace('.', 'p');
	write(path.join(root, 'plugin-update-checker.php'), `<?php\n/**\n * Plugin Update Checker Library ${version}\n */\n`);
	write(path.join(root, `load-v${minor}.php`), '<?php\n');
	write(path.join(root, 'vendor/Parsedown.php'), '<?php\n');
	write(path.join(root, `Puc/${segment}/PucFactory.php`), `<?php\nnamespace YahnisElsts\\PluginUpdateChecker\\${segment};\n`);
	write(path.join(root, `Puc/v${minor}/PucFactory.php`), `<?php\nnamespace YahnisElsts\\PluginUpdateChecker\\v${minor};\n`);
}

function fixture(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'puc-sync-test-'));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));

	const upstream = path.join(root, 'upstream/puc-6.0');
	library(upstream, '6.0', 'v6');
	const tarball = path.join(root, 'puc.tar.gz');
	execFileSync('tar', ['-czf', tarball, '-C', path.join(root, 'upstream'), 'puc-6.0']);

	const repo = path.join(root, 'repo');
	library(path.join(repo, 'inc/puc'), '5.6', 'v5');
	write(path.join(repo, 'plugin.php'), [
		'<?php',
		"require __DIR__ . '/inc/puc/load-v5p6.php';",
		'use YahnisElsts\\PluginUpdateChecker\\v5\\PucFactory;',
		"$a = \\YahnisElsts\\PluginUpdateChecker\\v5p6\\PucFactory::buildUpdateChecker();",
		"$b = 'YahnisElsts\\\\PluginUpdateChecker\\\\v5\\\\PucFactory';",
		'',
	].join('\n'));
	write(path.join(repo, 'legacy.php'), '<?php\nPuc_v4_Factory::buildUpdateChecker();\n');
	execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repo, env });
	execFileSync('git', ['add', '-A'], { cwd: repo, env });
	return { repo, tarball, root };
}

function run(f, extra = {}) {
	const output = path.join(f.root, 'output');
	const result = spawnSync('bash', [script], {
		cwd: f.repo,
		encoding: 'utf8',
		env: {
			...env,
			PUC_TARBALL: f.tarball,
			PUC_LATEST_TAG: 'v6.0',
			BODY_FILE: path.join(f.root, 'body.md'),
			GITHUB_OUTPUT: output,
			// Release notes lookup is best effort and must not fail the run offline.
			PATH: `${path.join(f.root, 'bin')}:${process.env.PATH}`,
			...extra,
		},
	});
	const outputs = fs.existsSync(output)
		? Object.fromEntries(fs.readFileSync(output, 'utf8').trim().split('\n').map((l) => l.split(/=(.*)/s).slice(0, 2)))
		: {};
	return { ...result, outputs };
}

function stubGh(f) {
	write(path.join(f.root, 'bin/gh'), '#!/usr/bin/env bash\nexit 1\n');
	fs.chmodSync(path.join(f.root, 'bin/gh'), 0o755);
}

test('replaces the folder and migrates namespace and loader references', (t) => {
	const f = fixture(t);
	stubGh(f);
	const result = run(f);
	assert.equal(result.status, 0, result.stderr);

	assert.equal(result.outputs.updated, 'true');
	assert.equal(result.outputs.current, '5.6');
	assert.equal(result.outputs.latest, '6.0');
	assert.equal(result.outputs.namespace_changed, 'true');

	assert.ok(fs.existsSync(path.join(f.repo, 'inc/puc/load-v6p0.php')));
	assert.ok(!fs.existsSync(path.join(f.repo, 'inc/puc/load-v5p6.php')), 'old files must be removed');

	const plugin = fs.readFileSync(path.join(f.repo, 'plugin.php'), 'utf8');
	assert.match(plugin, /load-v6p0\.php/);
	assert.match(plugin, /use YahnisElsts\\PluginUpdateChecker\\v6\\PucFactory;/);
	assert.match(plugin, /\\YahnisElsts\\PluginUpdateChecker\\v6\\PucFactory::build/);
	assert.match(plugin, /'YahnisElsts\\\\PluginUpdateChecker\\\\v6\\\\PucFactory'/);
	assert.doesNotMatch(plugin, /v5/);

	const body = fs.readFileSync(path.join(f.root, 'body.md'), 'utf8');
	assert.match(body, /major\*\* upgrade/);
	assert.match(body, /`plugin\.php`/);
	assert.match(body, /legacy `Puc_v\*_Factory` API[\s\S]*`legacy\.php`/);
});

test('does nothing when the library is already up to date', (t) => {
	const f = fixture(t);
	stubGh(f);
	const result = run(f, { PUC_LATEST_TAG: 'v5.6' });
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.outputs.updated, 'false');
	assert.ok(fs.existsSync(path.join(f.repo, 'inc/puc/load-v5p6.php')));
});

test('fails clearly when the library cannot be found', (t) => {
	const f = fixture(t);
	fs.rmSync(path.join(f.repo, 'inc'), { recursive: true });
	const result = run(f);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /Could not find plugin-update-checker\.php/);
});

test('adds a .gitignore exception so the library vendor folder is committed', (t) => {
	const f = fixture(t);
	stubGh(f);
	write(path.join(f.repo, '.gitignore'), 'vendor/');
	execFileSync('git', ['add', '-f', '.'], { cwd: f.repo, env });
	execFileSync('git', ['rm', '-r', '-q', '--cached', 'inc/puc/vendor'], { cwd: f.repo, env });

	const result = run(f);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.outputs.vendor_exception_added, 'true');

	execFileSync('git', ['add', '-A'], { cwd: f.repo, env });
	const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: f.repo, env, encoding: 'utf8' });
	assert.match(staged, /inc\/puc\/vendor\/Parsedown\.php/);
	assert.match(fs.readFileSync(path.join(f.repo, '.gitignore'), 'utf8'), /^!\/inc\/puc\/vendor\/$/m);
});
