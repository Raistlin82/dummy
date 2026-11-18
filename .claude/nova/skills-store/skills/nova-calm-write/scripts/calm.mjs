#!/usr/bin/env node
/**
 * Writes to SAP Cloud ALM for the nova-calm-write skill, always as dry-run first: it builds the
 * requests, prints them without secrets and a plan hash, and sends them only with
 * --apply --confirm <hash> --confirmed-by "<name, role>". Reads belong to the mcp-calmcp server.
 *
 *   node calm.mjs help
 *   node calm.mjs selftest                                              (offline checks, no network)
 *   node calm.mjs create-requirement --title <t> [--description <html>] [--external-id <id>] [task options]
 *   node calm.mjs create-user-story  --title <t> [--description <html>] [--external-id <id>] [task options]
 *   node calm.mjs create-task        --title <t> [--description <html>] [--external-id <id>] [task options]   (project task)
 *   node calm.mjs create-defect      --title <t> [--description <html>] [--external-id <id>] [task options]
 *       task options: --timebox <uuid> (phase or sprint) --release <uuid> --assignee <user id> --due <YYYY-MM-DD>
 *   node calm.mjs update-task --id <taskId> --file <patch.json>         (status, subStatus, approvalState, title, ...)
 *   node calm.mjs set-task-status --id <taskId> --status <code> [--sub-status <code>]   (codes of the tenant, read with calm)
 *   node calm.mjs add-task-comment --id <taskId> --text <t>             (the progress of a wave, at a sync point)
 *   node calm.mjs add-task-reference --id <taskId> --name <n> --url <u>
 *   node calm.mjs assign-task-feature --id <taskId> --feature <featureUuid>   (requirement, user story, task or defect)
 *   node calm.mjs relate-tasks --id <taskId> --to <taskId> [--type 0]   (a task and a user story)
 *   node calm.mjs create-test-case --file <testcase.json>               (ManualTestCases, activities and actions inside)
 *   node calm.mjs update-test-case --uuid <uuid> --file <patch.json>    (title, isPrepared, priorityCode; If-Match read at apply)
 *   node calm.mjs add-test-reference --test-case <uuid> --name <n> --url <u>
 *   node calm.mjs create-feature --title <t> [--description <t>] [--priority 10|20|30|40] [--scope <scopeId>]
 *                                [--release <uuid>] [--responsible <user id>]
 *   node calm.mjs set-feature-status --uuid <uuid> --status IN_REALIZATION|IN_TESTING|SUCCESSFULLY_TESTED|NOT_PLANNED
 *   node calm.mjs add-feature-reference --uuid <uuid> --name <n> --url <u>
 *   node calm.mjs ci-evidence --feature <uuid> --junit <report.xml> --run-url <url> [--test-case <uuid>]
 *   node calm.mjs create-document --title <t> [--type <documentTypeCode>] [--content-file <file.html>] [--external-id <id>] [--url <u>]
 *   node calm.mjs upload-document-file --uuid <documentUuid> --file <file.docx|pdf|...>  (new version of the attached file)
 *   node calm.mjs assign-document-task --uuid <documentUuid> --task <taskUuid>           (requirement or user story)
 *   node calm.mjs add-document-reference --uuid <documentUuid> --name <n> --url <u>
 *   node calm.mjs create-development --title <t> [--description <t>] [--development-type <code>] [--development-id <id>]
 *                                    [--external-id <id>] [--url <u>]     (an element of the Development Library)
 *   node calm.mjs request --method POST|PATCH --path </calm-...> --file <body.json>   (other documented write, allowlisted)
 *   node calm.mjs batch --file <ops.json>                               ([{ "command": "...", ...options }], one plan)
 *
 * Common options: --apply, --confirm <hash>, --confirmed-by <text>, --project <uuid> (default CALM_PROJECT_ID),
 * --repo <app repo> (default: cwd), --log <file> (default: <repo>/docs/alm/calm-log.md).
 *
 * Verified APIs (see ../references/api-sources.md): Task API /api/calm-tasks/v1, Test Cases API
 * /api/calm-testmanagement/v1, Features API /api/calm-features/v1, Document API /api/calm-documents/v1
 * (no update of a document: its file gets a new version), Development Library API
 * /api/calm-crosslibrarydevelopments/v1 (the body of its POST is taken from the GET example: check the plan);
 * OAuth2 client credentials of an SAP Cloud ALM API service instance; at most 500 requests per 5 seconds.
 *
 * Environment (never in the repository, the chat or the logs):
 *   CALM_TENANT, CALM_REGION                 (https://<tenant>.<region>.alm.cloud.sap)
 *   CALM_WRITE_SERVICE_KEY  the service key of the WRITE instance (not calmcp's read one), as JSON: the only credential.
 *                   The Nova WOLF executor reads the key of the tenant of the program from SAP Credential Store
 *                   (password nova-calm-write-key-<tenant>, or nova-calm-write-key in an installation with one tenant)
 *                   into this variable. It gives the client id, the secret, the token URL (uaa.url + /oauth/token)
 *                   and the API base (endpoints.Api + /api). A key without uaa.url or endpoints.Api never asks for a
 *                   token; a key whose endpoints.Api is not the tenant of CALM_TENANT and CALM_REGION (or
 *                   CALM_API_BASE) is refused. A client in separate variables is not read (decision of the product
 *                   owner, 18/11/2026: one key per tenant, checked against the tenant)
 *   NOVA_CALM_WRITE_FILE  in an autonomous run of Nova WOLF (Agent SDK, Job on Kyma), instead of the variable: the path of
 *                   a file of that run only, outside its folder, with the same key, written by the runner and removed
 *                   at the end (Claude Code removes a variable that looks like a credential from the commands of an
 *                   unattended run). CALM_WRITE_SERVICE_KEY wins when both are set
 *   CALM_API_BASE   optional: the tenant as an API base, for a host that is not <tenant>.<region>.alm.cloud.sap
 *   CALM_PROJECT_ID the one project of this development: every write must belong to it
 *
 * Node.js 22, no dependencies.
 */
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'

// the secret of calmcp's read client, when the session has it: masked too
const SECRET_ENV = ['CALM_CLIENT_SECRET']
const TASKS = '/calm-tasks/v1'
const TESTS = '/calm-testmanagement/v1'
const FEATURES = '/calm-features/v1'
const DOCUMENTS = '/calm-documents/v1'
const LIBRARY = '/calm-crosslibrarydevelopments/v1'
const WRITE_PREFIXES = [TASKS + '/', TESTS + '/', FEATURES + '/', DOCUMENTS + '/', LIBRARY + '/']
// the approval of a requirement is a person's, in the Requirements app: never set by NOVA
const TASK_STATUS_FORBIDDEN = ['APPROVED_FOR_DEPLOYMENT']
// the files a Cloud ALM document takes as its external file, by extension
const FILE_TYPES = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', pdf: 'application/pdf',
  md: 'text/markdown', txt: 'text/plain', html: 'text/html', png: 'image/png', jpg: 'image/jpeg' }
// Feature status switches the Features API allows (Jan 2026) that are not about production:
// Ready for Production and Deployed are set in the Features app and by the deployment, never here.
const FEATURE_STATUS = ['NOT_PLANNED', 'IN_REALIZATION', 'IN_TESTING', 'SUCCESSFULLY_TESTED']
const TEST_CASE_PATCH = ['title', 'isPrepared', 'priorityCode']
const TASK_PATCH_FORBIDDEN = ['projectId', 'type', 'id', 'displayId', 'source']
const MIN_INTERVAL_MS = 10 // 500 requests per 5 seconds

// ---------------------------------------------------------------- secrets and output

/**
 * The service key as text: CALM_WRITE_SERVICE_KEY, else the file Nova WOLF writes for an autonomous run, named by
 * NOVA_CALM_WRITE_FILE (Claude Code removes a variable that looks like a credential from the commands of an unattended
 * run, so the runner gives the path of a file of that run only). A file that cannot be read gives no key.
 */
export function rawServiceKey(env = process.env) {
  if (env.CALM_WRITE_SERVICE_KEY) return env.CALM_WRITE_SERVICE_KEY
  if (!env.NOVA_CALM_WRITE_FILE) return undefined
  try { return readFileSync(env.NOVA_CALM_WRITE_FILE, 'utf8').trim() || undefined } catch { return undefined }
}

/** The service key of the write instance given as one JSON value: client id and secret at the top or under uaa. */
export function serviceKey(env = process.env) {
  const raw = rawServiceKey(env)
  if (!raw) return {}
  let key
  try { key = JSON.parse(raw) } catch { fail('CALM_WRITE_SERVICE_KEY is not the JSON of a service key', 2) }
  const uaa = key.uaa ?? {}
  const api = key.endpoints?.Api ?? key.endpoints?.api
  const auth = key.url ?? uaa.url
  return { clientId: key.clientid ?? uaa.clientid, clientSecret: key.clientsecret ?? uaa.clientsecret,
    tokenUrl: auth ? `${String(auth).replace(/\/+$/, '')}/oauth/token` : undefined,
    apiBase: api ? `${String(api).replace(/\/+$/, '')}/api` : undefined }
}

export function masker(env = process.env) {
  const key = serviceKey(env)
  const values = [...SECRET_ENV.map(name => env[name]), key.clientSecret, key.clientId]
    .filter(v => typeof v === 'string' && v.length >= 4)
  return text => {
    let out = String(text)
    for (const value of values) out = out.split(value).join('***')
    return out.replace(/(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g, '$1 ***')
      .replace(/("?(access_token|client_secret|clientsecret|refresh_token)"?\s*[:=]\s*)"[^"]*"/gi, '$1"***"')
  }
}

const mask = masker()
process.stdout.on('error', e => { if (e.code === 'EPIPE') process.exit(0); throw e })
const say = text => process.stdout.write(mask(text) + '\n')
const fail = (text, code = 1) => { process.stderr.write(mask(`error: ${text}`) + '\n'); process.exit(code) }

// ---------------------------------------------------------------- environment

/** The host of an https address, in lower case; null for anything else. */
export function hostOf(value) {
  try {
    const url = new URL(String(value ?? '').trim())
    return url.protocol === 'https:' && url.hostname ? url.host.toLowerCase() : null
  } catch {
    return null
  }
}

/**
 * The name of the key of a tenant in SAP Credential Store, as Nova WOLF reads it: nova-calm-write-key-<subdomain>, the
 * first label of the host in lower case (the rule of the configurator, one key per tenant, 18/11/2026).
 */
export function keyNameOf(host) {
  const label = String(host ?? '').toLowerCase().split('.')[0].replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '')
  return label ? `nova-calm-write-key-${label}` : null
}

/**
 * Why the key cannot write to the tenant, or null: the tenant is CALM_API_BASE, else CALM_TENANT and CALM_REGION; the
 * key's tenant is the host of endpoints.Api of CALM_WRITE_SERVICE_KEY. Two different hosts: the key is of another
 * customer. Names the key, never its value.
 */
export function tenantProblem(env = process.env) {
  const tenant = env.CALM_API_BASE ? hostOf(env.CALM_API_BASE)
    : env.CALM_TENANT && env.CALM_REGION ? `${env.CALM_TENANT}.${env.CALM_REGION}.alm.cloud.sap`.toLowerCase() : null
  const keyHost = hostOf(serviceKey(env).apiBase)
  if (!tenant || !keyHost || tenant === keyHost) return null
  return `the key in CALM_WRITE_SERVICE_KEY is of the tenant ${keyHost}, not of ${tenant}: ` +
    `in Nova WOLF the key of ${tenant} goes in the password ${keyNameOf(tenant)} of SAP Credential Store`
}

export function settings(env = process.env) {
  const tenant = env.CALM_TENANT
  const region = env.CALM_REGION
  if (tenant && !/^[a-z0-9][a-z0-9-]{0,62}$/i.test(tenant)) fail('CALM_TENANT must be the tenant subdomain only')
  if (region && !/^[a-z0-9-]+$/i.test(region)) fail('CALM_REGION must be a region such as eu10')
  const problem = tenantProblem(env)
  if (problem) fail(problem, 2)
  const key = serviceKey(env)
  const apiBase = (env.CALM_API_BASE ?? key.apiBase ?? (tenant && region ? `https://${tenant}.${region}.alm.cloud.sap/api` : undefined))?.replace(/\/+$/, '')
  // the client, its token URL and its tenant come from the service key only: no client in separate variables
  return {
    apiBase,
    tokenUrl: key.tokenUrl,
    clientId: key.clientId, clientSecret: key.clientSecret,
    keyApi: key.apiBase,
    project: env.CALM_PROJECT_ID
  }
}

/**
 * Why the credential cannot ask for a token, or null: no key (with the name of the password of the tenant), or a key
 * that is not the service key of an SAP Cloud ALM API instance (no client, no https uaa.url or endpoints.Api). A key
 * without endpoints.Api could not be checked against the tenant, so it never asks for a token.
 */
export function keyProblem(conf, env = process.env) {
  if (!conf.clientId || !conf.clientSecret) {
    const tenant = hostOf(conf.apiBase)
    const file = !env.CALM_WRITE_SERVICE_KEY && env.NOVA_CALM_WRITE_FILE
      ? 'the file of the key given by Nova WOLF (NOVA_CALM_WRITE_FILE) cannot be read or holds no key; ' : ''
    return file + (tenant ? `no key for the SAP Cloud ALM tenant ${tenant}: in Nova WOLF the service key goes in the password ` +
      `${keyNameOf(tenant)} of SAP Credential Store; elsewhere ` : '') +
      'put the service key of the write instance, as JSON, in CALM_WRITE_SERVICE_KEY'
  }
  if (!hostOf(conf.tokenUrl) || !hostOf(conf.keyApi))
    return 'the key in CALM_WRITE_SERVICE_KEY is not the service key of an SAP Cloud ALM API instance: it needs uaa.url and endpoints.Api (https)'
  return null
}

// ---------------------------------------------------------------- request builders (pure)

const text = (value, name, max = 255) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`)
  if (value.length > max) throw new Error(`${name} is longer than ${max} characters`)
  return value
}
const httpsUrl = (value, name) => {
  let u
  try { u = new URL(value) } catch { throw new Error(`${name} must be an absolute URL`) }
  if (u.protocol !== 'https:') throw new Error(`${name} must be https`)
  if (u.username || u.password || /token|secret|sig=|password/i.test(u.search)) throw new Error(`${name} must not carry credentials`)
  if (value.length > 5000) throw new Error(`${name} is longer than 5000 characters`)
  return value
}
const uuid = (value, name) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value ?? '')) throw new Error(`${name} must be a UUID`)
  return value
}
const project = ctx => uuid(ctx.project, '--project (or CALM_PROJECT_ID)')
const day = (value, name) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) throw new Error(`${name} must be a date YYYY-MM-DD`)
  return value
}
// a user of the tenant: its technical id, in most tenants the e-mail address
const userId = (value, name) => {
  if (typeof value !== 'string' || !/^[^\s<>"]{1,255}$/.test(value)) throw new Error(`${name} must be the user id of the tenant`)
  return value
}
const code = (value, name) => {
  const c = String(value ?? '').toUpperCase()
  if (!/^[A-Z][A-Z0-9_]{2,39}$/.test(c)) throw new Error(`${name} must be a code of the tenant, such as CIPTKINP`)
  return c
}

// where a task sits in the plan of the project: a phase or a sprint (timebox), a release of the deployment plan, who
// does it and by when (Task API, read on 2026-11-12)
function planning(o, body) {
  if (o.timebox) body.timeboxId = uuid(o.timebox, '--timebox')
  if (o.release) body.releaseId = uuid(o.release, '--release')
  if (o.assignee) body.assigneeId = userId(o.assignee, '--assignee')
  if (o.due) body.dueDate = day(o.due, '--due')
  return body
}

function createTask(ctx, type, o) {
  const body = { projectId: project(ctx), title: text(o.title, '--title'), type }
  if (o.description) body.description = o.description
  if (o['external-id']) body.externalId = o['external-id']
  planning(o, body)
  const kind = { CALMREQU: 'requirement', CALMUS: 'user story', CALMTASK: 'project task', CALMDEF: 'defect' }[type]
  return { method: 'POST', path: `${TASKS}/tasks`, body, what: `create ${kind} "${o.title}"` }
}

export const builders = {
  'create-requirement': (ctx, o) => createTask(ctx, 'CALMREQU', o),
  'create-user-story': (ctx, o) => createTask(ctx, 'CALMUS', o),
  // a task of the project: a wave of a custom code program, with its feature and its documents (docs/10, section 7.5)
  'create-task': (ctx, o) => createTask(ctx, 'CALMTASK', o),
  // a defect found in the test (CALM_TEST, UAT_TEST), assigned then to the feature it blocks
  'create-defect': (ctx, o) => createTask(ctx, 'CALMDEF', o),
  'update-task': (ctx, o) => {
    const body = o.body ?? readJson(o.file)
    const bad = Object.keys(body).filter(k => TASK_PATCH_FORBIDDEN.includes(k))
    if (bad.length) throw new Error(`the patch must not change ${bad.join(', ')}`)
    if (!Object.keys(body).length) throw new Error('the patch is empty')
    return { method: 'PATCH', path: `${TASKS}/tasks/${uuid(o.id, '--id')}`, body, what: `update task ${o.id}`,
      guard: { path: `${TASKS}/tasks/${o.id}`, project: 'projectId' } }
  },
  // the status of a task, a requirement or a user story, with the codes of the tenant; the approval stays in the app
  'set-task-status': (ctx, o) => {
    const body = { status: code(o.status, '--status') }
    if (o['sub-status']) body.subStatus = code(o['sub-status'], '--sub-status')
    if ([body.status, body.subStatus].some(c => TASK_STATUS_FORBIDDEN.includes(c))) {
      throw new Error('the approval for deployment is given in the Requirements app by whoever holds the role, not by NOVA')
    }
    return { method: 'PATCH', path: `${TASKS}/tasks/${uuid(o.id, '--id')}`, body, what: `set task ${o.id} to ${body.status}`,
      guard: { path: `${TASKS}/tasks/${o.id}`, project: 'projectId', status: 'status' } }
  },
  'add-task-comment': (ctx, o) => ({ method: 'POST', path: `${TASKS}/tasks/${uuid(o.id, '--id')}/comments`,
    body: { taskId: o.id, text: text(o.text, '--text', 5000) }, what: `comment on task ${o.id}`,
    guard: { path: `${TASKS}/tasks/${o.id}`, project: 'projectId' } }),
  'assign-task-feature': (ctx, o) => ({ method: 'POST', path: `${TASKS}/tasks/${uuid(o.id, '--id')}/featureAssignments`,
    body: { featureId: uuid(o.feature, '--feature') }, what: `assign task ${o.id} to feature ${o.feature}`,
    guard: { path: `${TASKS}/tasks/${o.id}`, project: 'projectId' } }),
  'relate-tasks': (ctx, o) => {
    const type = String(o.type ?? '0')
    if (!/^\d{1,2}$/.test(type)) throw new Error('--type must be the number of a relation type (0 in the SAP example)')
    return { method: 'POST', path: `${TASKS}/tasks/${uuid(o.id, '--id')}/relations`,
      body: { type, relationTaskId: uuid(o.to, '--to') }, what: `relate task ${o.id} to ${o.to}`,
      guard: { path: `${TASKS}/tasks/${o.id}`, project: 'projectId' } }
  },
  'add-task-reference': (ctx, o) => ({ method: 'POST', path: `${TASKS}/tasks/${uuid(o.id, '--id')}/references`,
    body: { taskId: o.id, name: text(o.name, '--name'), url: httpsUrl(o.url, '--url') }, what: `add reference "${o.name}" to task ${o.id}`,
    guard: { path: `${TASKS}/tasks/${o.id}`, project: 'projectId' } }),
  'create-test-case': (ctx, o) => {
    const body = o.body ?? readJson(o.file)
    text(body.title, 'title of the test case')
    if (body.projectId !== project(ctx)) throw new Error(`the test case projectId must be the project of this development (${ctx.project})`)
    if (!body.scopeId) throw new Error('the test case needs scopeId (a scope of the project)')
    return { method: 'POST', path: `${TESTS}/ManualTestCases`, body, what: `create manual test case "${body.title}"` }
  },
  'update-test-case': (ctx, o) => {
    const body = o.body ?? readJson(o.file)
    const bad = Object.keys(body).filter(k => !TEST_CASE_PATCH.includes(k))
    if (bad.length) throw new Error(`a test case PATCH updates only ${TEST_CASE_PATCH.join(', ')}; not ${bad.join(', ')} (use the Activities/Actions endpoints via "request")`)
    return { method: 'PATCH', path: `${TESTS}/ManualTestCases/${uuid(o.uuid, '--uuid')}`, body, what: `update test case ${o.uuid}`,
      etag: true, guard: { path: `${TESTS}/ManualTestCases/${o.uuid}`, project: 'projectId' } }
  },
  'add-test-reference': (ctx, o) => ({ method: 'POST', path: `${TESTS}/References`,
    body: { name: text(o.name, '--name'), url: httpsUrl(o.url, '--url'), parentTestCase_ID: uuid(o['test-case'], '--test-case') },
    what: `add reference "${o.name}" to test case ${o['test-case']}`, guard: { path: `${TESTS}/ManualTestCases/${o['test-case']}`, project: 'projectId' } }),
  'create-feature': (ctx, o) => {
    const body = { title: text(o.title, '--title'), projectId: project(ctx) }
    if (o.description) body.description = o.description
    if (o.priority) {
      if (!['10', '20', '30', '40'].includes(String(o.priority))) throw new Error('--priority must be 10, 20, 30 or 40')
      body.priorityCode = Number(o.priority)
    }
    if (o.scope) body.scopeId = uuid(o.scope, '--scope')
    // the release of the deployment plan the feature goes to production with, and who answers for it
    if (o.release) body.releaseId = uuid(o.release, '--release')
    if (o.responsible) body.responsibleId = userId(o.responsible, '--responsible')
    return { method: 'POST', path: `${FEATURES}/Features`, body, what: `create feature "${o.title}"` }
  },
  'set-feature-status': (ctx, o) => {
    const status = String(o.status ?? '').toUpperCase()
    if (!FEATURE_STATUS.includes(status)) {
      throw new Error(`--status must be one of ${FEATURE_STATUS.join(', ')}: Ready for Production is approved in the Features app, Deployed comes from the deployment`)
    }
    return { method: 'PATCH', path: `${FEATURES}/Features/${uuid(o.uuid, '--uuid')}`, body: { statusCode: status },
      what: `set feature ${o.uuid} to ${status}`, guard: { path: `${FEATURES}/Features/${o.uuid}`, project: 'projectId', status: 'statusCode' } }
  },
  'add-feature-reference': (ctx, o) => ({ method: 'POST', path: `${FEATURES}/URLReferences`,
    body: { parent_uuid: uuid(o.uuid, '--uuid'), name: text(o.name, '--name'), url: httpsUrl(o.url, '--url') },
    what: `add URL reference "${o.name}" to feature ${o.uuid}`, guard: { path: `${FEATURES}/Features/${o.uuid}`, project: 'projectId' } }),
  'create-document': (ctx, o) => {
    const body = { title: text(o.title, '--title'), projectId: project(ctx) }
    if (o.type) {
      if (!/^[A-Z0-9_]{1,10}$/.test(o.type)) throw new Error('--type must be a document type code of the tenant, such as SD')
      body.documentTypeCode = o.type
    }
    if (o['content-file'] || o.content) body.content = o.content ?? readFileSync(resolve(o['content-file']), 'utf8')
    // the id of the document in the repository: the same document is never created twice
    if (o['external-id']) body.toExternalReferences = [{ externalReferenceId: text(o['external-id'], '--external-id', 100),
      name: 'NOVA', ...(o.url ? { url: httpsUrl(o.url, '--url') } : {}) }]
    else if (o.url) body.toURLReferences = [{ name: 'Repository', url: httpsUrl(o.url, '--url') }]
    return { method: 'POST', path: `${DOCUMENTS}/Documents`, body, what: `create document "${o.title}"` }
  },
  'upload-document-file': (ctx, o) => {
    const file = resolve(text(o.file, '--file', 4096))
    const ext = extname(file).slice(1).toLowerCase()
    if (!FILE_TYPES[ext]) throw new Error(`--file must be one of ${Object.keys(FILE_TYPES).join(', ')}`)
    const content = o.bytes ?? readFileSync(file)
    return { method: 'PUT', path: `${DOCUMENTS}/Documents/${uuid(o.uuid, '--uuid')}/fileContent`,
      body: { file: basename(file), type: FILE_TYPES[ext], bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') },
      binary: { content, type: FILE_TYPES[ext], name: basename(file) },
      what: `upload ${basename(file)} as the new version of the file of document ${o.uuid}`,
      guard: { path: `${DOCUMENTS}/Documents/${o.uuid}`, project: 'projectId' } }
  },
  'assign-document-task': (ctx, o) => ({ method: 'POST', path: `${DOCUMENTS}/TaskAssignments`,
    body: { parent_uuid: uuid(o.uuid, '--uuid'), id: uuid(o.task, '--task') },
    what: `assign task ${o.task} to document ${o.uuid}`, guard: { path: `${DOCUMENTS}/Documents/${o.uuid}`, project: 'projectId' } }),
  'add-document-reference': (ctx, o) => ({ method: 'POST', path: `${DOCUMENTS}/URLReferences`,
    body: { parent_uuid: uuid(o.uuid, '--uuid'), name: text(o.name, '--name'), url: httpsUrl(o.url, '--url') },
    what: `add URL reference "${o.name}" to document ${o.uuid}`, guard: { path: `${DOCUMENTS}/Documents/${o.uuid}`, project: 'projectId' } }),
  // the development in the Development Library: one element per NOVA development, found again by its external reference
  'create-development': (ctx, o) => {
    const body = { title: text(o.title, '--title') }
    if (o.description) body.description = o.description
    if (o['development-type']) body.developmentTypeCode = code(o['development-type'], '--development-type')
    if (o['development-id']) body.developmentId = text(o['development-id'], '--development-id', 100)
    if (o['external-id']) body.toExternalReferences = [{ externalReferenceId: text(o['external-id'], '--external-id', 100),
      name: 'NOVA', ...(o.url ? { url: httpsUrl(o.url, '--url') } : {}) }]
    else if (o.url) body.url = httpsUrl(o.url, '--url')
    return { method: 'POST', path: `${LIBRARY}/Developments`, body, what: `create development "${o.title}" in the Development Library` }
  },
  'request': (ctx, o) => {
    const method = String(o.method ?? '').toUpperCase()
    if (!['POST', 'PATCH'].includes(method)) throw new Error('--method must be POST or PATCH (deletes are done by hand in Cloud ALM)')
    const path = String(o.path ?? '')
    if (!WRITE_PREFIXES.some(p => path.startsWith(p)) || /\.\.|\?|#/.test(path)) {
      throw new Error(`--path must start with ${WRITE_PREFIXES.join(', ')}, without query: other services are not written by NOVA`)
    }
    if (/forceDeletion|delete/i.test(path)) throw new Error('deletions are not done by NOVA')
    const body = o.body ?? readJson(o.file)
    if (body && typeof body === 'object' && 'projectId' in body && body.projectId !== project(ctx)) {
      throw new Error(`projectId must be the project of this development (${ctx.project})`)
    }
    return { method, path, body, what: `${method} ${path} (documented on the SAP Business Accelerator Hub)` }
  }
}

function readJson(file) {
  if (!file) throw new Error('--file is required')
  return JSON.parse(readFileSync(resolve(file), 'utf8'))
}

/** Counts of a JUnit XML report: the root <testsuites> if it has totals, otherwise the sum of <testsuite>. */
export function junitSummary(xml) {
  const attrs = tag => {
    const out = {}
    for (const m of tag.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]] = m[2]
    return out
  }
  const count = a => ({ tests: +(a.tests ?? 0), failures: +(a.failures ?? 0), errors: +(a.errors ?? 0), skipped: +(a.skipped ?? a.disabled ?? 0) })
  const root = xml.match(/<testsuites\b[^>]*>/)
  if (root && /\btests="/.test(root[0])) return count(attrs(root[0]))
  const sum = { tests: 0, failures: 0, errors: 0, skipped: 0 }
  for (const m of xml.matchAll(/<testsuite\b[^>]*>/g)) {
    const c = count(attrs(m[0]))
    for (const k of Object.keys(sum)) sum[k] += c[k]
  }
  if (!sum.tests) throw new Error('no <testsuite tests="..."> in the JUnit report')
  return sum
}

export function ciEvidence(ctx, o) {
  const summary = junitSummary(o.xml ?? readFileSync(resolve(text(o.junit, '--junit', 4096)), 'utf8'))
  const failed = summary.failures + summary.errors
  const passed = summary.tests - failed - summary.skipped
  const day = (o.date ?? new Date().toISOString()).slice(0, 10)
  const name = `CI ${day}: ${passed}/${summary.tests} superati, ${failed} falliti, ${summary.skipped} saltati`
  const plan = [builders['add-feature-reference'](ctx, { uuid: o.feature, name, url: o['run-url'] })]
  if (o['test-case']) plan.push(builders['add-test-reference'](ctx, { 'test-case': o['test-case'], name, url: o['run-url'] }))
  return { plan, summary: { ...summary, passed, failed } }
}

export function planHash(plan) {
  const stable = plan.map(({ method, path, body }) => ({ method, path, body: body ?? null }))
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex').slice(0, 12)
}

// ---------------------------------------------------------------- output of a plan

function printPlan(plan, conf) {
  say(`Dry-run: ${plan.length} request(s). Nothing has been sent.`)
  say(`API base: ${conf.apiBase ?? '<CALM_API_BASE or https://<CALM_TENANT>.<CALM_REGION>.alm.cloud.sap/api>'}`)
  say(`Project: ${conf.project ?? '<CALM_PROJECT_ID>'}`)
  say('Auth: OAuth2 client credentials of the service key of the write instance (CALM_WRITE_SERVICE_KEY), Bearer ***')
  plan.forEach((r, i) => {
    say(`\n[${i + 1}] ${r.what}`)
    say(`    ${r.method} ${r.path}`)
    if (r.guard) say(`    before: GET ${r.guard.path} and check that it belongs to the project${r.guard.status ? ', show the current status' : ''}`)
    if (r.etag) say('    header: If-Match: <modifiedAt read just before>')
    if (r.body) say('    body:\n' + JSON.stringify(r.body, null, 2).replace(/^/gm, '      '))
  })
  say(`\nPlan hash: ${planHash(plan)}`)
}

// ---------------------------------------------------------------- HTTP

let token
let last = 0
async function call(conf, method, path, body, extraHeaders = {}, binary) {
  if (!conf.apiBase) fail('set CALM_TENANT and CALM_REGION (or CALM_API_BASE) in the environment', 2)
  const problem = keyProblem(conf)
  if (problem) fail(problem, 2)
  if (!token) {
    const res = await fetch(conf.tokenUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: conf.clientId, client_secret: conf.clientSecret }),
      signal: AbortSignal.timeout(30000)
    })
    if (res.status !== 200) fail(`token request refused (HTTP ${res.status}): check the binding of the write instance`, 2)
    token = (await res.json()).access_token
    if (!token) fail('the token response has no access_token', 2)
  }
  for (let attempt = 0; ; attempt++) {
    const wait = last + MIN_INTERVAL_MS - Date.now()
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    last = Date.now()
    const res = await fetch(conf.apiBase + path, {
      method,
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}`,
        ...(binary ? { 'Content-Type': binary.type, 'Content-Disposition': `attachment; filename="${binary.name.replace(/"/g, '')}"` }
          : body ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders },
      body: binary ? binary.content : body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60000)
    })
    if ((res.status === 429 || res.status === 503) && attempt === 0) {
      const after = Math.min(Number(res.headers.get('retry-after')) || 5, 30)
      say(`HTTP ${res.status}: waiting ${after} s (limit 500 requests per 5 seconds)`)
      await new Promise(r => setTimeout(r, after * 1000))
      continue
    }
    const raw = await res.text()
    let json
    try { json = raw ? JSON.parse(raw) : undefined } catch { json = undefined }
    return { status: res.status, json, raw }
  }
}

// ---------------------------------------------------------------- log

function logWrite(file, rows) {
  mkdirSync(dirname(file), { recursive: true })
  if (!existsSync(file)) {
    appendFileSync(file, '# SAP Cloud ALM: registro delle scritture\n\n' +
      'Scritto da `nova-calm-write` (scripts/calm.mjs). Nessun segreto: solo richiesta, esito, id e chi ha confermato. ' +
      'In Cloud ALM l\'autore risulta il client tecnico dell\'istanza di scrittura.\n\n' +
      '| Quando (UTC) | Progetto | Richiesta | Esito | Id | Display ID | Confermato da | Piano |\n|---|---|---|---|---|---|---|---|\n')
  }
  appendFileSync(file, rows.map(r => `| ${r.when} | ${r.project} | ${r.request} | ${r.result} | ${r.id} | ${r.displayId} | ${r.by} | ${r.hash} |`).join('\n') + '\n')
}

// ---------------------------------------------------------------- selftest

function selftest() {
  const checks = []
  const ok = (name, fn) => { try { fn(); checks.push(`ok   ${name}`) } catch (e) { checks.push(`FAIL ${name}: ${e.message}`) } }
  const refuses = fn => { try { fn() } catch { return } throw new Error('accepted') }
  const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`) }
  const ctx = { project: '11111111-1111-1111-1111-111111111111' }
  const U = '01234567-89ab-cdef-0123-456789abcdef'
  ok('requirement payload', () => eq(builders['create-requirement'](ctx, { title: 'R1' }),
    { method: 'POST', path: '/calm-tasks/v1/tasks', body: { projectId: ctx.project, title: 'R1', type: 'CALMREQU' }, what: 'create requirement "R1"' }))
  ok('user story type', () => eq(builders['create-user-story'](ctx, { title: 'U1' }).body.type, 'CALMUS'))
  ok('project task of a wave', () => eq([builders['create-task'](ctx, { title: 'Wave 1', 'external-id': 'w1' }).body.type,
    builders['create-task'](ctx, { title: 'Wave 1' }).what], ['CALMTASK', 'create project task "Wave 1"']))
  ok('no project refused', () => refuses(() => builders['create-requirement']({}, { title: 'R1' })))
  ok('task patch cannot move project', () => refuses(() => builders['update-task'](ctx, { id: U, body: { projectId: U } })))
  ok('test case other project refused', () => refuses(() => builders['create-test-case'](ctx, { body: { title: 't', projectId: U, scopeId: U } })))
  ok('test case patch fields', () => refuses(() => builders['update-test-case'](ctx, { uuid: U, body: { toActivities: [] } })))
  ok('Ready for Production refused', () => refuses(() => builders['set-feature-status'](ctx, { uuid: U, status: 'APPROVED_FOR_DEPLOYMENT' })))
  ok('Deployed refused', () => refuses(() => builders['set-feature-status'](ctx, { uuid: U, status: 'CONFIRMED' })))
  ok('feature status patch', () => eq(builders['set-feature-status'](ctx, { uuid: U, status: 'in_testing' }).body, { statusCode: 'IN_TESTING' }))
  ok('url with credentials refused', () => refuses(() => builders['add-feature-reference'](ctx, { uuid: U, name: 'x', url: 'https://u:p@ci.example.com/run/1' })))
  ok('request outside allowlist refused', () => refuses(() => builders.request(ctx, { method: 'POST', path: '/calm-landscape/v1/x', body: {} })))
  ok('request delete refused', () => refuses(() => builders.request(ctx, { method: 'DELETE', path: '/calm-tasks/v1/tasks/x', body: {} })))
  ok('junit totals', () => eq(junitSummary('<testsuites tests="10" failures="1" errors="1" skipped="2"><testsuite tests="10"/></testsuites>'),
    { tests: 10, failures: 1, errors: 1, skipped: 2 }))
  ok('junit sum of suites', () => eq(junitSummary('<testsuite tests="3" failures="0"/><testsuite tests="2" failures="1" skipped="1"/>'),
    { tests: 5, failures: 1, errors: 0, skipped: 1 }))
  ok('ci evidence', () => {
    const { plan } = ciEvidence(ctx, { feature: U, xml: '<testsuite tests="4" failures="1"/>', 'run-url': 'https://ci.example.com/run/7', date: '2026-09-30' })
    eq(plan[0].body, { parent_uuid: U, name: 'CI 2026-09-30: 3/4 superati, 1 falliti, 0 saltati', url: 'https://ci.example.com/run/7' })
  })
  ok('document payload', () => eq(builders['create-document'](ctx, { title: 'DF Ordini', type: 'FS', content: '<p>x</p>',
    'external-id': 'docs/deliverables/DF.docx', url: 'https://github.com/acme/orders' }).body,
  { title: 'DF Ordini', projectId: ctx.project, documentTypeCode: 'FS', content: '<p>x</p>',
    toExternalReferences: [{ externalReferenceId: 'docs/deliverables/DF.docx', name: 'NOVA', url: 'https://github.com/acme/orders' }] }))
  ok('document file upload', () => {
    const r = builders['upload-document-file'](ctx, { uuid: U, file: 'DF.docx', bytes: Buffer.from('abc') })
    eq([r.method, r.path, r.body.bytes, r.binary.type], ['PUT', `/calm-documents/v1/Documents/${U}/fileContent`, 3,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
  })
  ok('document file type refused', () => refuses(() => builders['upload-document-file'](ctx, { uuid: U, file: 'run.sh', bytes: Buffer.from('x') })))
  ok('document task assignment', () => eq(builders['assign-document-task'](ctx, { uuid: U, task: U }).body, { parent_uuid: U, id: U }))
  ok('task in a sprint and a release, with assignee', () => eq(builders['create-task'](ctx, { title: 'Wave 2', timebox: U, release: U,
    assignee: 'dev@example.com', due: '2026-12-01' }).body,
  { projectId: ctx.project, title: 'Wave 2', type: 'CALMTASK', timeboxId: U, releaseId: U, assigneeId: 'dev@example.com', dueDate: '2026-12-01' }))
  ok('bad due date refused', () => refuses(() => builders['create-task'](ctx, { title: 'x', due: '1/12/2026' })))
  ok('defect type', () => eq(builders['create-defect'](ctx, { title: 'D1' }).body.type, 'CALMDEF'))
  ok('task status', () => eq(builders['set-task-status'](ctx, { id: U, status: 'ciptkinp' }).body, { status: 'CIPTKINP' }))
  ok('approval for deployment refused', () => refuses(() => builders['set-task-status'](ctx, { id: U, status: 'CIPREQUINP', 'sub-status': 'APPROVED_FOR_DEPLOYMENT' })))
  ok('task comment', () => eq(builders['add-task-comment'](ctx, { id: U, text: '12/40 work items closed' }).path, `/calm-tasks/v1/tasks/${U}/comments`))
  ok('requirement to feature', () => eq(builders['assign-task-feature'](ctx, { id: U, feature: U }).body, { featureId: U }))
  ok('task relation', () => eq(builders['relate-tasks'](ctx, { id: U, to: U }).body, { type: '0', relationTaskId: U }))
  ok('feature in a release', () => eq(builders['create-feature'](ctx, { title: 'F', release: U, responsible: 'lead@example.com' }).body,
    { title: 'F', projectId: ctx.project, releaseId: U, responsibleId: 'lead@example.com' }))
  ok('development library element', () => eq(builders['create-development'](ctx, { title: 'Z orders', 'development-type': 'dev_custom_fiori_application',
    'external-id': 'nova:1234' }).body, { title: 'Z orders', developmentTypeCode: 'DEV_CUSTOM_FIORI_APPLICATION',
    toExternalReferences: [{ externalReferenceId: 'nova:1234', name: 'NOVA' }] }))
  ok('library request allowed', () => eq(builders.request(ctx, { method: 'PATCH', path: '/calm-crosslibrarydevelopments/v1/Developments/x', body: {} }).method, 'PATCH'))
  ok('service key as JSON', () => eq(settings({ CALM_WRITE_SERVICE_KEY: JSON.stringify({ endpoints: { Api: 'https://t.eu10.alm.cloud.sap/' },
    uaa: { clientid: 'cid-1', clientsecret: 'sec-1', url: 'https://t.authentication.eu10.hana.ondemand.com' } }) }),
  { apiBase: 'https://t.eu10.alm.cloud.sap/api', tokenUrl: 'https://t.authentication.eu10.hana.ondemand.com/oauth/token',
    clientId: 'cid-1', clientSecret: 'sec-1', keyApi: 'https://t.eu10.alm.cloud.sap/api', project: undefined }))
  // the client in separate variables of before is not read: it was never checked against the tenant (18/11/2026)
  const separate = settings({ CALM_TENANT: 't', CALM_REGION: 'eu10', CALM_WRITE_CLIENT_ID: 'cid-2', CALM_WRITE_CLIENT_SECRET: 'sec-2' })
  ok('no client in separate variables', () => eq([separate.clientId, separate.clientSecret, separate.tokenUrl], [undefined, undefined, undefined]))
  ok('without a key: the password of the tenant', () => eq(keyProblem(separate),
    'no key for the SAP Cloud ALM tenant t.eu10.alm.cloud.sap: in Nova WOLF the service key goes in the password ' +
    'nova-calm-write-key-t of SAP Credential Store; elsewhere put the service key of the write instance, as JSON, in CALM_WRITE_SERVICE_KEY'))
  ok('a key without endpoints.Api never asks for a token', () => eq(Boolean(keyProblem(settings({ CALM_TENANT: 't', CALM_REGION: 'eu10',
    CALM_WRITE_SERVICE_KEY: JSON.stringify({ uaa: { clientid: 'c', clientsecret: 's', url: 'https://t.authentication.eu10.hana.ondemand.com' } }) }))), true))
  ok('a whole key asks for a token', () => eq(keyProblem(settings({ CALM_WRITE_SERVICE_KEY: JSON.stringify({ endpoints: { Api: 'https://t.eu10.alm.cloud.sap/' },
    uaa: { clientid: 'c', clientsecret: 's', url: 'https://t.authentication.eu10.hana.ondemand.com' } }) })), null))
  // one key per tenant (product owner, 18/11/2026): a key of another tenant never writes
  const keyOf = host => ({ CALM_WRITE_SERVICE_KEY: JSON.stringify({ endpoints: { Api: `https://${host}/` }, uaa: { clientid: 'c', clientsecret: 's' } }) })
  ok('key of the tenant', () => eq(tenantProblem({ CALM_TENANT: 'r8ta', CALM_REGION: 'eu10', ...keyOf('r8ta.eu10.alm.cloud.sap') }), null))
  ok('key of another tenant refused', () => eq(tenantProblem({ CALM_TENANT: 'r8tb', CALM_REGION: 'eu10', ...keyOf('r8ta.eu10.alm.cloud.sap') }),
    'the key in CALM_WRITE_SERVICE_KEY is of the tenant r8ta.eu10.alm.cloud.sap, not of r8tb.eu10.alm.cloud.sap: ' +
    'in Nova WOLF the key of r8tb.eu10.alm.cloud.sap goes in the password nova-calm-write-key-r8tb of SAP Credential Store'))
  ok('API base checked too', () => eq(Boolean(tenantProblem({ CALM_API_BASE: 'https://r8tb.eu10.alm.cloud.sap/api', ...keyOf('r8ta.eu10.alm.cloud.sap') })), true))
  ok('no tenant named: the key says it', () => eq(tenantProblem(keyOf('r8ta.eu10.alm.cloud.sap')), null))
  ok('key name of a tenant', () => eq([keyNameOf('r8ta.eu10.alm.cloud.sap'), keyNameOf('Key2-Customer.eu20.alm.cloud.sap')],
    ['nova-calm-write-key-r8ta', 'nova-calm-write-key-key2-customer']))
  ok('service key masked', () => eq(masker({ CALM_WRITE_SERVICE_KEY: JSON.stringify({ clientid: 'cid-123', clientsecret: 'sec-456' }) })('cid-123 sec-456'), '*** ***'))
  ok('masking', () => eq(masker({ CALM_WRITE_SERVICE_KEY: JSON.stringify({ uaa: { clientid: 'cid-1234', clientsecret: 'abc-secret-xyz' } }) })(
    'a abc-secret-xyz Bearer eyJhbGciOiJIUzI1 "access_token":"t"'),
    'a *** Bearer *** "access_token":"***"'))
  // an autonomous run of Nova WOLF: the key in a file of the run, named by NOVA_CALM_WRITE_FILE
  const folder = mkdtempSync(join(tmpdir(), 'calm-selftest-'))
  try {
    const file = join(folder, 'key.json')
    writeFileSync(file, JSON.stringify({ endpoints: { Api: 'https://r8ta.eu10.alm.cloud.sap' },
      uaa: { clientid: 'cid-file', clientsecret: 'sec-file-1', url: 'https://r8ta.authentication.eu10.hana.ondemand.com' } }) + '\n', { mode: 0o600 })
    const run = { CALM_TENANT: 'r8ta', CALM_REGION: 'eu10', NOVA_CALM_WRITE_FILE: file }
    ok('key from the file of the run', () => eq([settings(run).clientId, settings(run).apiBase, keyProblem(settings(run), run)],
      ['cid-file', 'https://r8ta.eu10.alm.cloud.sap/api', null]))
    ok('the variable wins on the file', () => eq(settings({ ...run, ...keyOf('r8ta.eu10.alm.cloud.sap') }).clientId, 'c'))
    ok('key of the file masked', () => eq(masker(run)('cid-file sec-file-1'), '*** ***'))
    ok('key of the file checked against the tenant', () => eq(tenantProblem({ ...run, CALM_TENANT: 'r8tb' }),
      'the key in CALM_WRITE_SERVICE_KEY is of the tenant r8ta.eu10.alm.cloud.sap, not of r8tb.eu10.alm.cloud.sap: ' +
      'in Nova WOLF the key of r8tb.eu10.alm.cloud.sap goes in the password nova-calm-write-key-r8tb of SAP Credential Store'))
    const gone = { ...run, NOVA_CALM_WRITE_FILE: join(folder, 'missing.json') }
    ok('a file that cannot be read gives no key, said with the name of the key', () => eq(keyProblem(settings(gone), gone),
      'the file of the key given by Nova WOLF (NOVA_CALM_WRITE_FILE) cannot be read or holds no key; no key for the SAP Cloud ALM ' +
      'tenant r8ta.eu10.alm.cloud.sap: in Nova WOLF the service key goes in the password nova-calm-write-key-r8ta of SAP Credential ' +
      'Store; elsewhere put the service key of the write instance, as JSON, in CALM_WRITE_SERVICE_KEY'))
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
  say(checks.join('\n'))
  if (checks.some(c => c.startsWith('FAIL'))) process.exit(1)
}

// ---------------------------------------------------------------- main

const HELP = readFileSync(new URL(import.meta.url)).toString().split('*/')[0].replace(/^#!.*\n\/\*\*\n?/, '').replace(/^ \* ?/gm, '')

const OPTIONS = {
  title: { type: 'string' }, description: { type: 'string' }, 'external-id': { type: 'string' }, id: { type: 'string' },
  uuid: { type: 'string' }, file: { type: 'string' }, name: { type: 'string' }, url: { type: 'string' }, 'test-case': { type: 'string' },
  priority: { type: 'string' }, scope: { type: 'string' }, status: { type: 'string' }, feature: { type: 'string' },
  junit: { type: 'string' }, 'run-url': { type: 'string' }, method: { type: 'string' }, path: { type: 'string' },
  type: { type: 'string' }, 'content-file': { type: 'string' }, task: { type: 'string' },
  timebox: { type: 'string' }, release: { type: 'string' }, assignee: { type: 'string' }, due: { type: 'string' },
  text: { type: 'string' }, to: { type: 'string' }, responsible: { type: 'string' }, 'sub-status': { type: 'string' },
  'development-type': { type: 'string' }, 'development-id': { type: 'string' },
  project: { type: 'string' }, apply: { type: 'boolean', default: false }, 'dry-run': { type: 'boolean', default: false },
  confirm: { type: 'string' }, 'confirmed-by': { type: 'string' }, repo: { type: 'string' }, log: { type: 'string' },
  help: { type: 'boolean', short: 'h' }
}

function build(command, ctx, o) {
  if (command === 'ci-evidence') {
    const { plan, summary } = ciEvidence(ctx, o)
    say(`JUnit: ${summary.tests} test, ${summary.passed} superati, ${summary.failed} falliti, ${summary.skipped} saltati`)
    return plan
  }
  if (command === 'batch') {
    const ops = readJson(o.file)
    if (!Array.isArray(ops) || !ops.length) throw new Error('the batch must be a non-empty array of { "command": ..., options }')
    return ops.flatMap(op => {
      if (op.command === 'batch') throw new Error('a batch cannot contain a batch')
      return build(op.command, ctx, op)
    })
  }
  const builder = builders[command]
  if (!builder) throw new Error(`unknown command ${command}: see "node calm.mjs help"`)
  return [builder(ctx, o)]
}

async function main(argv) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, strict: true, options: OPTIONS })
  const command = positionals[0] ?? 'help'
  if (values.help || command === 'help') return say(HELP)
  if (command === 'selftest') return selftest()

  const conf = settings()
  const ctx = { project: values.project ?? conf.project }
  conf.project = ctx.project
  const repo = resolve(values.repo ?? process.cwd())
  let plan
  try { plan = build(command, ctx, values) } catch (e) { fail(e.message) }

  printPlan(plan, conf)
  const hash = planHash(plan)
  if (!values.apply) {
    say('\nTo execute: show this plan to the user (and to whoever holds the role in the Cloud ALM project), get an explicit yes,\n' +
      `then run the same command with  --apply --confirm ${hash} --confirmed-by "<name, role>"`)
    return
  }
  if (values.confirm !== hash) fail(`--confirm must be the plan hash ${hash} of this exact plan`, 4)
  if (!values['confirmed-by']) fail('--confirmed-by "<name, role>" is required with --apply', 4)

  const logFile = resolve(values.log ?? join(repo, 'docs/alm/calm-log.md'))
  const rows = []
  try {
    for (const r of plan) {
      const headers = {}
      if (r.guard) {
        const cur = await call(conf, 'GET', r.guard.path)
        if (cur.status !== 200) throw new Error(`GET ${r.guard.path} -> HTTP ${cur.status}: not written`)
        const entity = cur.json?.value?.[0] ?? cur.json
        if (entity?.[r.guard.project] && entity[r.guard.project] !== ctx.project) {
          throw new Error(`${r.guard.path} belongs to project ${entity[r.guard.project]}, not to ${ctx.project}: not written`)
        }
        if (r.guard.status) say(`current status of ${r.guard.path}: ${entity?.[r.guard.status]}`)
        if (r.etag) headers['If-Match'] = entity?.modifiedAt
      }
      const res = await call(conf, r.method, r.path, r.binary ? undefined : r.body, headers, r.binary)
      const id = res.json?.id ?? res.json?.uuid ?? '-'
      rows.push({ when: new Date().toISOString(), project: ctx.project, request: `${r.method} ${r.path}`, result: `HTTP ${res.status}`,
        id, displayId: res.json?.displayId ?? '-', by: values['confirmed-by'].replace(/\|/g, '/'), hash })
      say(`${r.method} ${r.path} -> HTTP ${res.status}${id !== '-' ? ` id ${id}` : ''}${res.json?.displayId ? ` (${res.json.displayId})` : ''}`)
      if (res.status >= 300) {
        say(res.raw.slice(0, 2000))
        throw new Error(`HTTP ${res.status} on ${r.what}: stopped; the requests before it are in the log`)
      }
    }
  } finally {
    if (rows.length) { logWrite(logFile, rows); say(`Logged ${rows.length} row(s) in ${relative(repo, logFile) || logFile}`) }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch(e => fail(e.message))
}
