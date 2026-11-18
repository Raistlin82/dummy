#!/usr/bin/env node
/**
 * Writes to SAP Cloud Identity Services for the nova-ips-provisioning skill, always as
 * dry-run first: it builds the requests, prints them without secrets and a plan hash, and
 * sends them only with --apply --confirm <hash> --confirmed-by "<name, role>".
 *
 *   node ips.mjs help
 *   node ips.mjs selftest                                        (offline checks, no network)
 *   node ips.mjs start-job --source <SourceSystemId> --type READ|RESYNC
 *   node ips.mjs get-user --user-name <userName>                 (read, allowed in production)
 *   node ips.mjs get-group --display-name <displayName>          (read, allowed in production)
 *   node ips.mjs create-user --file <user.json>
 *   node ips.mjs create-group --file <group.json>
 *   node ips.mjs add-members --group <groupId> --user <userId> [--user <userId>]...
 *   node ips.mjs seed --file <testdata.json>                     (users, groups, memberships in one plan)
 *
 * Common options: --apply, --confirm <hash>, --confirmed-by <text>, --repo <app repo> (default: cwd),
 * --log <file> (default: <repo>/docs/identity/ips-log.md).
 *
 * Verified APIs (see ../references/api-sources.md):
 * - Identity Provisioning tenant admin API: POST https://<ias-host>/ips/service/publicapi/v1/startJob/{SourceSystemId}/jobs/{READ|RESYNC},
 *   technical user (administrator of type System) with "Access Identity Provisioning Tenant Admin API",
 *   Basic authentication with its client ID and secret.
 * - Identity Directory SCIM 2.0 API: /scim/Users, /scim/Groups (successor of the deprecated /service/scim),
 *   system administrator with Manage Users (and Manage Groups); OAuth2 client credentials at https://<ias-host>/oauth2/token.
 *
 * Environment (never in the repository, the chat or the logs):
 *   IPS_TENANT_HOST, IPS_CLIENT_ID, IPS_CLIENT_SECRET   or   IPS_CERT_P12 (path outside the repo), IPS_CERT_PASSPHRASE
 *   IPS_TENANT_ROLE = dev | test | prod                  (unset counts as prod: no writes)
 *   IAS_TENANT_HOST (default IPS_TENANT_HOST), IAS_CLIENT_ID, IAS_CLIENT_SECRET   or   IAS_CERT_P12, IAS_CERT_PASSPHRASE
 *   IAS_TENANT_ROLE (default IPS_TENANT_ROLE)
 *
 * Node.js 22, no dependencies.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { request as httpsRequest } from 'node:https'
import { dirname, join, relative, resolve, isAbsolute } from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'

const SECRET_ENV = ['IPS_CLIENT_SECRET', 'IPS_CERT_PASSPHRASE', 'IAS_CLIENT_SECRET', 'IAS_CERT_PASSPHRASE', 'IPS_CLIENT_ID', 'IAS_CLIENT_ID']
const JOB_TYPES = ['READ', 'RESYNC']
const SCIM_JSON = 'application/scim+json'
const PATCH_OP = 'urn:ietf:params:scim:api:messages:2.0:PatchOp'
const USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User'
const GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group'

// ---------------------------------------------------------------- secrets and output

export function masker(env = process.env) {
  const values = SECRET_ENV.map(name => env[name]).filter(v => typeof v === 'string' && v.length >= 4)
  return text => {
    let out = String(text)
    for (const value of values) out = out.split(value).join('***')
    // bearer tokens and basic credentials that could come back in an error body
    return out.replace(/(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g, '$1 ***')
      .replace(/("?(access_token|client_secret|password|refresh_token)"?\s*[:=]\s*)"[^"]*"/gi, '$1"***"')
  }
}

const mask = masker()
process.stdout.on('error', e => { if (e.code === 'EPIPE') process.exit(0); throw e })
const say = text => process.stdout.write(mask(text) + '\n')
const fail = (text, code = 1) => { process.stderr.write(mask(`error: ${text}`) + '\n'); process.exit(code) }

// ---------------------------------------------------------------- environment

function role(value) {
  const r = (value ?? '').trim().toLowerCase()
  return ['dev', 'test', 'prod'].includes(r) ? r : 'prod'
}

function hostOf(value, name) {
  if (!value) return undefined
  const host = value.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) fail(`${name} must be a host name, e.g. mytenant.accounts.ondemand.com`)
  return host
}

export function settings(env = process.env) {
  const ipsHost = hostOf(env.IPS_TENANT_HOST, 'IPS_TENANT_HOST')
  return {
    ips: {
      host: ipsHost, role: role(env.IPS_TENANT_ROLE),
      clientId: env.IPS_CLIENT_ID, clientSecret: env.IPS_CLIENT_SECRET,
      p12: env.IPS_CERT_P12, passphrase: env.IPS_CERT_PASSPHRASE
    },
    ias: {
      host: hostOf(env.IAS_TENANT_HOST, 'IAS_TENANT_HOST') ?? ipsHost, role: role(env.IAS_TENANT_ROLE ?? env.IPS_TENANT_ROLE),
      clientId: env.IAS_CLIENT_ID, clientSecret: env.IAS_CLIENT_SECRET,
      p12: env.IAS_CERT_P12, passphrase: env.IAS_CERT_PASSPHRASE
    }
  }
}

function certOutsideRepo(path, repo, name) {
  if (!path) return
  const full = resolve(path)
  const rel = relative(resolve(repo), full)
  if (!rel.startsWith('..') && !isAbsolute(rel)) fail(`${name} points inside the repository (${rel}): keep the certificate outside it`)
  if (!existsSync(full)) fail(`${name} does not exist: ${full}`)
}

// ---------------------------------------------------------------- request builders (pure)

export function startJobRequest(host, source, type) {
  if (!source || !/^[A-Za-z0-9-]+$/.test(source)) throw new Error('--source must be the source system ID (end of the system URL in the administration console)')
  const jobType = String(type ?? '').toUpperCase()
  if (!JOB_TYPES.includes(jobType)) throw new Error(`--type must be READ or RESYNC (a Simulate job runs only from the administration console)`)
  return { api: 'ips', method: 'POST', url: `https://${host ?? '<IPS_TENANT_HOST>'}/ips/service/publicapi/v1/startJob/${source}/jobs/${jobType}`,
    what: `start ${jobType} job of source system ${source}` }
}

function scimFilterValue(value, name) {
  if (!value || /["\\]/.test(value)) throw new Error(`${name} is required and must not contain quotes or backslashes`)
  return value
}

export function getUserRequest(host, userName) {
  const filter = `userName eq "${scimFilterValue(userName, '--user-name')}"`
  return { api: 'ias', method: 'GET', url: `https://${host ?? '<IAS_TENANT_HOST>'}/scim/Users?filter=${encodeURIComponent(filter)}`, what: `read user ${userName}`, read: true }
}

export function getGroupRequest(host, displayName) {
  const filter = `displayName eq "${scimFilterValue(displayName, '--display-name')}"`
  return { api: 'ias', method: 'GET', url: `https://${host ?? '<IAS_TENANT_HOST>'}/scim/Groups?filter=${encodeURIComponent(filter)}`, what: `read group ${displayName}`, read: true }
}

function findKey(value, key, path = '$') {
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k.toLowerCase() === key) return `${path}.${k}`
      const found = findKey(v, key, `${path}.${k}`)
      if (found) return found
    }
  }
  return undefined
}

export function validateUser(user) {
  if (!user || typeof user !== 'object' || Array.isArray(user)) throw new Error('the user must be a JSON object')
  if (!Array.isArray(user.schemas) || !user.schemas.includes(USER_SCHEMA)) throw new Error(`the user needs "schemas" with ${USER_SCHEMA}`)
  if (!user.userName && !(Array.isArray(user.emails) && user.emails[0]?.value)) throw new Error('the user needs userName or emails[0].value')
  const secret = findKey(user, 'password')
  if (secret) throw new Error(`the user carries a password (${secret}): never put passwords in files; let IAS send the activation e-mail (sap extension sendMail)`)
  return user
}

export function validateGroup(group) {
  if (!group || typeof group !== 'object' || Array.isArray(group)) throw new Error('the group must be a JSON object')
  if (!Array.isArray(group.schemas) || !group.schemas.includes(GROUP_SCHEMA)) throw new Error(`the group needs "schemas" with ${GROUP_SCHEMA}`)
  if (!group.displayName) throw new Error('the group needs displayName')
  return group
}

export function createUserRequest(host, user) {
  validateUser(user)
  return { api: 'ias', method: 'POST', url: `https://${host ?? '<IAS_TENANT_HOST>'}/scim/Users`, contentType: SCIM_JSON, body: user,
    what: `create user ${user.userName ?? user.emails[0].value}`, key: `user:${user.userName ?? user.emails[0].value}` }
}

export function createGroupRequest(host, group) {
  validateGroup(group)
  return { api: 'ias', method: 'POST', url: `https://${host ?? '<IAS_TENANT_HOST>'}/scim/Groups`, contentType: SCIM_JSON, body: group,
    what: `create group ${group.displayName}`, key: `group:${group.displayName}` }
}

export function addMembersRequest(host, groupId, userIds) {
  if (!groupId) throw new Error('--group is required (the SCIM id of the group, or <id of group NAME> in a seed)')
  if (!userIds?.length) throw new Error('at least one --user is required')
  return { api: 'ias', method: 'PATCH', url: `https://${host ?? '<IAS_TENANT_HOST>'}/scim/Groups/${groupId}`, contentType: SCIM_JSON,
    body: { schemas: [PATCH_OP], Operations: [{ op: 'add', path: 'members', value: userIds.map(value => ({ value, type: 'User' })) }] },
    what: `add ${userIds.length} member(s) to group ${groupId}` }
}

/** A seed: { users: [scim user], groups: [scim group], memberships: [{ group: displayName, users: [userName] }] } */
export function seedRequests(host, seed) {
  if (!seed || typeof seed !== 'object') throw new Error('the seed must be a JSON object with users, groups, memberships')
  const plan = []
  for (const user of seed.users ?? []) plan.push(createUserRequest(host, user))
  for (const group of seed.groups ?? []) plan.push(createGroupRequest(host, group))
  for (const m of seed.memberships ?? []) {
    if (!m.group || !m.users?.length) throw new Error('each membership needs group (displayName) and users (userName list)')
    plan.push(addMembersRequest(host, `<id of group ${m.group}>`, m.users.map(u => `<id of user ${u}>`)))
  }
  if (!plan.length) throw new Error('the seed is empty')
  return plan
}

export function planHash(plan) {
  const stable = plan.map(({ method, url, body }) => ({ method, url, body: body ?? null }))
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex').slice(0, 12)
}

// ---------------------------------------------------------------- output of a plan

function printPlan(plan, conf) {
  say(`Dry-run: ${plan.length} request(s). Nothing has been sent.`)
  plan.forEach((r, i) => {
    const side = conf[r.api]
    say(`\n[${i + 1}] ${r.what}`)
    say(`    ${r.method} ${r.url}`)
    say(`    tenant role: ${side.role}${r.read ? ' (read)' : ''}`)
    say(`    auth: ${authLabel(r.api, side)}`)
    if (r.contentType) say(`    Content-Type: ${r.contentType}`)
    if (r.body) say('    body:\n' + JSON.stringify(r.body, null, 2).replace(/^/gm, '      '))
  })
  say(`\nPlan hash: ${planHash(plan)}`)
}

function authLabel(api, side) {
  if (side.p12) return `client certificate (${api === 'ips' ? 'IPS' : 'IAS'}_CERT_P12)`
  return api === 'ips' ? 'Basic with IPS_CLIENT_ID / IPS_CLIENT_SECRET (***)' : 'OAuth2 client credentials from IAS_CLIENT_ID / IAS_CLIENT_SECRET (Bearer ***)'
}

// ---------------------------------------------------------------- HTTP

function send({ method, url, headers = {}, body, p12, passphrase }) {
  const payload = body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body))
  return new Promise((resolvePromise, reject) => {
    const req = httpsRequest(url, {
      method,
      headers: { Accept: 'application/json', ...headers, ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) },
      ...(p12 ? { pfx: readFileSync(p12), passphrase } : {}),
      timeout: 30000
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolvePromise({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('timeout', () => req.destroy(new Error('timeout after 30 s')))
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

const tokens = {}
async function authHeaders(api, side) {
  if (side.p12) return {}
  if (!side.clientId || !side.clientSecret) {
    const p = api === 'ips' ? 'IPS' : 'IAS'
    fail(`set ${p}_CLIENT_ID and ${p}_CLIENT_SECRET (or ${p}_CERT_P12 and ${p}_CERT_PASSPHRASE) in the environment`, 2)
  }
  if (api === 'ips') return { Authorization: 'Basic ' + Buffer.from(`${side.clientId}:${side.clientSecret}`).toString('base64') }
  if (!tokens.ias) {
    const form = new URLSearchParams({ grant_type: 'client_credentials', client_id: side.clientId, client_secret: side.clientSecret }).toString()
    const res = await send({ method: 'POST', url: `https://${side.host}/oauth2/token`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form })
    if (res.status !== 200) fail(`token request refused (HTTP ${res.status}): check IAS_CLIENT_ID / IAS_CLIENT_SECRET and the administrator roles`, 2)
    tokens.ias = JSON.parse(res.text).access_token
    if (!tokens.ias) fail('the token response has no access_token', 2)
  }
  return { Authorization: `Bearer ${tokens.ias}` }
}

async function execute(r, conf) {
  const side = conf[r.api]
  if (!side.host) fail(`set ${r.api === 'ips' ? 'IPS' : 'IAS'}_TENANT_HOST in the environment`, 2)
  const headers = { ...(await authHeaders(r.api, side)), ...(r.contentType ? { 'Content-Type': r.contentType } : {}) }
  const res = await send({ method: r.method, url: r.url, headers, body: r.body, p12: side.p12, passphrase: side.passphrase })
  let json
  try { json = res.text ? JSON.parse(res.text) : undefined } catch { json = undefined }
  return { status: res.status, json, text: res.text }
}

// ---------------------------------------------------------------- log

function logWrite(file, rows) {
  mkdirSync(dirname(file), { recursive: true })
  if (!existsSync(file)) {
    appendFileSync(file, '# Identity Provisioning e Identity Directory: registro delle scritture\n\n' +
      'Scritto da `nova-ips-provisioning` (scripts/ips.mjs). Nessun segreto: solo host, richiesta, esito, id e chi ha confermato.\n\n' +
      '| Quando (UTC) | Tenant | Ruolo | Richiesta | Esito | Id | Confermato da | Piano |\n|---|---|---|---|---|---|---|---|\n')
  }
  appendFileSync(file, rows.map(r => `| ${r.when} | ${r.host} | ${r.role} | ${r.request} | ${r.result} | ${r.id} | ${r.by} | ${r.hash} |`).join('\n') + '\n')
}

// ---------------------------------------------------------------- selftest

function selftest() {
  const checks = []
  const ok = (name, fn) => { try { fn(); checks.push(`ok   ${name}`) } catch (e) { checks.push(`FAIL ${name}: ${e.message}`) } }
  const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`) }
  ok('start job URL', () => eq(startJobRequest('t.accounts.ondemand.com', 'd77f5c7b-6d4f', 'read').url,
    'https://t.accounts.ondemand.com/ips/service/publicapi/v1/startJob/d77f5c7b-6d4f/jobs/READ'))
  ok('SIMULATE refused', () => { try { startJobRequest('h', 'x', 'SIMULATE') } catch { return } throw new Error('accepted') })
  ok('password refused', () => { try { validateUser({ schemas: [USER_SCHEMA], userName: 'a', password: 'x' }) } catch { return } throw new Error('accepted') })
  ok('nested password refused', () => { try { validateUser({ schemas: [USER_SCHEMA], userName: 'a', x: { Password: 'x' } }) } catch { return } throw new Error('accepted') })
  ok('patch members', () => eq(addMembersRequest('h', 'g1', ['u1']).body,
    { schemas: [PATCH_OP], Operations: [{ op: 'add', path: 'members', value: [{ value: 'u1', type: 'User' }] }] }))
  ok('seed placeholders', () => eq(seedRequests('h', {
    users: [{ schemas: [USER_SCHEMA], userName: 'jdoe', emails: [{ value: 'j@example.com', primary: true }] }],
    groups: [{ schemas: [GROUP_SCHEMA], displayName: 'SALES_VIEWER' }],
    memberships: [{ group: 'SALES_VIEWER', users: ['jdoe'] }] }).map(r => r.method), ['POST', 'POST', 'PATCH']))
  ok('filter quoting', () => { try { getUserRequest('h', 'a"b') } catch { return } throw new Error('accepted') })
  ok('masking', () => {
    const m = masker({ IPS_CLIENT_SECRET: 'sup3r-secret-value' })
    eq(m('x sup3r-secret-value y Bearer abcdefghijkl "client_secret":"zzz"'), 'x *** y Bearer *** "client_secret":"***"')
  })
  ok('role defaults to prod', () => eq(settings({}).ips.role, 'prod'))
  ok('hash stable', () => eq(planHash([startJobRequest('h', 'a', 'READ')]), planHash([startJobRequest('h', 'a', 'READ')])))
  say(checks.join('\n'))
  if (checks.some(c => c.startsWith('FAIL'))) process.exit(1)
}

// ---------------------------------------------------------------- main

const HELP = readFileSync(new URL(import.meta.url)).toString().split('*/')[0].replace(/^#!.*\n\/\*\*\n?/, '').replace(/^ \* ?/gm, '')

async function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv, allowPositionals: true, strict: true,
    options: {
      source: { type: 'string' }, type: { type: 'string' }, 'user-name': { type: 'string' }, 'display-name': { type: 'string' },
      file: { type: 'string' }, group: { type: 'string' }, user: { type: 'string', multiple: true },
      apply: { type: 'boolean', default: false }, 'dry-run': { type: 'boolean', default: false }, confirm: { type: 'string' },
      'confirmed-by': { type: 'string' }, repo: { type: 'string' }, log: { type: 'string' }, help: { type: 'boolean', short: 'h' }
    }
  })
  const command = positionals[0] ?? 'help'
  if (values.help || command === 'help') return say(HELP)
  if (command === 'selftest') return selftest()

  const repo = resolve(values.repo ?? process.cwd())
  const conf = settings()
  certOutsideRepo(conf.ips.p12, repo, 'IPS_CERT_P12')
  certOutsideRepo(conf.ias.p12, repo, 'IAS_CERT_P12')
  const readJson = file => {
    if (!file) throw new Error('--file is required')
    return JSON.parse(readFileSync(resolve(file), 'utf8'))
  }

  let plan
  try {
    switch (command) {
      case 'start-job': plan = [startJobRequest(conf.ips.host, values.source, values.type)]; break
      case 'get-user': plan = [getUserRequest(conf.ias.host, values['user-name'])]; break
      case 'get-group': plan = [getGroupRequest(conf.ias.host, values['display-name'])]; break
      case 'create-user': plan = [createUserRequest(conf.ias.host, readJson(values.file))]; break
      case 'create-group': plan = [createGroupRequest(conf.ias.host, readJson(values.file))]; break
      case 'add-members': plan = [addMembersRequest(conf.ias.host, values.group, values.user)]; break
      case 'seed': plan = seedRequests(conf.ias.host, readJson(values.file)); break
      default: fail(`unknown command ${command}: see "node ips.mjs help"`)
    }
  } catch (e) { fail(e.message) }

  const reads = plan.every(r => r.read)
  if (reads && values['dry-run']) return printPlan(plan, conf)
  if (reads) {
    // reads run directly: they change nothing, and are the only thing allowed in production
    for (const r of plan) {
      const res = await execute(r, conf)
      say(`${r.method} ${r.url} -> HTTP ${res.status}`)
      const found = res.json?.Resources ?? []
      say(JSON.stringify(found.map(x => ({ id: x.id, userName: x.userName, displayName: x.displayName, active: x.active, members: x.members?.length })), null, 2))
    }
    return
  }

  const prod = plan.some(r => conf[r.api].role === 'prod')
  printPlan(plan, conf)
  if (prod) {
    say('\nThe tenant role is prod (or IPS_TENANT_ROLE / IAS_TENANT_ROLE is not set): writes are not allowed.\n' +
      'Hand this plan to the tenant administrator, who runs it with their own user; then verify in read: get-user, get-group, Provisioning Logs.')
    if (values.apply) process.exit(3)
    return
  }
  if (!values.apply) {
    say('\nTo execute: show this plan to the user, get an explicit yes, then run the same command with\n' +
      `  --apply --confirm ${planHash(plan)} --confirmed-by "<name, role>"`)
    return
  }
  if (values.confirm !== planHash(plan)) fail(`--confirm must be the plan hash ${planHash(plan)} of this exact plan`, 4)
  if (!values['confirmed-by']) fail('--confirmed-by "<name, role>" is required with --apply', 4)

  const logFile = resolve(values.log ?? join(repo, 'docs/identity/ips-log.md'))
  const ids = {}
  const rows = []
  const hash = planHash(plan)
  try {
    for (const r of plan) {
      const concrete = { ...r, url: r.url.replace(/<id of (user|group) ([^>]+)>/g, (_, kind, name) => ids[`${kind}:${name}`] ?? _) }
      if (concrete.body?.Operations) {
        concrete.body = JSON.parse(JSON.stringify(concrete.body).replace(/<id of (user|group) ([^>]+)>/g, (_, kind, name) => ids[`${kind}:${name}`] ?? _))
      }
      if (/<id of /.test(concrete.url + JSON.stringify(concrete.body ?? ''))) {
        throw new Error(`cannot resolve ${concrete.url}: a user or group of the membership was not created in this plan; use get-user / get-group and add-members`)
      }
      const res = await execute(concrete, conf)
      const id = res.json?.id ?? res.json?.jobId ?? ''
      if (r.key && id) ids[r.key] = id
      rows.push({ when: new Date().toISOString(), host: conf[r.api].host, role: conf[r.api].role,
        request: `${r.method} ${new URL(concrete.url).pathname}`, result: `HTTP ${res.status}`, id: id || '-',
        by: values['confirmed-by'].replace(/\|/g, '/'), hash })
      say(`${r.method} ${concrete.url} -> HTTP ${res.status}${id ? ` id ${id}` : ''}`)
      if (res.status >= 300) {
        say(res.text.slice(0, 2000))
        throw new Error(`HTTP ${res.status} on ${r.what}: stopped; the requests before it are in the log`)
      }
    }
  } finally {
    if (rows.length) { logWrite(logFile, rows); say(`Logged ${rows.length} row(s) in ${relative(repo, logFile) || logFile}`) }
  }
  if (plan.some(r => r.url.includes('/startJob/'))) {
    say('Check the job in Identity Provisioning > Provisioning Logs of the administration console: the API does not return the job result.')
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch(e => fail(e.message))
}
