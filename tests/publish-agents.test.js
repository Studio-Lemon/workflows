const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const repository = path.resolve(__dirname, '..');
const publisher = path.join(repository, '.github/actions/publish-resources/publish-agents.sh');
const gitEnv = {
	...process.env,
	GIT_CONFIG_GLOBAL: '/dev/null',
	GIT_CONFIG_NOSYSTEM: '1',
	GIT_AUTHOR_NAME: 'Publishing test',
	GIT_AUTHOR_EMAIL: 'test@example.invalid',
	GIT_COMMITTER_NAME: 'Publishing test',
	GIT_COMMITTER_EMAIL: 'test@example.invalid',
};

function git(cwd, ...args) {
	return execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
		cwd, env: gitEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
	}).trim();
}

function fixture(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-lemon-publish-test-'));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const source = path.join(root, 'source');
	const target = path.join(root, 'docs/agents');
	const agents = path.join(source, 'resources/agents');
	fs.mkdirSync(agents, { recursive: true });
	fs.writeFileSync(path.join(source, 'package.json'), '{"version":"5.66.2"}\n');
	fs.writeFileSync(path.join(agents, 'AGENTS.md'), 'Use the shipped WP Lemon API.\n');
	git(source, 'init', '--initial-branch=main');
	const commit = () => {
		git(source, 'add', '.');
		git(source, 'commit', '-m', 'Test instructions');
		return git(source, 'rev-parse', 'HEAD');
	};
	const initialCommit = commit();
	const run = () => spawnSync('bash', [publisher, source, target], { encoding: 'utf8' });
	const publish = () => {
		const result = run();
		assert.equal(result.status, 0, result.stdout + result.stderr);
		return JSON.parse(fs.readFileSync(path.join(target, 'manifest.json'), 'utf8'));
	};
	const snapshot = () => ({
		manifest: fs.readFileSync(path.join(target, 'manifest.json'), 'utf8'),
		archive: fs.readFileSync(path.join(target, 'agents.tar.gz')),
	});
	return { root, source, target, agents, commit, initialCommit, run, publish, snapshot };
}

test('source archives include the self-contained action and publishing script', (t) => {
	const f = fixture(t);
	const archiveRepo = path.join(f.root, 'archive');
	const actionPath = '.github/actions/publish-resources';
	fs.mkdirSync(archiveRepo);
	fs.cpSync(path.join(repository, actionPath), path.join(archiveRepo, actionPath), { recursive: true });
	const attributes = path.join(repository, '.gitattributes');
	if (fs.existsSync(attributes)) {
		fs.copyFileSync(attributes, path.join(archiveRepo, '.gitattributes'));
	}
	git(archiveRepo, 'init', '--initial-branch=main');
	git(archiveRepo, 'add', '.');
	git(archiveRepo, 'commit', '-m', 'Archive fixture');
	const archive = execFileSync('git', ['archive', 'HEAD'], { cwd: archiveRepo });
	const entries = execFileSync('tar', ['-tf', '-'], { input: archive, encoding: 'utf8' }).split('\n');
	assert.ok(entries.includes(`${actionPath}/action.yml`));
	assert.ok(entries.includes(`${actionPath}/publish-agents.sh`));
});

test('first publication retains the CLI contract and checked-out commit', (t) => {
	const f = fixture(t);
	const manifest = f.publish();
	const checksum = crypto.createHash('sha256').update(f.snapshot().archive).digest('hex');
	assert.equal(manifest.version, '5.66.2');
	assert.equal(manifest.sha256, checksum);
	assert.equal(manifest.agents_revision, checksum);
	assert.equal(manifest.revision, false);
	assert.equal(manifest.source_commit, f.initialCommit);
	assert.equal(manifest.file_count, 1);
	assert.equal(manifest.tarball, 'agents/agents.tar.gz');
	assert.match(manifest.released_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
	assert.equal(execFileSync('tar', ['-xOzf', path.join(f.target, 'agents.tar.gz'), './AGENTS.md'], {
		encoding: 'utf8',
	}), 'Use the shipped WP Lemon API.\n');
});

test('identical instructions and version produce no changes despite new commit and mtime', (t) => {
	const f = fixture(t);
	f.publish();
	const before = f.snapshot();
	fs.utimesSync(path.join(f.agents, 'AGENTS.md'), new Date(), new Date());
	fs.writeFileSync(path.join(f.source, 'unrelated.txt'), 'Unrelated source update\n');
	f.commit();
	f.publish();
	assert.deepEqual(f.snapshot(), before);
});

test('instructions change independently of the theme version, including added and removed files', (t) => {
	const f = fixture(t);
	const before = f.publish();
	fs.unlinkSync(path.join(f.agents, 'AGENTS.md'));
	fs.mkdirSync(path.join(f.agents, 'references'));
	fs.writeFileSync(path.join(f.agents, 'references/api.md'), 'Revised API guidance\n');
	const commit = f.commit();
	const after = f.publish();
	assert.equal(after.version, before.version);
	assert.notEqual(after.sha256, before.sha256);
	assert.equal(after.agents_revision, after.sha256);
	assert.equal(before.revision, false);
	assert.equal(after.revision, 1);
	fs.writeFileSync(path.join(f.agents, 'references/api.md'), 'Revised again\n');
	f.commit();
	assert.equal(f.publish().revision, 2);
	assert.equal(after.source_commit, commit);
	assert.equal(after.file_count, 1);
	const listing = execFileSync('tar', ['-tzf', path.join(f.target, 'agents.tar.gz')], { encoding: 'utf8' });
	assert.ok(listing.includes('./references/api.md'));
	assert.ok(!listing.includes('./AGENTS.md'));
});

test('a full theme version bump updates provenance without changing the agent revision', (t) => {
	const f = fixture(t);
	const before = f.publish();
	fs.writeFileSync(path.join(f.source, 'package.json'), '{"version":"5.67.0"}\n');
	const commit = f.commit();
	const after = f.publish();
	assert.equal(after.version, '5.67.0');
	assert.equal(after.agents_revision, before.agents_revision);
	assert.equal(after.revision, false);
	assert.equal(after.source_commit, commit);
	const snapshot = f.snapshot();
	f.publish();
	assert.deepEqual(f.snapshot(), snapshot);
});

test('older and diverged commits are rejected without modifying published resources', (t) => {
	const f = fixture(t);
	fs.writeFileSync(path.join(f.agents, 'AGENTS.md'), 'New instructions\n');
	f.commit();
	f.publish();
	const before = f.snapshot();
	git(f.source, 'checkout', '--detach', f.initialCommit);
	let result = f.run();
	assert.notEqual(result.status, 0);
	assert.match(result.stdout, /older or diverged/);
	assert.deepEqual(f.snapshot(), before);
	git(f.source, 'checkout', '-b', 'diverged');
	fs.writeFileSync(path.join(f.agents, 'AGENTS.md'), 'Diverged instructions\n');
	f.commit();
	result = f.run();
	assert.notEqual(result.status, 0);
	assert.match(result.stdout, /older or diverged/);
	assert.deepEqual(f.snapshot(), before);
});

test('legacy manifests migrate without changing release identity', (t) => {
	const f = fixture(t);
	const before = f.publish();
	const legacy = { ...before };
	delete legacy.agents_revision;
	delete legacy.revision;
	fs.writeFileSync(path.join(f.target, 'manifest.json'), JSON.stringify(legacy));
	assert.deepEqual(f.publish(), before);
});

test('missing or empty instruction directories fail explicitly', (t) => {
	const f = fixture(t);
	fs.unlinkSync(path.join(f.agents, 'AGENTS.md'));
	let result = f.run();
	assert.notEqual(result.status, 0);
	assert.match(result.stdout, /instruction set is empty/);
	assert.equal(fs.existsSync(f.target), false);
	fs.rmdirSync(f.agents);
	result = f.run();
	assert.notEqual(result.status, 0);
	assert.match(result.stdout, /No agent instructions found/);
	assert.equal(fs.existsSync(f.target), false);
});

test('invalid versions or previous manifests fail without modifying published resources', (t) => {
	const f = fixture(t);
	f.publish();
	const before = f.snapshot();
	fs.writeFileSync(path.join(f.source, 'package.json'), '{"version":null}\n');
	let result = f.run();
	assert.notEqual(result.status, 0);
	assert.match(result.stdout, /non-empty version string/);
	assert.deepEqual(f.snapshot(), before);
	fs.writeFileSync(path.join(f.source, 'package.json'), '{"version":"5.66.2"}\n');
	fs.writeFileSync(path.join(f.target, 'manifest.json'), '{"source_commit":"invalid"}\n');
	const invalid = f.snapshot();
	result = f.run();
	assert.notEqual(result.status, 0);
	assert.match(result.stdout, /valid source commit/);
	assert.deepEqual(f.snapshot(), invalid);
});
