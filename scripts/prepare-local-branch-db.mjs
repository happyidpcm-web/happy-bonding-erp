import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
const sourceText = readFileSync('.env', 'utf8');
const source = parse(sourceText);
const local = parse(readFileSync('../.env', 'utf8'));
const target = new URL(local.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(target.hostname)) throw new Error('Local target required');
target.pathname = '/happybonding_branch_dev';
target.search = '';
mkdirSync('.local', { recursive: true });
if (!existsSync('.local/env-before-branch-work')) writeFileSync('.local/env-before-branch-work', sourceText, { flag: 'wx' });
function run(name, args, url) {
  const u = new URL(url);
  const env = { ...process.env, PGHOST: u.hostname, PGPORT: u.port || '5432', PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: u.pathname.slice(1), PGSSLMODE: u.searchParams.get('sslmode') || (u.hostname === 'localhost' ? 'disable' : 'require') };
  const result = spawnSync(`C:/Program Files/PostgreSQL/18/bin/${name}.exe`, args, { env, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${name}: ${result.stderr || result.error}`);
}
run('pg_dump', ['--no-owner', '--no-acl', '-Fc', '-f', '.local/before-branch-isolation.dump'], source.DATABASE_URL);
const maintenance = new URL(target); maintenance.pathname = '/postgres';
run('psql', ['-v', 'ON_ERROR_STOP=1', '-c', 'CREATE DATABASE happybonding_branch_dev'], maintenance);
run('pg_restore', ['--no-owner', '--no-acl', '-d', 'happybonding_branch_dev', '.local/before-branch-isolation.dump'], target);
const next = sourceText.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${JSON.stringify(target.toString() + '?schema=public')}`).replace(/^AUTO_SETUP_DATABASE=.*$/m, 'AUTO_SETUP_DATABASE="false"');
writeFileSync('.env', next + '\nAUTO_SETUP_DATABASE="false"\n');
console.log('Local development database cloned; .env now points to localhost/happybonding_branch_dev. Live database unchanged.');
