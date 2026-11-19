#!/usr/bin/env node
/**
 * Client of the NOVA configurator for the nova-wolf skill: the profile
 * questions, the creation of a development, its plan, and the installation of
 * its tools and playbook in the repository.
 *
 *   node nova-config.mjs types
 *   node nova-config.mjs profile <TYPE>
 *   node nova-config.mjs change                                              (what a change of an existing development asks)
 *   node nova-config.mjs systems [<TARGET>]                                   (the SAP systems, and how Nova ARC-1 reaches each one)
 *   node nova-config.mjs subaccounts [<TARGET>] [--purpose DEV|TEST|PROD|TRANSPORT]   (the SAP BTP landscape of the apps)
 *   node nova-config.mjs create --title <text> --type <TYPE> (--system <ID> | --target <TARGET> [--release <ID>])
 *                               [--description <text>] [--set <CHARACTERISTIC|element>=<value>]...
 *                               [--request <text> | --request-file <file>] [--add-request <text> | --add-request-file <file>]
 *                               [--owner <name>] [--document <title|link|KIND|note>]...
 *                               (a type whose work SAP describes, like the custom code programs, starts from its standard
 *                                request: --add-request adds what is specific, --request replaces it)
 *                               [--mode REVISION --objects <text> (--origin <ID> | --source <TARGET> [--source-release <ID>])
 *                                --level <KEEP|A|B> [--repository <git URL> [--ref <branch, tag or commit>]]]
 *                               [--work-repository <git URL> [--branch <main branch>]] [--set REPO_OWNER=COMPANY|CUSTOMER|PERSONAL]
 *                               [--team-repository <git URL> [--team-branch <branch>]]   (with a repository of the customer
 *                                or a personal one: where what may only be in a repository of the team goes)
 *                               [--set CONVERSION=BEFORE|CONVERTED|UPGRADE [--source-release <ID>]]   (where the system of an
 *                                adaptation program starts from: SAP ERP, SAP S/4HANA at the same release, or a release
 *                                upgrade from the lower release --source-release of the same system line)
 *                               [--from <ID of a wave>]   (a development derived from a unit of the wave: its system,
 *                                origin, rigor and owner by default)
 *   node nova-config.mjs edit <ID>                                            (a draft of a saved one)
 *   node nova-config.mjs set <ID> [--set <CHARACTERISTIC|element>=<value>]... [--request ... --add-request ... --owner ... --document ...]   (a draft)
 *     create and set also take the landscape of an app on SAP BTP: --subaccount <ID> --space <name>,
 *     --test-subaccount <ID> --test-space <name>, --prod-subaccount <ID> --prod-space <name>, --transport-subaccount <ID>
 *   node nova-config.mjs activate <ID>
 *   node nova-config.mjs close <ID> [--note <text>] [--give-back]             (read-only until reopened)
 *   node nova-config.mjs reopen <ID>
 *   node nova-config.mjs wave <PROGRAM> --title <t> [--packages <list>] [--objects <list>] [--focus CODE|UI5|PERFORMANCE|PRE_UPGRADE|POST_UPGRADE]
 *   node nova-config.mjs waves <PROGRAM> --file <waves.json> [--dry-run]   (the waves of a plan, created one after the other)
 *   node nova-config.mjs objects <PROGRAM|WAVE> [--file <objects.json|.txt> [--status <STATUS>]] [--export <file.json>]
 *                                                                             (the register of the objects, docs/10 7.3;
 *                                                                             --file also takes the result of «Nuove
 *                                                                             opportunità», docs/wolf/20)
 *   node nova-config.mjs opportunities <PROGRAM> --decide <decisions.json>  (the decisions of the team on «Nuove
 *                                                                             opportunità», with the credential of the
 *                                                                             decider, docs/wolf/20)
 *   node nova-config.mjs units <WAVE> --decide <approvals.json>             (the approval of the units of a refactoring
 *                                                                             wave by the team, CRW_APPROVE, with the
 *                                                                             credential of the decider, docs/wolf/23)
 *   node nova-config.mjs patterns <PROGRAM|WAVE> [--export <file.json>]      (the correction patterns and their objects)
 *   node nova-config.mjs volumes <PROGRAM|WAVE> [--export <file.json>]       (the volumes with their history)
 *
 * The two exports of the documentation of a custom code program (docs/wolf/18): program-docs.mjs and
 * program-diagrams.mjs read these files, the configurator writes them (srv/program-docs.js). A value nobody gave is
 * null.
 *
 *   patterns <WAVE> --export docs/patterns/patterns.json: the correction patterns used on the objects of the wave,
 *   each with the objects it corrected. One format with the runtime, which writes the same file from the same rows
 *   (wolf pattern-docs <WAVE>, runtime/src/pattern-docs.js): a pattern without a correction on the wave is not in the
 *   file, of the attempts on a finding only the last counts, one row of objects per correction; sorted by content
 *   (patterns by check, message, version, id; objects by type, name, line, outcome) and with nothing of the moment, so
 *   that the same data give the same file, byte for byte. Of a program: the same over all its objects, with "program"
 *   in the place of "wave".
 *   {
 *     "wave": { "id": "<UUID of the wave>", "title": "..." },
 *     "patterns": [{
 *       "id": "<UUID of the pattern>",
 *       "version": 2,
 *       "check": "<the ATC check of the finding group>",
 *       "message": "<the ATC message of the finding group>",
 *       "correction": "<the text of the correction: the rule of the pattern>",
 *       "writtenBy": "<who wrote it>",
 *       "decidedBy": "<who decided it>",
 *       "decidedAt": "<when, as the configurator gives it>",
 *       "objects": [{ "type": "CLAS", "name": "ZCL_X", "package": "ZSD_ORDINI", "line": 120,
 *                     "outcome": "QUEUED" | "PROPOSED" | "NOT_APPLICABLE" | "UNSURE" | "FAILED" | "EXCEPTION" | "OUTDATED" |
 *                                "APPLYING" | "APPLIED" | "VERIFIED" | "REVERTED" }]
 *     }]
 *   }
 *
 *   volumes <PROGRAM> --export docs/program/volumes.json: every measurement of the program and of its waves, one row
 *   each, as the configurator keeps them (DevelopmentVolumeHistory); "wave" is the title of the wave that measured
 *   it, null for the program. program-docs.mjs takes the «before» of a KPI from the first value of the program and the
 *   «after» from its last, only when the measure was taken again. Sorted by content (measuredAt, wave, measure).
 *   Of a wave: its program, the wave alone and its own measurements.
 *   {
 *     "program": { "title": "...", "type": "CC_S4_PROGRAM" | "CC_REFACTOR_PROGRAM" },
 *     "waves": [{ "title": "...", "folder": "waves/<name>", "state": "OPEN" | "CLOSED" }],
 *     "history": [{ "measure": "CC_LEVEL_A", "value": 10, "measuredAt": "<when, as the configurator gives it>",
 *                   "step": "CC_AS_IS_REPORT", "wave": null }]
 *   }
 *
 * NOVA_CONFIG_URL is the configurator (default http://localhost:4004);
 * NOVA_CONFIG_AUTHORIZATION the Authorization header, e.g. "Basic <base64>"
 * for the local users. Without it, a configurator over https (SAP BTP) is
 * reached with a browser login: no password on the PC (NOVA_CONFIG_LOGIN,
 * NOVA_CONFIG_LOGIN_CACHE, NOVA_CONFIG_BROWSER, NOVA_CONFIG_USER; see the login
 * block below). Only `login` signs in, or a command at a terminal: elsewhere a
 * command without a valid token stops at once and says to run `login`.
 * Node.js 22, no dependencies.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { appendFile, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync, openSync, readFileSync, realpathSync } from 'node:fs'
import { homedir, hostname, tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ---------------------------------------------------------------------------
// Browser login: the configurator on SAP BTP, without a password on the PC.
// The same block is in skills/nova-wolf/scripts/nova-config.mjs and in
// tools/skills-installer/install.mjs, each a single file without dependencies:
// keep the two identical. The other side is configurator/srv/cli-login.js.
// ---------------------------------------------------------------------------

/**
 * Where the tokens of the browser login stay between runs: a file of the user (~/.nova/config-login.json, 0600),
 * never the repository. NOVA_CONFIG_LOGIN_CACHE names another file, or "off" to keep them in memory only.
 */
export function loginCacheFile(env = process.env) {
  if (env.NOVA_CONFIG_LOGIN_CACHE === 'off') return null
  return env.NOVA_CONFIG_LOGIN_CACHE || join(homedir(), '.nova', 'config-login.json')
}

/** Whether a configurator is reached with the browser login: NOVA_CONFIG_LOGIN=browser or none, by default over https. */
export const wantsBrowserLogin = (base, env = process.env) =>
  env.NOVA_CONFIG_LOGIN ? env.NOVA_CONFIG_LOGIN === 'browser' : /^https:\/\//i.test(base)

/** The verification code the confirmation page shows for a code: the same as configurator/srv/cli-login.js. */
export const loginPairingCode = code => {
  const hex = createHash('sha256').update(`nova-cli-pairing:${code}`).digest('hex').slice(0, 8).toUpperCase()
  return `${hex.slice(0, 4)}-${hex.slice(4)}`
}

/** Opens a URL in the default browser, if there is one; NOVA_CONFIG_BROWSER=none only prints it. */
function openInBrowser(url, env = process.env) {
  if (env.NOVA_CONFIG_BROWSER === 'none') return
  const [command, args] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]] : ['xdg-open', [url]]
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true, windowsHide: true })
    child.on('error', () => {})
    child.unref()
  } catch { /* the URL is printed anyway */ }
}

async function readLogins(file) {
  if (!file) return {}
  try {
    return JSON.parse(await readFile(file, 'utf8')) ?? {}
  } catch {
    return {}
  }
}

async function writeLogins(file, logins) {
  if (!file) return
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  await writeFile(file, JSON.stringify(logins, null, 2) + '\n', { mode: 0o600 })
  await chmod(file, 0o600)
}

/** Whether a person is at the command: a terminal on both sides. Claude Code runs the commands without one. */
export const atTerminal = () => Boolean(process.stdin.isTTY && process.stderr.isTTY)

/** The command that signs in to a configurator, for the messages. */
export const loginCommand = base => `node <skill>/scripts/nova-config.mjs login ${base}`

/**
 * A session on a configurator: { authorization, api, user, expiresAt }, api being where to send the requests (the
 * service on SAP BTP). The token of the last browser login while it is valid, with a minute to spare; otherwise a
 * new login, but only where someone can confirm it: the login command (`interactive`), or a command run at a
 * terminal. Anywhere else (a command of Claude Code, one in the background) it fails at once, with the command that
 * signs in, instead of waiting for a confirmation nobody sees. `fresh` skips the kept one. A token without an expiry
 * (a local configurator) is not kept.
 */
export async function loginSession(base, { fresh = false, interactive = atTerminal(), env = process.env,
  log = message => console.error(message), open = url => openInBrowser(url, env), confirm = atTerminal() ? askAtTerminal : null,
  timeout = 590000, interval = 2000, now = Date.now } = {}) {
  base = base.replace(/\/+$/, '')
  const file = loginCacheFile(env)
  const logins = await readLogins(file)
  const kept = logins[base]
  if (!fresh && kept?.authorization && Date.parse(kept.expiresAt) - 60000 > now()) return kept
  // an expired token with a refresh token still valid: renewed through the configurator, without the browser
  const renewed = fresh ? null : await renewLogin(base, kept, { now })
  if (renewed) {
    logins[base] = renewed
    await writeLogins(file, logins)
    return renewed
  }
  if (!interactive) {
    const why = !kept?.authorization ? `there is no login to ${base}`
      : fresh ? `the configurator no longer takes the login to ${base}`
        : `the login to ${base} expired${kept.expiresAt ? ` at ${kept.expiresAt}` : ''}`
    throw Object.assign(new Error(`${why}: sign in with ${loginCommand(base)}, then run the command again. The login ` +
      'prints the link to confirm in the browser and waits for it; NOVA_CONFIG_BROWSER=none prints the link without ' +
      'opening a browser'), { code: 'NOVA_LOGIN_REQUIRED' })
  }
  const login = await browserLogin(base, { log, open, timeout, interval, now })
  await checkIdentity(base, login.user, { env, confirm })
  const session = {
    authorization: login.authorization, api: String(login.api || base).replace(/\/+$/, ''),
    user: login.user ?? null, expiresAt: login.expiresAt ?? null,
    // on SAP BTP the configurator renews the login for days (configurator/srv/cli-refresh.js)
    ...(login.refreshToken ? { refreshToken: login.refreshToken, refreshExpiresAt: login.refreshExpiresAt ?? null } : {})
  }
  if (session.expiresAt) logins[base] = session
  else delete logins[base]
  if (session.expiresAt || kept) await writeLogins(file, logins)
  return session
}

/**
 * Renews a kept login whose access token expired, with its refresh token, through the configurator (/cli/refresh):
 * the access token of XSUAA lasts hours, the refresh token days (refreshExpiresAt). The renewed session, or null when
 * there is nothing to renew or the configurator refuses (expired, revoked): then the browser login is needed.
 */
export async function renewLogin(base, kept, { now = Date.now } = {}) {
  if (!kept?.refreshToken || !(Date.parse(kept.refreshExpiresAt) - 60000 > now())) return null
  try {
    const response = await fetch(`${base.replace(/\/+$/, '')}/cli/refresh`, {
      method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken: kept.refreshToken })
    })
    if (response.status !== 200) return null
    // an empty body or a page that is not JSON (the login page of the approuter, a configurator without /cli/refresh)
    // renews nothing: null, and the caller says the login expired, never a parse error
    const fresh = await response.json().catch(() => null)
    if (!fresh?.authorization || !(Date.parse(fresh.expiresAt) - 60000 > now())) return null
    return { ...kept, authorization: fresh.authorization, expiresAt: fresh.expiresAt,
      refreshToken: fresh.refreshToken || kept.refreshToken, api: String(fresh.api || kept.api || base).replace(/\/+$/, '') }
  } catch {
    return null
  }
}

/** Forgets the kept token of a configurator; true when there was one. */
export async function forgetLogin(base, env = process.env) {
  base = base.replace(/\/+$/, '')
  const file = loginCacheFile(env)
  const logins = await readLogins(file)
  if (!logins[base]) return false
  delete logins[base]
  await writeLogins(file, logins)
  return true
}

/**
 * Who the browser signed in: it signs in with the SAP session it already has, which may be someone else's. With
 * NOVA_CONFIG_USER (login --as) a login as anyone else is refused; at a terminal the person confirms who it is. A
 * refused login is not kept.
 */
async function checkIdentity(base, user, { env, confirm }) {
  const who = user ?? 'an unknown user'
  const again = 'sign out of SAP in that browser, or open the link in a private window, and sign in again'
  const expected = env.NOVA_CONFIG_USER?.trim()
  if (expected && String(user ?? '').toLowerCase() !== expected.toLowerCase())
    throw new Error(`the browser signed in to ${base} as ${who}, not as ${expected} (NOVA_CONFIG_USER): ${again}`)
  if (!expected && confirm && !(await confirm(`Signed in to ${base} as ${who}. Is that you? [y/N] `)))
    throw new Error(`the login as ${who} was not confirmed: ${again}`)
}

/** A yes or a no at the terminal: yes only when the answer says so. */
async function askAtTerminal(question) {
  const { createInterface } = await import('node:readline/promises')
  const terminal = createInterface({ input: process.stdin, output: process.stderr })
  try {
    return /^\s*(y|yes|s|si|sì)\s*$/i.test(await terminal.question(question))
  } finally {
    terminal.close()
  }
}

/**
 * The login itself: a verifier of 32 random bytes; its sha256 goes to the browser as the code, the verifier only
 * to /cli/token, which answers 202 until the user has confirmed in the browser, then the token, once.
 */
async function browserLogin(base, { log, open, timeout, interval, now }) {
  const verifier = randomBytes(32).toString('base64url')
  const code = createHash('sha256').update(verifier).digest('base64url')
  const url = `${base}/cli/authorize?code=${code}`
  log(`Sign in to the configurator in the browser and confirm there: ${url}\n` +
    `The page must show the verification code ${loginPairingCode(code)} and your SAP user: a browser signed in as ` +
    'someone else signs in as them, so open the link in a private window. Waiting for the confirmation, up to ten ' +
    `minutes (until ${new Date(now() + timeout).toISOString().slice(11, 16)} UTC)...`)
  await open(url)
  const deadline = now() + timeout
  while (now() < deadline) {
    let response
    try {
      response = await fetch(`${base}/cli/token`, {
        method: 'POST', redirect: 'manual',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ verifier })
      })
    } catch (error) {
      throw new Error(`the configurator is not reachable at ${base} (${error.cause?.code ?? error.message})`, { cause: error })
    }
    if (response.status === 200) {
      // an empty or unexpected body is not a login: said as such, never as a parse error
      const login = await response.json().catch(() => null)
      if (!login?.authorization) throw new Error(`the browser login failed: ${base}/cli/token answered HTTP 200 without a ` +
        'login (an empty or unexpected body): run the login command again')
      return login
    }
    if (response.status !== 202) throw new Error(`the browser login failed: ${base}/cli/token answered HTTP ${response.status}`)
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  throw new Error('the login was not confirmed in the browser in time: run the login command again ' +
    '(NOVA_CONFIG_BROWSER=none prints the link without opening a browser)')
}

export const LOCAL_CONFIGURATOR = 'http://localhost:4004'

/**
 * Where the configurator is: NOVA_CONFIG_URL; without it, the configurator on SAP BTP of the last browser login
 * (kept in the login file), so that a login once is enough; without either, the local one.
 */
export function configuratorUrl(env = process.env) {
  if (env.NOVA_CONFIG_URL) return env.NOVA_CONFIG_URL
  const file = loginCacheFile(env)
  let logins = {}
  try {
    if (file) logins = JSON.parse(readFileSync(file, 'utf8')) ?? {}
  } catch { /* no login kept */ }
  const [last] = Object.entries(logins).filter(([base]) => /^https:\/\//i.test(base))
    .sort(([, a], [, b]) => String(b?.expiresAt ?? '').localeCompare(String(a?.expiresAt ?? '')))
  return last?.[0] ?? LOCAL_CONFIGURATOR
}

/**
 * The client. A configurator over https (SAP BTP) is reached with the browser login, whose token goes to the service
 * the login names: NOVA_CONFIG_AUTHORIZATION, left in a shell profile or in .claude/settings.json from a local
 * configurator, is ignored there, since the approuter would only answer with its login page. A local configurator
 * takes NOVA_CONFIG_AUTHORIZATION (the mocked users). An `authorization` passed in is always sent (tests).
 * `login` passes options to loginSession (tests, NOVA_CONFIG_LOGIN).
 */
export function configurator({ url, authorization, language = process.env.NOVA_CONFIG_LANGUAGE ?? 'it', login = {}, extraHeaders } = {}) {
  // no address given, none in NOVA_CONFIG_URL and no login kept: the local configurator is a guess, and its errors
  // say how to reach the one on SAP BTP rather than asking for a password
  const guessed = !url && configuratorUrl(login.env) === LOCAL_CONFIGURATOR
  const base = (url ?? configuratorUrl(login.env)).replace(/\/+$/, '')
  const NOWHERE = 'NOVA_CONFIG_URL is not set and there is no kept login, so the client tried the local configurator ' +
    `${LOCAL_CONFIGURATOR}: for the configurator on SAP BTP run "node nova-config.mjs login https://<route of ` +
    'nova-config>" once, and the commands after it use that configurator (NOVA_CONFIG_AUTHORIZATION is only for a ' +
    'local configurator)'
  const headers = { Accept: 'application/json', 'Accept-Language': language }
  const browser = !authorization && wantsBrowserLogin(base, login.env)
  if (!browser) authorization ??= (login.env ?? process.env).NOVA_CONFIG_AUTHORIZATION
  let session = authorization ? { authorization, api: base } : browser ? null : { api: base }

  // a new login only where someone confirms it: the login command, or a command at a terminal (loginSession)
  const signIn = async (fresh = false, interactive = undefined) =>
    (session = await loginSession(base, { ...login, fresh, ...(interactive ? { interactive } : {}) }))

  async function request(method, path, body, retried = false, raw = false) {
    const { authorization: auth, api } = session ?? await signIn()
    const target = path.startsWith('/install/') || path.startsWith('/reports/') ? api + path : `${api}/odata/v4/config${path}`
    let response
    try {
      response = await fetch(target, {
        method,
        redirect: 'manual',
        // extraHeaders(method, path): headers of the caller for this request, e.g. the W3C traceparent of the runtime
        // (runtime/src/telemetry.js, off by default); never a credential
        headers: { ...headers, ...(extraHeaders?.(method, path) ?? {}), ...(auth ? { Authorization: auth } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined
      })
    } catch (error) {
      throw new Error(`the configurator is not reachable at ${api} (${error.cause?.code ?? error.message}): ` +
        (guessed ? NOWHERE : 'set NOVA_CONFIG_URL, or continue from the manifest already in the repository'),
      { cause: error })
    }
    // a file of the configurator (a report) is kept as bytes; everything else is read as text
    const bytes = Buffer.from(await response.arrayBuffer())
    const text = bytes.toString('utf8')
    // the approuter of SAP BTP answers a request without a valid session with its login page, HTTP 200 in HTML:
    // not an answer of the configurator, but a login to do
    const loginPage = response.ok && /text\/html/i.test(response.headers.get('content-type') ?? '')
    if (loginPage && browser && !retried) {
      await signIn(true)
      return request(method, path, body, true, raw)
    }
    if (loginPage) throw new Error(`the configurator answered with its login page (${api}): ` + (browser
      ? 'sign in again with the login command'
      : auth ? 'on SAP BTP NOVA_CONFIG_AUTHORIZATION is not accepted: unset it and sign in with the login command'
        : 'on SAP BTP sign in with the login command, or set NOVA_CONFIG_LOGIN=browser'))
    // a kept token the configurator no longer takes: a new login, once
    if (response.status === 401 && browser && !retried) {
      await signIn(true)
      return request(method, path, body, true, raw)
    }
    if (response.status === 401) throw new Error('the configurator refused the credentials: ' +
      (browser ? 'sign in again with the login command' : guessed && !auth ? NOWHERE
        : 'set NOVA_CONFIG_AUTHORIZATION to a user of the local configurator'))
    // a redirect is the login page of the approuter: the requests go to the service, with a token
    if (response.status >= 300 && response.status < 400)
      throw new Error(`the configurator answered with a redirect (${response.headers.get('location') ?? response.status}): ` +
        'on SAP BTP sign in with the login command, or set NOVA_CONFIG_LOGIN=browser')
    if (!response.ok) {
      let messages = [`HTTP ${response.status}`]
      try {
        const { error } = JSON.parse(text)
        messages = [error, ...(error.details ?? [])].filter(e => e?.message)
          .map(e => `${e.message}${e.target ? ` [${e.target.replace(/^in\//, '')}]` : ''}`)
        if (error.details?.length) messages.shift()
      } catch { /* not JSON */ }
      // a refusal of the role: the generic text of the service (Forbidden) says nothing of what to do
      if (response.status === 403 && messages.length === 1 && /^(Forbidden|HTTP 403)$/i.test(messages[0]))
        messages = [`the configurator refuses this to the signed-in user (HTTP 403, ${method} ${path.split('?')[0]}): it needs ` +
          'another role, for example a developer (NovaBuilder) or an administrator (NovaConfigAdmin); a technical user of ' +
          'the runtime reads only what its job needs']
      const failure = new Error(messages.join('\n'))
      failure.status = response.status
      throw failure
    }
    if (raw) return bytes
    // a read answered 200 with nothing: not an answer of the configurator, and never handed on as one
    if (!text && method === 'GET' && response.status === 200)
      throw Object.assign(new Error(`the configurator answered GET ${path} with an empty body (${api}): something unexpected, ` +
        'or a login that expired on the way; sign in again with the login command and run the command again'), { status: 200 })
    if (!text || !response.headers.get('content-type')?.includes('json')) return text
    // a body that says JSON and is not (cut short, a proxy): the configurator answered something unexpected
    try {
      return JSON.parse(text)
    } catch {
      throw Object.assign(new Error(`the configurator answered ${method} ${path} with HTTP ${response.status} and a body that is ` +
        `not JSON (${api}): something unexpected, not this command's error; run it again, and if it persists sign in again ` +
        'with the login command'), { status: response.status })
    }
  }
  const get = path => request('GET', path)
  const list = async path => (await get(path)).value
  const q = value => `'${String(value).replace(/'/g, "''")}'`

  return {
    base,
    get,
    request,

    /** A new browser login, kept for the next runs: who signed in and until when. */
    login: () => signIn(true, true),
    /** Forgets the kept token of this configurator. */
    logout: () => { session = browser ? null : session; return forgetLogin(base, login.env) },

    /** The development types, with the targets each one supports. */
    types: () => list('/DevelopmentTypes?$filter=IsActiveEntity eq true&$orderby=sequence' +
      '&$select=ID,name,family_code,coverage_code,description,waveType_ID&$expand=targets($select=target_ID,minVersion_ID)'),

    /** What a type asks, with the values it accepts, and its targets with their releases. */
    async profile(type) {
      const found = await get(`/DevelopmentTypes(ID=${q(type)},IsActiveEntity=true)?$select=ID,name,description,cleanCoreLevel,coverage_code,coverageNotes` +
        '&$expand=targets($select=target_ID,minVersion_ID)').catch(error => {
        if (error.status === 404) throw new Error(`there is no development type ${type}: the types command lists them`)
        throw error
      })
      // the questions from their own entity: the configurator words their conditions (conditionsText) there, not in an
      // $expand of the type
      found.characteristics = await list(`/TypeCharacteristics?$filter=IsActiveEntity eq true and type_ID eq ${q(found.ID)}` +
        '&$select=characteristic_code,usage_code,defaultValue,conditionsText')
      const codes = found.characteristics.map(c => c.characteristic_code)
      const [characteristics, values, targets] = await Promise.all([
        codes.length ? list(`/Characteristics?$filter=IsActiveEntity eq true and code in (${codes.map(q).join(',')})&$select=code,name,descr,element&$orderby=sequence`) : [],
        codes.length ? list(`/CharacteristicValues?$filter=IsActiveEntity eq true and characteristic_code in (${codes.map(q).join(',')})&$select=characteristic_code,code,name&$orderby=characteristic_code,sequence`) : [],
        list('/DeploymentTargets?$filter=IsActiveEntity eq true&$orderby=sequence&$select=ID,name,requiresVersion,platform_code,stack_code' +
          '&$expand=versions($select=ID,name,abapCloud,ui5Version,maintenanceEnd;$orderby=sequence)')
      ])
      const supported = new Map(found.targets.map(t => [t.target_ID, t]))
      return {
        type: found,
        questions: characteristics.map(c => ({
          ...c,
          ...found.characteristics.find(x => x.characteristic_code === c.code),
          values: values.filter(v => v.characteristic_code === c.code).map(v => ({ code: v.code, name: v.name }))
        })),
        targets: targets.filter(t => supported.has(t.ID)).map(t => ({ ...t, minVersion_ID: supported.get(t.ID).minVersion_ID }))
      }
    },

    /**
     * What the change of an existing development asks: the systems it can start
     * from, with their releases, the paths from the source to the target, and
     * the Clean Core levels with the targets that offer each one.
     */
    async change() {
      const [systems, paths, levels, restrictions] = await Promise.all([
        list('/DeploymentTargets?$filter=IsActiveEntity eq true&$orderby=sequence&$select=ID,name,requiresVersion' +
          '&$expand=versions($select=ID;$orderby=sequence)'),
        list("/CharacteristicValues?$filter=characteristic_code eq 'PATH'&$select=code,name,descr&$orderby=sequence"),
        list("/CharacteristicValues?$filter=characteristic_code eq 'CLEAN_CORE'&$select=code,name,descr&$orderby=sequence"),
        list("/ValueTargets?$filter=characteristic_code eq 'CLEAN_CORE'&$select=value,target_ID,minVersion_ID")
      ])
      // the targets of each level in the order of the systems
      const order = new Map(systems.map((t, n) => [t.ID, n]))
      const targetsOf = level => restrictions.filter(r => r.value === level.code)
        .sort((a, b) => (order.get(a.target_ID) ?? 99) - (order.get(b.target_ID) ?? 99))
      return { systems, paths, levels: levels.map(l => ({ ...l, targets: targetsOf(l) })) }
    },

    /** The SAP systems the admins keep, of a target or all of them, with how Nova ARC-1 reaches each one: never a credential. */
    systems: target => list(`/Systems?$filter=IsActiveEntity eq true${target ? ` and target_ID eq ${q(target)}` : ''}` +
      '&$select=ID,name,target_ID,version_ID,connection_code,writes,arc1Url,sapUrl,sapClient,connectionText&$orderby=target_ID,ID'),

    /** The SAP BTP subaccounts the admins keep, of a runtime and a landscape or all of them: never a credential. */
    subaccounts: (target, purpose) => list('/BtpSubaccounts?$filter=IsActiveEntity eq true' +
      (target ? ` and target_ID eq ${q(target)}` : '') + (purpose ? ` and purpose_code eq ${q(purpose.toUpperCase())}` : '') +
      '&$select=ID,name,purpose_code,target_ID,globalAccount,subaccountId,subdomain,region,cfApiUrl,cfOrg,kymaApiUrl,iasTenant,cloudAlmTenant' +
      '&$orderby=purpose_code,ID'),

    /** The field of Developments that holds a characteristic: BACKEND → backend. */
    async elementOf(key) {
      const [found] = await list(`/Characteristics?$filter=IsActiveEntity eq true and code eq ${q(key.toUpperCase())}&$select=code,element`)
      return found?.element ?? key
    },

    createDraft: title => request('POST', '/Developments', { title }),
    patch: (ID, data) => request('PATCH', `/Developments(ID=${ID},IsActiveEntity=false)`, data),
    activate: ID => request('POST', `/Developments(ID=${ID},IsActiveEntity=false)/ConfigService.draftActivate`, {}),
    edit: ID => request('POST', `/Developments(ID=${ID},IsActiveEntity=true)/ConfigService.draftEdit`, { PreserveChanges: true }),
    // a wave gives the objects with ATC findings still without a disposition back to its program, with the note as the reason
    close: (ID, note, giveBack = false) => request('POST', `/Developments(ID=${ID},IsActiveEntity=true)/ConfigService.close`,
      { note: note ?? null, ...(giveBack ? { giveBack: true } : {}) }),
    reopen: ID => request('POST', `/Developments(ID=${ID},IsActiveEntity=true)/ConfigService.reopen`, {}),
    /** A new wave of a saved program (docs/10): its packages, and the focus of a wave of the adaptation. */
    /** What a derived development takes from its wave (docs/10, section 5.4). */
    derivedFrom: ID => get(`/Developments(ID=${ID},IsActiveEntity=true)?$select=ID,title,family_code,system_ID,rigor_code,` +
      'functionalOwner,state_code'),
    /** The register of the objects of a program or a wave (docs/10, section 7.3): report, counters, every object. */
    reportObjects: async (ID, objects, status) => {
      const response = await request('POST', `/Developments(ID=${ID},IsActiveEntity=true)/ConfigService.reportObjects`,
        { objects, status: status ? status.toUpperCase() : null })
      return JSON.parse(response?.value ?? response)
    },
    /**
     * The decisions of the team on «Nuove opportunità», in bulk (CR_UPGRADE_APPROVE, docs/wolf/20): accepted only with
     * the credential of the decider, who decided is taken from it; returns { approved, rejected, forPerson, refused }.
     */
    decideOpportunities: async (ID, decisions) => {
      const response = await request('POST', `/Developments(ID=${ID},IsActiveEntity=true)/ConfigService.decideOpportunities`,
        { decisions })
      return JSON.parse(response?.value ?? response)
    },
    /**
     * The decisions of the team on the units of a refactoring wave, in bulk (CRW_APPROVE, docs/wolf/23): accepted only
     * with the credential of the decider; returns { approved, excluded, forPerson, refused }.
     */
    approveUnits: async (ID, decisions) => {
      const response = await request('POST', `/Developments(ID=${ID},IsActiveEntity=true)/ConfigService.approveUnits`, { decisions })
      return JSON.parse(response?.value ?? response)
    },
    objectCounters: ID => get(`/Developments(ID=${ID},IsActiveEntity=true)?$select=ID,title,isProgram,isWave,objectsTotal,` +
      'objectsDone,objectsRemaining,objectsToAnalyze,objectsToAdapt,objectsInWave,objectsAdapted,objectsNoChange,objectsExempt,' +
      'objectsRetired,objectsRetiring,objectsDonePercent'),
    async objectsOf(ID, wave) {
      const out = []
      for (let skip = 0; ; skip += 1000) {
        const page = await list(`/Developments(ID=${ID},IsActiveEntity=true)/${wave ? 'waveObjects' : 'objects'}` +
          '?$select=objectType,name,objectPackage,mainType,mainName,status_code,wave_ID,usage,dossier,findings,levelStart,levelNow,note,' +
          'modCategory,modProposal,modDecision_code,modOwner,modExpiry,opportunity,opportunityLowPd,opportunityHighPd,' +
          'opportunityEvidence,opportunityDecision,opportunityDecider_code,opportunityDecidedBy' +
          `&$orderby=objectPackage,objectType,name&$top=1000&$skip=${skip}`)
        out.push(...page)
        if (page.length < 1000) return out
      }
    },
    /** The correction patterns of a program or a wave with the objects each one corrected (docs/wolf/18), as the configurator exports them. */
    // the status report of a program and the delivery sheet of a development (R4, S4): the bytes of one format
    report: (ID, document, format, query = '') => request('GET', `/reports/developments/${ID}/${document}.${format}${query}`, undefined, false, true),
    patternExport: async ID => JSON.parse((await get(`/Developments(ID=${ID},IsActiveEntity=true)/ConfigService.patternExport()`)).value),
    /** Every measurement of a program and of its waves, as the toolkit scripts read them (docs/wolf/18). */
    volumeExport: async ID => JSON.parse((await get(`/Developments(ID=${ID},IsActiveEntity=true)/ConfigService.volumeExport()`)).value),
    /** The waves of a program, oldest first, with who took each: what run-waves starts. */
    wavesOf: ID => list(`/Developments?$filter=program_ID eq ${ID} and IsActiveEntity eq true` +
      '&$select=ID,title,folder,state_code,takenBy,takenByMe&$orderby=createdAt'),
    /** One developer at a time on a wave (docs/10, section 5.5). */
    isWave: async ID => (await get(`/Developments(ID=${ID},IsActiveEntity=true)?$select=ID,isWave`)).isWave === true,
    /** Where a program, a wave or a development lives in SAP Cloud ALM (docs/10, section 7.5). */
    linkCloudAlm: (ID, link) => request('POST', `/Developments(ID=${ID},IsActiveEntity=true)/ConfigService.linkCloudAlm`,
      { project: link.project ?? null, task: link.task ?? null, feature: link.feature ?? null, tenant: link.tenant ?? null,
        requirement: link.requirement ?? null, release: link.release ?? null }),
    takeWave: ID => request('POST', `/Developments(ID=${ID},IsActiveEntity=true)/ConfigService.takeWave`, {}),
    leaveWave: ID => request('POST', `/Developments(ID=${ID},IsActiveEntity=true)/ConfigService.leaveWave`, {}),
    /**
     * The interactive session on a development (track W1): while it holds, no executor takes a run of it. Refused while
     * a run of it is taken by an executor, unless takeOver stops that run. Returns { holder, leaseUntil, stopped, queued }.
     */
    takeSession: async (ID, { host, takeOver } = {}) => JSON.parse((await request('POST',
      `/Developments(ID=${ID},IsActiveEntity=true)/ConfigService.takeSession`, { host: host ?? null, takeOver: Boolean(takeOver) })).value),
    leaveSession: async ID => JSON.parse((await request('POST', `/Developments(ID=${ID},IsActiveEntity=true)/ConfigService.leaveSession`, {})).value),
    /** The session on a development now and, on a program, the waves a run executor started while it held. */
    sessionStatus: async ID => JSON.parse((await request('GET', `/Developments(ID=${ID},IsActiveEntity=true)/ConfigService.sessionStatus()`)).value),
    newWave: (ID, title, packages, focus, objects) => request('POST', `/Developments(ID=${ID},IsActiveEntity=true)/ConfigService.newWave`,
      { title, packages: packages ?? null, ...(objects ? { objects } : {}), ...(focus ? { focus: focus.toUpperCase() } : {}) }),

    plan: ID => get(`/Developments(ID=${ID},IsActiveEntity=true)?$select=ID,title,mode_code,type_ID,target_ID,targetVersion_ID,` +
      'existingObjects,sourceRepository,sourceRef,sourceSystem_ID,sourceVersion_ID,revisionPath,cleanCoreTarget,planCalculatedAt,' +
      'manifestUrl,deviations,state_code,closedAt,closedBy,closingNote,' +
      'system_ID,originSystem_ID,connectionText,originConnectionText,delivery,alsoVersions,sensitiveAreas,' +
      'repository,repositoryBranch,repositoryOwner,teamRepository,teamRepositoryBranch' +
      '&$expand=categories($select=category_ID,applies,inScope,reason;$filter=applies eq true;$orderby=sequence),' +
      'choices($select=skill_ID,choice_code,category_ID,step,skip,reason,effect_code,effectText;$orderby=choice_code,step,skill_ID),' +
      'plan($select=skill_ID,category_ID,role_code,covers;$orderby=sequence,roleOrder,skill_ID),' +
      'steps($select=sequence,step,phase_code,title,kind_code,skill_ID,coverage_code,alternatives,challengers,fallbacks,challenge_code,' +
      'modelTier_code,reasoning_code,decider_code,authority,agent_code;' +
      '$orderby=sequence;' +
      '$expand=skill($select=kind_code,name))'),

    /** What the application must do: the request of a saved development, its functional owner and its documents. */
    /** The request of a draft as it stands (after the type, its standard request). */
    draftRequest: ID => get(`/Developments(ID=${ID},IsActiveEntity=false)?$select=ID,request`),
    /** How to run a saved development: the commands its configuration and its state ask for (slice 7b). */
    runGuide: async ID => JSON.parse((await get(`/Developments(ID=${ID},IsActiveEntity=true)/ConfigService.runGuide()`)).value),
    requestOf: ID => get(`/Developments(ID=${ID},IsActiveEntity=true)?$select=ID,title,description,request,functionalOwner` +
      '&$expand=documents($select=title,kind_code,link,note;$expand=kind($select=name);$orderby=kind_code,title)'),
    addDocument: (ID, document) => request('POST', `/Developments(ID=${ID},IsActiveEntity=false)/documents`, document),

    /** The choices of the developer on a draft: an entry left out of the plan, or one added from the catalog. */
    choicesOfDraft: ID => list(`/Developments(ID=${ID},IsActiveEntity=false)/choices?$select=ID,skill_ID,choice_code,step`),
    /** A function of a draft, by its code: its category, title, skill and the other candidates. */
    functionOfDraft: (ID, step) => list(`/Developments(ID=${ID},IsActiveEntity=false)/steps` +
      `?$select=category_ID,step,title,skill_ID,proposed_ID,alternatives&$filter=step eq '${step.replace(/'/g, "''")}'`),
    /** Whether an area of a draft is in the scope of the work, and why not: the service keeps the choice. */
    setScope: (ID, category, data) => request('PATCH', `/Developments(ID=${ID},IsActiveEntity=false)/categories(development_ID=${ID},` +
      `category_ID='${category.replace(/'/g, "''")}',IsActiveEntity=false)`, data),
    /** The skill of a function of a draft, where the developer sets it (none: by hand), and why: the service keeps the choice. */
    setFunction: (ID, row, data) => request('PATCH', `/Developments(ID=${ID},IsActiveEntity=false)/steps(development_ID=${ID},` +
      `category_ID='${row.category_ID.replace(/'/g, "''")}',step='${row.step.replace(/'/g, "''")}',IsActiveEntity=false)`, data),
    addChoice: (ID, choice) => request('POST', `/Developments(ID=${ID},IsActiveEntity=false)/choices`, choice),
    removeChoice: choice => request('DELETE', `/DevelopmentChoices(ID=${choice},IsActiveEntity=false)`),

    manifest: ID => request('GET', `/install/developments/${ID}/skills.manifest.json`),
    /** Every entry the catalog offers, to compare an installation with, outside any development. */
    catalogManifest: () => request('GET', '/install/catalog/skills.manifest.json'),
    installer: () => request('GET', '/install/install.mjs'),
    /** Sends the inventory of an installation (install.mjs inventory --output) to the configurator. */
    reportInventory: (ID, report) => request('POST', `/install/developments/${ID}/inventory`, report),
    /** Where the playbook of the project stands: the configurator shows it in the app Sviluppi. */
    reportProgress: (ID, report) => request('POST', `/install/developments/${ID}/progress`, report),
    /** The same, for the inventory against the whole catalog. */
    reportInstallation: report => request('POST', '/install/inventory', report),
    /** A function the development needs and no skill of the catalog covers: { step, text, sources }. */
    reportGap: (ID, gap) => request('POST', `/install/developments/${ID}/gaps`, gap),
    /** The gaps reported, of a development or of all of them, the newest first; only those not handled yet with open. */
    gaps: (ID, { open = false } = {}) => {
      const filters = [...(ID ? [`development_ID eq ${ID}`] : []), ...(open ? ['resolved ne true'] : [])]
      return list('/DevelopmentGaps?$select=ID,development_ID,step,text,sources,resolved,resolution,resolvedBy,resolvedAt,' +
        'createdAt,createdBy&$expand=development($select=title)&$orderby=createdAt desc' +
        (filters.length ? `&$filter=${filters.join(' and ')}` : ''))
    }
  }
}

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

// the landscape of an app on SAP BTP: an option of create and set for each field of the development
/**
 * The result of «Nuove opportunità» (P3, docs/wolf/20): the upgrade mode of sap-erp-clean-core-refactor, phase after
 * (kind clean-core-upgrade-assessment), as rows of the register of the objects, the existing import path of the step
 * (reportObjects). Null for any other JSON (an array of objects goes as it is). A result the skill refused
 * (research_required), or of the phase before, is refused here: it is not a proposal to import.
 */
export function opportunityRows(json) {
  if (!json || Array.isArray(json) || json.kind !== 'clean-core-upgrade-assessment') return null
  if (json.status !== 'resolved') throw new Error(`the result of the upgrade mode is ${json.status}: ${(json.conflicts ?? []).join(' ')} — complete the evidence, do not import it`)
  if (json.phase !== 'after') throw new Error('only the result of the phase after (Nuove opportunità) goes into the register; the phase before orders the waves (wave-plan.mjs --assessment)')
  const proposal = { A: 'A', B: 'B', stay: 'STAY' }
  return (json.units ?? []).map(u => ({
    type: u.type, name: u.name, ...(u.package ? { package: u.package } : {}),
    ...(u.levelNow ? { levelNow: u.levelNow } : {}),
    opportunity: proposal[u.proposal] ?? u.proposal, release: json.targetRelease ?? undefined,
    ...(u.effort ? { effortLowPd: u.effort.lowPd, effortHighPd: u.effort.highPd } : {}),
    evidence: [u.rule, u.stayReason, ...(u.evidence ?? []),
      ...(u.successors ?? []).map(s => typeof s === 'string' ? s : [s.of, s.successor].filter(Boolean).join(' → '))]
      .filter(Boolean).join(' · ').slice(0, 500)
  }))
}

/**
 * The decisions of the team on «Nuove opportunità» (CR_UPGRADE_APPROVE, docs/wolf/20): an array of { type, name,
 * decision: APPROVED | REJECTED, evidence }, as the architect A-02 writes it in docs/program/upgrade-decisions.json.
 * Refused here when it is not one: nothing goes to the configurator.
 */
export function opportunityDecisions(json) {
  if (!Array.isArray(json) || !json.length) throw new Error('the decisions are a JSON array of {type, name, decision, evidence}, not empty')
  for (const row of json) {
    const label = `${row?.type ?? '?'} ${row?.name ?? '?'}`
    if (!row?.type || !row?.name) throw new Error(`every decision names its object (type and name): ${JSON.stringify(row).slice(0, 80)}`)
    if (!['APPROVED', 'REJECTED'].includes(String(row.decision).toUpperCase())) throw new Error(`${label}: the decision is APPROVED or REJECTED`)
    if (typeof row.evidence !== 'string' || !row.evidence.trim()) throw new Error(`${label}: every decision of the team says its evidence`)
  }
  return json.map(row => ({ type: row.type, name: row.name, decision: String(row.decision).toUpperCase(), evidence: row.evidence.trim() }))
}

/**
 * The decisions of the team on the units of a refactoring wave (CRW_APPROVE, docs/wolf/23): an array of { unit, objects,
 * decision: APPROVED | EXCLUDED, effortPd, targetLevel, evidence }, as the architect A-02 writes it in
 * docs/refactor-approvals.json. Refused here only when it is not one; a unit without its effort or its evidence goes to
 * the configurator, which leaves it to a person.
 */
export function unitDecisions(json) {
  if (!Array.isArray(json) || !json.length) throw new Error('the decisions are a JSON array of {unit, objects, decision, effortPd, targetLevel, evidence}, not empty')
  for (const row of json) {
    const objects = Array.isArray(row?.objects) ? row.objects : String(row?.objects ?? '').split(',').map(o => o.trim()).filter(Boolean)
    if (!row?.unit || !objects.length) throw new Error(`every decision names its unit and its objects: ${JSON.stringify(row).slice(0, 80)}`)
    if (!['APPROVED', 'EXCLUDED'].includes(String(row.decision).toUpperCase())) throw new Error(`${row.unit}: the decision is APPROVED or EXCLUDED`)
  }
  return json.map(row => ({ unit: row.unit, objects: row.objects, decision: String(row.decision).toUpperCase(), effortPd: row.effortPd ?? null,
    targetLevel: row.targetLevel ?? null, evidence: typeof row.evidence === 'string' ? row.evidence.trim() : row.evidence ?? null }))
}

/**
 * The authorization of the decider of the team (NovaWolfDecider), the only one the configurator takes the decisions of
 * the team with: on SAP BTP the client credentials of the instance nova-wolf-decider-auth, WOLF_DECIDER_TOKEN_URL,
 * WOLF_DECIDER_CLIENT_ID and WOLF_DECIDER_CLIENT_SECRET, the same variables as the runtime (wolf patterns). Null without
 * them: the usual login is used, and the configurator refuses a person (a person decides in the configurator).
 */
export async function deciderAuthorization(env = process.env, fetchImpl = fetch) {
  const { WOLF_DECIDER_TOKEN_URL: url, WOLF_DECIDER_CLIENT_ID: clientId, WOLF_DECIDER_CLIENT_SECRET: secret } = env
  if (!url || !clientId || !secret) return null
  const tokenUrl = /\/oauth\/token\/?$/.test(url) ? url : `${url.replace(/\/+$/, '')}/oauth/token`
  const response = await fetchImpl(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${secret}`).toString('base64') },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId }).toString()
  })
  if (!response.ok) throw new Error(`the token of the decider was refused (HTTP ${response.status}): check WOLF_DECIDER_CLIENT_ID ` +
    'and WOLF_DECIDER_CLIENT_SECRET (the key of the instance nova-wolf-decider-auth)')
  const body = await response.json().catch(() => null)
  if (!body?.access_token) throw new Error('the token endpoint of the decider answered without an access_token')
  return `Bearer ${body.access_token}`
}

export const LANDSCAPE_OPTIONS = {
  '--subaccount': 'btpSubaccount_ID', '--space': 'btpSpace', '--test-subaccount': 'btpTestSubaccount_ID',
  '--test-space': 'btpTestSpace', '--prod-subaccount': 'btpProdSubaccount_ID', '--prod-space': 'btpProdSpace',
  '--transport-subaccount': 'btpTransportSubaccount_ID',
  // the same app on the other runtime of SAP BTP, then its landscape there
  '--also-target': 'alsoTarget_ID', '--also-subaccount': 'btpAlsoSubaccount_ID', '--also-space': 'btpAlsoSpace',
  '--also-test-subaccount': 'btpAlsoTestSubaccount_ID', '--also-test-space': 'btpAlsoTestSpace',
  '--also-prod-subaccount': 'btpAlsoProdSubaccount_ID', '--also-prod-space': 'btpAlsoProdSpace'
}
/**
 * The git repository the development works in (--work-repository, https or ssh, without credentials) and its main
 * branch (--branch); whose it is goes with --set REPO_OWNER=COMPANY|CUSTOMER|PERSONAL. With a repository of the customer
 * or a personal one, the team repository (--team-repository, --team-branch) holds what may only be in a repository of
 * the team (decision of the product owner, 18/11/2026). The waves of a program inherit them.
 */
const workRepositoryFields = options => ({
  ...(options['work-repository'] ? { repository: options['work-repository'] } : {}),
  ...(options.branch ? { repositoryBranch: options.branch } : {}),
  ...(options['team-repository'] ? { teamRepository: options['team-repository'] } : {}),
  ...(options['team-branch'] ? { teamRepositoryBranch: options['team-branch'] } : {})
})

const landscapeFields = options => Object.fromEntries(Object.entries(LANDSCAPE_OPTIONS)
  .filter(([option]) => options[option.slice(2)] !== undefined).map(([option, field]) => [field, options[option.slice(2)]]))

export function parseArguments(argv) {
  const [command, ...rest] = argv
  const options = { command, set: [], document: [], sources: [] }
  for (let i = 0; i < rest.length; i++) {
    const argument = rest[i]
    if (argument === '--force') options.force = true
    else if (argument === '--take-over') options.takeOver = true
    else if (argument === '--catalog') options.catalog = true
    else if (argument === '--dry-run') options.dryRun = true
    else if (argument === '--launch') options.launch = true
    else if (argument === '--with-mcp') options.withMcp = true
    else if (argument === '--manual') options.manual = true
    else if (argument === '--skip') options.skip = true
    else if (argument === '--give-back') options.giveBack = true
    else if (argument === '--out-of-scope' || argument === '--in-scope') {
      if (rest[i + 1] === undefined) throw new Error(`${argument} needs the category, e.g. ${argument} C07`)
      options[argument === '--out-of-scope' ? 'outOfScope' : 'inScope'] = rest[++i]
    }
    else if (argument === '--reset') options.reset = true
    else if (argument === '--general') options.general = true
    else if (argument === '--open') options.open = true
    else if (argument === '--set') {
      const pair = rest[++i] ?? ''
      if (!pair.includes('=')) throw new Error(`--set needs <characteristic>=<value>, got "${pair}"`)
      options.set.push(pair)
    } else if (argument === '--document') {
      const spec = rest[++i] ?? ''
      if (!spec.split('|')[0]?.trim()) throw new Error(`--document needs <title>|<link or path>|<KIND>|<note>, got "${spec}"`)
      options.document.push(spec)
    } else if (['--title', '--type', '--target', '--release', '--description', '--project', '--mode', '--objects', '--repository', '--ref',
      '--work-repository', '--branch', '--team-repository', '--team-branch',
      '--source', '--source-release', '--level', '--request', '--request-file', '--add-request', '--add-request-file', '--owner', '--exclude', '--include', '--drop',
      '--reason', '--note', '--system', '--origin', '--function', '--skill', '--purpose', '--rigor', '--as', '--only', '--step', '--text',
      '--packages', '--focus', '--from', '--file', '--status', '--export', '--parallel', '--days', '--format', '--out', '--lang', '--permission-mode', '--calm-project',
      '--task', '--feature', '--model', '--reasoning', '--decider', '--tenant', '--requirement', '--decide',
      ...Object.keys(LANDSCAPE_OPTIONS)].includes(argument)) {
      if (rest[i + 1] === undefined) throw new Error(`${argument} needs a value`)
      options[argument.slice(2)] = rest[++i]
      // --source is the source system of a change, and a source of a gap: repeatable there
      if (argument === '--source') options.sources.push(options.source)
    } else if (!argument.startsWith('--') && !options.id) options.id = argument
    else throw new Error(`unknown argument ${argument}`)
  }
  return options
}

const DEVELOPMENT_ID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

const USAGE = `NOVA configurator client (NOVA_CONFIG_URL, NOVA_CONFIG_AUTHORIZATION or the browser login)

  node nova-config.mjs login [<https URL>] [--as <user>]
                                                  signs in through the browser (the configurator on SAP BTP):
                                                  it prints the link and the verification code, opens the
                                                  browser and waits for the confirmation; the token stays in
                                                  ~/.nova/config-login.json: 8 hours on SAP BTP, renewed
                                                  without the browser for 7 days (refresh token),
                                                  and the commands after it use that configurator, with no
                                                  NOVA_CONFIG_URL and never NOVA_CONFIG_AUTHORIZATION. --as
                                                  (or NOVA_CONFIG_USER): who must sign in, since the browser
                                                  signs in with the SAP session it holds
  node nova-config.mjs logout                     forgets that token
  Only login signs in: another command without a valid token stops at once and says to run login (at a
  terminal it signs in there). NOVA_CONFIG_BROWSER=none prints the link without opening a browser;
  NOVA_CONFIG_LOGIN=none turns the browser login off; NOVA_CONFIG_LOGIN_CACHE moves the token file (off: memory).

  node nova-config.mjs types                      the development types
  node nova-config.mjs profile <TYPE>             questions, values and targets of a type
  node nova-config.mjs change                     what the change of an existing development asks
  node nova-config.mjs systems [<TARGET>]         the SAP systems, and how Nova ARC-1 reaches each one
  node nova-config.mjs subaccounts [<TARGET>] [--purpose DEV|TEST|PROD|TRANSPORT]
                                                  the SAP BTP subaccounts of the landscape, for an app on BTP_CF or BTP_KYMA
  node nova-config.mjs create --title <t> --type <TYPE> --system <ID> [--set <K>=<V>]...
         or, without a system of the registry: --target <TARGET> [--release <ID>] (Nova ARC-1 from the environment)
         what the application must do: --request <text> or --request-file <file>, --owner <functional owner>,
                                       a custom code program starts from the standard request of its type:
                                       --add-request <text> or --add-request-file <file> adds to it,
                                       --document "<title>|<link or path>|<KIND>|<note>" (repeatable)
         change of an existing development: --mode REVISION --objects <what> --level <KEEP|A|B>
                                            --origin <ID> (the system it runs on today) or --source <TARGET>
                                            [--source-release <ID>]
                                            [--repository <git URL of the code> --ref <where it starts from>]
         where the work is: --work-repository <git URL, https or ssh, no credentials> [--branch <main branch>]
                            whose it is: --set REPO_OWNER=COMPANY (default) | CUSTOMER | PERSONAL; the waves inherit it
                            with CUSTOMER or PERSONAL: --team-repository <git URL> [--team-branch <branch>], where
                            what may only be in a repository of the team goes (sap-clean-core-expert)
         an adaptation program to SAP S/4HANA (--type CC_S4_PROGRAM): where its system starts from,
                            --set CONVERSION=BEFORE (from SAP ERP, conversion) | CONVERTED (already SAP S/4HANA,
                            same release) | UPGRADE (release upgrade) --source-release <ID> (the lower release of
                            the same system line, e.g. S4_ONPREM-2021 for a system of S4_ONPREM-2023)
         derived from a unit of a wave of the custom code: --from <ID of the wave> (the system, the origin of the
                            objects, the rigor and the functional owner of the wave, unless given)
         an app on SAP BTP: --subaccount <ID> --space <name> (development), --test-subaccount/--test-space,
                            --prod-subaccount/--prod-space, --transport-subaccount <ID> (SAP Cloud Transport Management)
         the same app on the other runtime (Cloud Foundry and Kyma): --also-target <BTP_CF|BTP_KYMA>,
                            --also-subaccount/--also-space, --also-test-…, --also-prod-… (its landscape there)
  node nova-config.mjs edit <ID>                  a draft of a saved development, to change its profile
  node nova-config.mjs set <ID> [--set <K>=<V>]... [--system <ID>] [--origin <ID>] [--rigor QUICK|STANDARD|FULL] [--request… --owner… --document…]
                                                  (SENSITIVE_AREAS and ALSO_VERSIONS take several values, comma-separated:
                                                  --set SENSITIVE_AREAS=CRYPTO,LICENSE --set ALSO_VERSIONS=S4_PCE-2025)
                                                  answers on a draft
  node nova-config.mjs activate <ID>              saves the draft: the configurator checks it and resolves the plan
  node nova-config.mjs close <ID> [--note <text>] closes a saved development: it stays for reading, with no edit,
                                                  new plan or report of the installer until it is reopened. A wave
                                                  or a program closes only when every ATC finding has a disposition;
                                                  --give-back gives the objects of a wave with open findings back to
                                                  the program, with the note as the reason
  node nova-config.mjs reopen <ID>             opens a closed development again
  node nova-config.mjs wave <PROGRAM> --title <t> [--packages <list>] [--objects "<TYPE NAME (PACKAGE)>, ..."]
                         [--focus CODE|UI5|PERFORMANCE|PRE_UPGRADE|POST_UPGRADE]
                                                  a new wave of a saved custom code program: its packages and single
                                                  objects (CLAS ZCL_X (ZSD_ORDERS): the package in brackets when
                                                  known), in the perimeter of the program and in no other open wave;
                                                  its folder waves/<name> and its plan; --focus CODE, UI5 or
                                                  PERFORMANCE for the adaptation, PRE_UPGRADE or POST_UPGRADE (before
                                                  or after the upgrade) for a refactoring program with a release
                                                  upgrade (docs/wolf/20)
  node nova-config.mjs waves <PROGRAM> --file <waves.json> [--dry-run]
                                                  the waves of a plan (wave-plan.mjs, reviewed by the developer), one
                                                  after the other: [{"title", "packages", "objects", "focus"}]; it
                                                  stops at the first the configurator refuses. --dry-run only checks
                                                  the file and prints the waves
  node nova-config.mjs alm <PROGRAM|WAVE|DEVELOPMENT> [--tenant <https://...alm.cloud.sap>] [--calm-project <ID>]
                         [--requirement <ID>] [--release <ID>] [--task <ID>] [--feature <ID>]
                                                  where the program, the wave or the development (of a customer with
                                                  SAP Cloud ALM) lives in SAP Cloud ALM, as its steps created it: the
                                                  configurator shows them with links (docs/10, section 7.5)
  node nova-config.mjs take <ID> [--take-over]    you start working on a development, program or wave in Claude Code:
                                                  your session holds it (the progress reports of install.mjs renew it)
                                                  and no run of the API takes it meanwhile, a queued run waits. Refused
                                                  while a run of it is on an executor, with the run; --take-over stops
                                                  that run at its next report. A wave is also taken: one developer at a
                                                  time works on it (install takes it too); taken by another, it is
                                                  refused and says by whom
  node nova-config.mjs leave <ID>                 you stop: the queued runs go on, a wave is free for another developer
                                                  (an administrator frees any)
  node nova-config.mjs session <ID>               who holds it in Claude Code, until when; a session on a program does
                                                  not hold its waves: a run executor may still start them, and this
                                                  (like take and every progress report) says which one and when
  node nova-config.mjs run-waves <PROGRAM> [--project <root>] [--parallel <n>] [--launch] [--permission-mode <mode>]
                                                  the open waves of a program at the same time (docs/10, section 5.5),
                                                  those of the reader and the free ones, which it takes; the waves
                                                  of other developers it leaves to them:
                                                  each in its git worktree outside the repository (<root>-waves/<name>,
                                                  branch wave/<name>), installed there, with a Claude Code session of
                                                  its own (claude -p, or NOVA_CLAUDE) that follows the playbook until
                                                  the wave closes or a person must decide (docs/handoff.md). Up to
                                                  --parallel at a time (default 2); without --launch it only says
                                                  what it would do. Run it again to start the next waves
  node nova-config.mjs objects <PROGRAM|WAVE> [--file <objects.json|.txt>] [--status <STATUS>] [--export <file.json>]
                                                  the register of the objects of a program (docs/10, section 7.3):
                                                  --file reports objects (a JSON array of {type, name, package, status,
                                                  usage, dossier, findings, levelStart, levelNow, note, parts: ["PROG
                                                  ZREP_TOP", "TRAN ZREP"] or main: "PROG ZREP"}, or lines TYPE
                                                  NAME (PACKAGE) with --status); --export writes the register (of a
                                                  wave, its objects) as JSON; with neither, the counters. Statuses:
                                                  TO_ANALYZE, TO_ADAPT, IN_WAVE (from a wave), RETIRE_CANDIDATE,
                                                  ADAPTED, NO_CHANGE, EXEMPT, and RETIRED only after a person confirmed
                                                  the quarantine and the deletion in the configurator. --file also
                                                  takes the result of «Nuove opportunità» (CR_UPGRADE_OPPORTUNITIES,
                                                  resolve-upgrade.mjs of sap-erp-clean-core-refactor, phase after):
                                                  each object gets its proposal (A, B or STAY), the release, the
                                                  effort and the evidence; a report never decides them
  node nova-config.mjs opportunities <PROGRAM> --decide <decisions.json>
                                                  the decisions of the team on «Nuove opportunità»
                                                  (CR_UPGRADE_APPROVE): a JSON array of {type, name, decision:
                                                  APPROVED|REJECTED, evidence}, written by the architect A-02. Taken
                                                  only with the credential of the decider (NovaWolfDecider: on SAP
                                                  BTP WOLF_DECIDER_TOKEN_URL, WOLF_DECIDER_CLIENT_ID and
                                                  WOLF_DECIDER_CLIENT_SECRET, with NOVA_CONFIG_URL); the
                                                  configurator records the team as who decided, and leaves to a
                                                  person the exceptions (starts from level D, effort above the
                                                  threshold, sensitive area) and what the team does not decide
  node nova-config.mjs units <WAVE> --decide <approvals.json>
                                                  the approval of the units of a refactoring wave by the team
                                                  (CRW_APPROVE): a JSON array of {unit, objects, decision:
                                                  APPROVED|EXCLUDED, effortPd, targetLevel, evidence}, written by
                                                  the architect A-02. Taken only with the credential of the decider,
                                                  as opportunities; every work item of an approved unit gets the
                                                  approval of the team (who and when), which counts for its gate;
                                                  the exceptions (level D without the target level, effort above
                                                  the threshold, missing data) wait for a person. In a session of
                                                  the run manager the request goes to the run manager, which sends
                                                  it with the credential of the decider
  node nova-config.mjs patterns <PROGRAM|WAVE> [--export <file.json>]
                                                  the correction patterns of the batch factory used on the objects
                                                  of a wave, each with the objects it corrected: the data of
                                                  docs/patterns/<pattern>.md (docs/wolf/18). --export writes them as
                                                  JSON, in the folder of the wave docs/patterns/patterns.json: the
                                                  same file wolf pattern-docs <WAVE> of the runtime writes (the shape
                                                  is at the top of this script); without it, a summary
  node nova-config.mjs volumes <PROGRAM|WAVE> [--export <file.json>]
                                                  every measurement of a program and of its waves, with the step
                                                  that took it: the data of the AS-IS document, of the final one
                                                  and of the diagrams (docs/wolf/18). --export writes them as JSON,
                                                  in the repository of the program docs/program/volumes.json (the
                                                  shape is at the top of this script); without it, the first and
                                                  the last value of each measure of the program
  node nova-config.mjs report <PROGRAM> [--days <1-92>] [--format docx,pptx,pdf] [--out <folder>] [--lang it|en]
                                                  the status report of a program (R4): where it stands, what was done
                                                  in the last days (7 by default), costs, what is stuck, the decisions
                                                  waiting and the next steps, the same as the action of its page.
                                                  Formats: docx, pptx, pdf (the Word converted by LibreOffice, when
                                                  installed; else the page to print, .html), html, json (the data)
  node nova-config.mjs sheet <DEVELOPMENT> [--format docx,pptx,pdf] [--out <folder>] [--lang it|en]
                                                  the delivery sheet of a single development (S4): what was asked and
                                                  delivered, where it is, the checks, time and cost, what remains by
                                                  hand; it points to the deliverables of the documentation steps
  node nova-config.mjs plan <ID>                  categories, skills and steps of a saved development
  node nova-config.mjs request <ID>               what the application must do: request, functional owner, documents
  node nova-config.mjs guide <ID>                 how to run a saved development, a program or a wave: the commands its
                                                  configuration asks for, in order, by the engine of each phase (wolf
                                                  steps / wolf run on the Claude API, Claude Code) and by where the
                                                  work stands; the same as the tab How to run of the configurator
  node nova-config.mjs choose <ID> --exclude <entry> --reason <text>   on a draft: leave an entry out of the plan
  node nova-config.mjs choose <ID> --include <entry> --reason <text>   on a draft: add an entry of the catalog
  node nova-config.mjs choose <ID> --drop <entry>                  on a draft: remove the choice on an entry
  node nova-config.mjs choose <ID> --function <STEP> --skill <entry> --reason <text>
                                                  on a draft: another candidate for a function of the plan
  node nova-config.mjs choose <ID> --function <STEP> --manual --reason <text>   on a draft: do the function by hand
  node nova-config.mjs choose <ID> --function <STEP> [--model sonnet|opus|fable] [--reasoning medium|high|xhigh|max]
                       [--decider team|person] --reason <text>   on a draft: how the function runs and who decides it
  node nova-config.mjs choose <ID> --function <STEP> --skip [--reason <text>]   on a draft: do not do the function
                                                  in this development (a mandatory one is a deviation)
  node nova-config.mjs choose <ID> --out-of-scope <CATEGORY> [--reason <text>]  on a draft: leave an area out of the
                                                  scope of the work: its functions are not done
  node nova-config.mjs choose <ID> --in-scope <CATEGORY>          on a draft: the area back in scope
  node nova-config.mjs choose <ID> --function <STEP> --reset       on a draft: the function back to the configuration
                                                  (then activate <ID>; leaving out what the build needs is a deviation)
  node nova-config.mjs inventory <ID> [--project <dir>]           what your installation already has of the plan:
                                                  present, outdated or missing; reported to the configurator
  node nova-config.mjs progress <ID> [--project <dir>]            where the playbook of the project stands: reported to
                                                  the configurator, which shows it in the app Sviluppi
  node nova-config.mjs gap <ID> --step <STEP> --text "<what is missing and why>" [--source <url>]...
                                                  a function the development needs that no skill of the catalog
                                                  covers (SCENARIO_RESEARCH finds it MISSING): recorded on the
                                                  development for the admins of NOVA, with the step that found it
                                                  and the documentation that shows it (--source, repeatable)
  node nova-config.mjs gaps [<ID>] [--open]       the gaps reported, of a development or of all of them;
                                                  --open: only those the admins have not handled yet
  node nova-config.mjs inventory [--project <dir>]                what your installation has of the whole catalog,
                                                  and what it has outside it; reported to the configurator
  node nova-config.mjs install <ID> [--project <dir>] [--force]   tools and playbook into the repository
  node nova-config.mjs install --catalog [--only <method|category|id>[,...]] [--with-mcp] [--dry-run]
                                                  the whole catalog on this machine, in no repository: its skills,
                                                  commands and subagents in the plugin nova-catalog (~/.nova/catalog,
                                                  user scope, after the copies of each project), its plugins;
                                                  packages, system tools, account skills and MCP servers listed with
                                                  what to do (--with-mcp adds the servers that need no variable to
                                                  the user scope, where they start in every session). Then the
                                                  inventory of what loads in any folder, reported.
                                                  Run again, it updates what changed and removes what the catalog dropped
  node nova-config.mjs lessons <STEP> [--project <dir>]           the lessons of the developments for one step of the
                                                  playbook (references/lessons.md); --general: those for every step
Document kinds: SPEC, STORY, MOCKUP, PROCESS, DATA, TEST, TEMPLATE (the customer's Word template for DF and DT),
EXISTING (documentation of the existing development, to update), OTHER.`

async function answers(client, pairs) {
  const data = {}
  for (const pair of pairs) {
    const [key, ...value] = pair.split('=')
    data[await client.elementOf(key)] = value.join('=')
  }
  return data
}

/** The request fields of the options: the text (or the file that holds it) and the functional owner; and the rigor. */
async function requestFields(options) {
  const data = {}
  if (options.rigor !== undefined) {
    const rigor = options.rigor.toUpperCase()
    if (!['QUICK', 'STANDARD', 'FULL'].includes(rigor)) throw new Error('--rigor is QUICK, STANDARD or FULL')
    data.rigor_code = rigor
  }
  if (options['request-file']) data.request = await readFile(resolve(options['request-file']), 'utf8')
  else if (options.request !== undefined) data.request = options.request
  if (options.owner !== undefined) data.functionalOwner = options.owner
  return data
}

// "<title>|<link or path>|<KIND>|<note>": what the configurator stores of a document of the request
const documentOf = spec => {
  const [title, link, kind, note] = spec.split('|').map(part => part.trim())
  return { title, link: link || null, kind_code: (kind || 'SPEC').toUpperCase(), note: note || null }
}

async function addDocuments(client, ID, specs, log) {
  for (const spec of specs) {
    const document = documentOf(spec)
    await client.addDocument(ID, document)
    log(`  document ${document.kind_code}: ${document.title}${document.link ? ` (${document.link})` : ''}`)
  }
}

/** Answers one at a time, as the app sends them: each one can change which questions follow. */
async function patchInOrder(client, ID, data, log) {
  let row
  for (const [field, value] of Object.entries(data)) {
    row = await client.patch(ID, { [field]: value })
    // a long text, like the request, in one line
    const lines = String(value).trim().split('\n')
    log(`  ${field} = ${firstLine(value)}${lines.length > 1 ? ` (+${lines.length - 1} lines)` : ''}`)
  }
  return row
}

/**
 * What the developer adds to the request of a draft (--add-request, --add-request-file): appended to the request as it
 * stands, the standard request of the type for a custom code program, under its own heading.
 */
async function addToRequest(client, ID, options, log) {
  const added = options['add-request-file'] ? await readFile(resolve(options['add-request-file']), 'utf8') : options['add-request']
  if (added === undefined || !String(added).trim()) return
  const { request } = await client.draftRequest(ID)
  const text = [request?.trim(), String(added).trim()].filter(Boolean).join('\n\n')
  await client.patch(ID, { request: text })
  log(`  request + ${firstLine(added)}`)
}

async function saveAndReport(client, ID, log) {
  try {
    await client.activate(ID)
  } catch (error) {
    log(`The configurator did not accept the profile. Fix it with: set ${ID} --set <K>=<V>, then: activate ${ID}\n${error.message}`)
    return 1
  }
  log(`Development ${ID} saved: the configurator resolved its plan.`)
  return printPlan(client, ID, log)
}

async function printPlan(client, ID, log) {
  const d = await client.plan(ID)
  log(`${d.title} · ${d.type_ID} on ${d.target_ID}${d.targetVersion_ID ? ` (${d.targetVersion_ID})` : ''}` +
    `${d.alsoVersions ? `, also ${d.alsoVersions}` : ''}${d.delivery === 'PARTNER_ADDON' ? ' · partner add-on' : ''}` +
    `${d.sensitiveAreas ? ` · sensitive: ${d.sensitiveAreas}` : ''} · plan of ${d.planCalculatedAt}`)
  if (d.state_code === 'CLOSED')
    log(`Closed on ${d.closedAt} by ${d.closedBy}${d.closingNote ? `: ${firstLine(d.closingNote)}` : ''} · read-only, reopen ${ID} to go on`)
  const asked = await client.requestOf(ID)
  log(asked.request?.trim() || asked.documents.length
    ? `Request: ${firstLine(asked.request) || '(documents only)'}${asked.documents.length ? ` · ${asked.documents.length} document(s)` : ''}` +
      (asked.functionalOwner ? ` · functional owner ${asked.functionalOwner}` : '') + ` · in full: request ${ID}`
    : `Request: still empty. Write what the application must do: set ${ID} --request-file <file>, then activate ${ID}`)
  if (d.mode_code === 'REVISION')
    log(`Change of ${d.existingObjects} · from ${d.sourceSystem_ID}${d.sourceVersion_ID ? ` (${d.sourceVersion_ID})` : ''} · ` +
      `path ${d.revisionPath} · Clean Core target ${d.cleanCoreTarget}` +
      (d.sourceRepository ? `\nCode in ${d.sourceRepository}${d.sourceRef ? ` from ${d.sourceRef}` : ''}` : ''))
  // where the work is: the session runs in a clone of it
  if (d.repository) log(`Working repository ${d.repository}${d.repositoryBranch ? ` (${d.repositoryBranch})` : ''}` +
    `${d.repositoryOwner ? ` · ${d.repositoryOwner.toLowerCase()}` : ''}`)
  if (d.teamRepository) log(`Team repository ${d.teamRepository}${d.teamRepositoryBranch ? ` (${d.teamRepositoryBranch})` : ''}`)
  // how Nova ARC-1 reaches the systems: the team's Nova ARC-1 on SAP BTP, or Nova ARC-1 on this machine with the developer's variables
  if (d.system_ID) log(`SAP system ${d.system_ID}: ${d.connectionText}`)
  if (d.originSystem_ID) log(`Origin system ${d.originSystem_ID}: ${d.originConnectionText}`)
  log(`Categories that apply: ${d.categories.map(c => c.category_ID + (c.inScope === false ? ' (out of scope)' : '')).join(', ')}`)
  log(`Skills of the plan: ${new Set(d.plan.map(p => p.skill_ID)).size}`)
  if (d.choices?.length) {
    log(`Choices of the developer (${d.deviations ? `${d.deviations} deviation${d.deviations === 1 ? '' : 's'}` : 'no deviation'}):`)
    const what = c => c.choice_code === 'SCOPE' ? `out of scope ${c.category_ID}`
      : c.choice_code === 'FUNCTION' ? `function ${c.step}: ${c.skip ? 'not done'
        : c.skip === null ? `effort ${c.effort_code} (the plan decides whether it is done)` : c.skill_ID ?? 'by hand'}`
      : `${c.choice_code === 'EXCLUDE' ? 'left out' : 'added'} ${c.skill_ID}`
    for (const c of d.choices)
      log(`  ${what(c)} · ${c.effect_code ?? 'not applied yet'}${c.effectText ? ` (${c.effectText})` : ''}: ${firstLine(c.reason)}`)
  }
  // the functions, that is the steps in order: each with its skill, or done by hand; the other candidates can replace it
  const skipped = d.steps.filter(s => s.coverage_code === 'SKIPPED').length
  const byHand = d.steps.filter(s => !s.skill_ID && !['SKIPPED', 'TEAM', 'PERSON', 'TOOLKIT'].includes(s.coverage_code)).length
  log(`Functions: ${d.steps.length}${byHand ? `, ${byHand} by hand` : ''}${skipped ? `, ${skipped} not done` : ''}` +
    (d.steps.some(s => s.alternatives) ? ` (choose ${ID} --function <STEP> --skill <candidate> uses another candidate)` : ''))
  let phase
  for (const s of d.steps) {
    if (s.phase_code !== phase) log(`  ${phase = s.phase_code}`)
    // a command is called by its name, /<name>; a skill by its id
    const tool = s.skill?.kind_code === 'COMMAND' ? `/${s.skill.name}` : s.skill_ID
    const coverage = tool ? ` · ${tool}${s.coverage_code === 'CHOICE' ? ' (your choice)' : ''}`
      : s.coverage_code === 'SKIPPED' ? ' · not done (your choice)'
        : s.coverage_code === 'TEAM' ? ` · decided by ${s.authority ?? 'the team'}`
          : s.coverage_code === 'PERSON' ? " · a person's" : s.coverage_code === 'TOOLKIT' ? ' · NOVA toolkit'
            : ` · by hand${s.coverage_code === 'GAP' ? ' (no skill covers it yet)' : ''}`
    // the model and the reasoning it runs with (ADR-026)
    const model = s.modelTier_code ? ` · ${s.modelTier_code.toLowerCase()}${s.reasoning_code ? `/${s.reasoning_code.toLowerCase()}` : ''}` : ''
    // who reviews its output, and who does it when its skill cannot run
    const challenge = s.challengers ? ` · challenged by ${s.challengers}${s.challenge_code === 'REQUIRED' ? ' (required)' : ''}` : ''
    // the agent of the team that does it (docs/wolf/18): none, the Lead
    const agent = s.agent_code ? ` · done by ${s.agent_code}` : ''
    log(`    ${String(s.sequence).padStart(2)}. ${s.step} · ${s.title} · ${s.kind_code}${coverage}${agent}${model}` +
      (s.alternatives ? ` · other candidates: ${s.alternatives}` : '') + challenge +
      (s.fallbacks ? ` · fallback ${s.fallbacks}` : ''))
  }
  log(`Install it with: node nova-config.mjs install ${ID} --project <repository>`)
  return 0
}

// the first line that says something: the headings of a Markdown text (## Goal) are skipped
const firstLine = text => {
  const lines = String(text ?? '').trim().split('\n').map(line => line.trim()).filter(Boolean)
  return (lines.find(line => !line.startsWith('#')) ?? lines[0] ?? '').slice(0, 160)
}

/** The request of a saved development in full: what the application must do, who approves it, what to read. */
async function printRequest(client, ID, log) {
  const d = await client.requestOf(ID)
  log(`${d.title}${d.functionalOwner ? ` · functional owner: ${d.functionalOwner}` : ''}`)
  if (d.description) log(d.description)
  log('')
  log(d.request?.trim() || `(The request is empty: write it with set ${ID} --request-file <file>, then activate ${ID}.)`)
  if (d.documents.length) {
    log('\nDocuments:')
    for (const doc of d.documents)
      log(`  ${doc.kind?.name ?? doc.kind_code} · ${doc.title}${doc.link ? ` · ${doc.link}` : ''}${doc.note ? ` · ${doc.note}` : ''}`)
  }
  return 0
}

/** Downloads installer and manifest of a development into a temporary folder, and hands their paths to `use`. */
/**
 * Where a wave of a custom code program is installed: its folder (waves/<name>) under the current folder, when the
 * manifest is of a wave, --project is not given and the current folder is not already that folder. Null otherwise.
 */
/**
 * What run-waves does with each wave of a program (docs/10, section 5.5): `state(wave)` says whether its session runs,
 * whether it waits for a person (docs/handoff.md) and whether the wave is installed in its worktree. A closed wave is
 * done; up to `parallel` sessions run at a time, the waves after them wait. Each entry: the wave, its worktree and
 * branch, and its action: done, running, waiting, launch or queued.
 */
export function waveSessions(waves, { root, parallel = 2, state = () => ({}) }) {
  const slug = wave => String(wave.folder ?? '').replace(/^waves\//, '')
  const entries = waves.filter(w => w.folder).map(wave => ({
    wave, slug: slug(wave), branch: `wave/${slug(wave)}`, worktree: join(`${root}-waves`, slug(wave)), ...state(wave)
  }))
  let free = parallel - entries.filter(e => e.wave.state_code !== 'CLOSED' && e.running).length
  for (const entry of entries) {
    if (entry.wave.state_code === 'CLOSED') entry.action = 'done'
    // a wave another developer took is theirs: their sessions, on their machine
    else if (entry.wave.takenBy && entry.wave.takenByMe === false) entry.action = 'taken'
    else if (entry.running) entry.action = 'running'
    else if (entry.handoff) entry.action = 'waiting'
    else if (free > 0) { entry.action = 'launch'; free-- }
    else entry.action = 'queued'
  }
  return entries
}

/** The prompt of the session of a wave: the playbook of its folder, until the wave closes or a person must decide. */
export const wavePrompt = (wave, program) => `You are the session of the wave "${wave.title}" of the custom code program ` +
  `"${program}", in its own worktree. Follow the NOVA playbook of this folder (node .claude/nova/install.mjs next), step ` +
  'after step, from where it stands, until the wave is closed or a step needs a person (an approval, a choice, a ' +
  'confirmation, a database conversion): there stop, write in docs/handoff.md what is needed, from whom and why, and end. ' +
  'Change only the objects of the wave; commit on the branch of the wave, never push.'

export async function waveFolder(manifestPath, given, cwd) {
  if (given) return null
  const program = JSON.parse(await readFile(manifestPath, 'utf8')).development?.program
  if (program?.role !== 'WAVE' || !program.folder) return null
  if (cwd.split(sep).join('/').endsWith(`/${program.folder}`)) return null
  return { into: join(cwd, program.folder), folder: program.folder }
}

async function withInstaller(client, ID, use) {
  const dir = await mkdtemp(join(tmpdir(), 'nova-install-'))
  try {
    await writeFile(join(dir, 'install.mjs'), await client.installer())
    await writeFile(join(dir, 'skills.manifest.json'), JSON.stringify(await client.manifest(ID), null, 2))
    return await use({ dir, installer: join(dir, 'install.mjs'), manifest: join(dir, 'skills.manifest.json') })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/**
 * How the installation in use has the tools of a development: the installer
 * prints it, and its report goes to the configurator, which shows it in the
 * app Sviluppi. `required`: a failed report is an error, not a note.
 */
async function inventoryAndReport(client, ID, { installer, manifest, dir }, project, log, { required = true } = {}) {
  const output = join(dir, 'inventory.json')
  // after an install, apply has already printed what the installation lacks: only the report goes out
  const result = spawnSync(process.execPath, [installer, 'inventory', '--manifest', manifest, '--project', project,
    '--output', output], { stdio: required ? 'inherit' : 'ignore' })
  if (result.status !== 0) return result.status ?? 1
  try {
    const stored = await client.reportInventory(ID, JSON.parse(await readFile(output, 'utf8')))
    log(`Reported to the configurator as "${stored.installation}": ${stored.present} present, ${stored.outdated} to update, ` +
      `${stored.missing} missing, ${stored.unverified} to check.`)
    // the catalog follows the latest version: the next sync brings the installation to the configurator's pins
    if (stored.outdated > 0 && required)
      log(`To bring them to the configurator's pins: node nova-config.mjs install ${ID} --project ${project} (held entries stay at their pin).`)
    return 0
  } catch (error) {
    log(`The inventory was not reported to the configurator: ${error.message}`)
    return required ? 1 : 0
  }
}

/**
 * Where the playbook of the project stands, from its own progress.json and the
 * manifest it installed: the installer writes the report, the configurator
 * shows it in the app Sviluppi. `required`: a failed report is an error, not a note.
 */
async function progressAndReport(client, ID, { installer, dir }, project, log, { required = true } = {}) {
  const output = join(dir, 'progress.json')
  if (!existsSync(join(project, '.claude', 'nova', 'skills.manifest.json'))) {
    if (required) log(`No playbook to report in ${project}: install the development there first (install ${ID} --project <dir>).`)
    return required ? 1 : 0
  }
  const result = spawnSync(process.execPath, [installer, 'progress', '--project', project, '--output', output],
    { stdio: required ? 'inherit' : 'ignore' })
  if (result.status !== 0) return required ? result.status ?? 1 : 0
  try {
    const report = JSON.parse(await readFile(output, 'utf8'))
    // the playbook of the project is another development's: its steps never go out as this one's
    if (report.development !== ID) {
      log(`The progress was not reported to the configurator: the playbook in ${project} is the development ` +
        `${report.development ?? '(none)'}, not ${ID}. Install ${ID} there first (install ${ID} --project <dir>).`)
      return required ? 1 : 0
    }
    const stored = await client.reportProgress(ID, report)
    log(`Progress reported to the configurator: ${stored.closed} of ${stored.total} steps closed (${stored.percent}%).`)
    return 0
  } catch (error) {
    log(`The progress was not reported to the configurator: ${error.message}`)
    return required ? 1 : 0
  }
}

/** Downloads installer and catalog manifest into a temporary folder, and hands their paths to `use`. */
async function withCatalog(client, use) {
  const dir = await mkdtemp(join(tmpdir(), 'nova-catalog-'))
  try {
    await writeFile(join(dir, 'install.mjs'), await client.installer())
    await writeFile(join(dir, 'catalog.manifest.json'), JSON.stringify(await client.catalogManifest(), null, 2))
    return await use({ dir, installer: join(dir, 'install.mjs'), manifest: join(dir, 'catalog.manifest.json') })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** How the installation in use has the whole catalog: the installer prints it, the app La mia installazione shows it. */
async function catalogInventory(client, { installer, manifest, dir }, project, log) {
  const output = join(dir, 'inventory.json')
  const result = spawnSync(process.execPath, [installer, 'inventory', '--manifest', manifest, '--project', project,
    '--output', output], { stdio: 'inherit' })
  if (result.status !== 0) return result.status ?? 1
  try {
    const stored = await client.reportInstallation(JSON.parse(await readFile(output, 'utf8')))
    log(`Reported to the configurator as "${stored.installation}", against the whole catalog: ${stored.present} present, ` +
      `${stored.outdated} to update, ${stored.missing} not installed, ${stored.unverified} to check, ` +
      `${stored.extras} outside the catalog.`)
    if (stored.outdated > 0) log('To bring them to the configurator\'s pins: node nova-config.mjs install --catalog (held entries stay at their pin).')
    return 0
  } catch (error) {
    log(`The inventory was not reported to the configurator: ${error.message}`)
    return 1
  }
}

/**
 * The whole catalog on this machine (install.mjs catalog): the installer prints what it does entry by entry, then
 * the inventory against the catalog goes to the configurator, as inventory without a development does. A dry run
 * only prints, and reports nothing.
 */
async function installCatalog(client, files, options, log) {
  // the installer the configurator hands out is the one of its deployment: an older one has no catalog command
  if (!(await readFile(files.installer, 'utf8')).includes('export async function catalog(')) {
    log('The configurator hands out an installer without the catalog command: it must be deployed again first.')
    return 1
  }
  const result = spawnSync(process.execPath, [files.installer, 'catalog', '--manifest', files.manifest,
    ...(options.only ? ['--only', options.only] : []), ...(options.withMcp ? ['--with-mcp'] : []),
    ...(options.dryRun ? ['--dry-run'] : [])], { stdio: 'inherit' })
  if (options.dryRun) return result.status ?? 1
  // the installation as it is now, for the team: from a folder without a project, as the catalog run measured it,
  // so that the copies of the repository the command runs in do not count; a report that does not get through
  // does not fail the install
  const nowhere = await mkdtemp(join(tmpdir(), 'nova-nowhere-'))
  try {
    await catalogInventory(client, files, nowhere, log)
  } finally {
    await rm(nowhere, { recursive: true, force: true })
  }
  return result.status ?? 1
}

/** A choice of the developer on a function of the draft: another candidate, by hand, or not done; one per function. */
async function chooseFunction(client, options, log) {
  const step = options.function
  // how it runs (ADR-026): its model, its reasoning (never below medium), who decides it
  const run = { modelTier_code: options.model?.toUpperCase(), reasoning_code: options.reasoning?.toUpperCase(),
    decider_code: options.decider?.toUpperCase() }
  const runs = Object.values(run).some(Boolean)
  if (!options.id || (!options.skill && !options.manual && !options.skip && !options.reset && !runs))
    throw new Error('choose --function <STEP> needs --skill <entry>, --manual, --skip, --reset, or --model, --reasoning, --decider')
  // a family that runs a step: never Haiku, which only does research (track W12)
  if (run.modelTier_code && !['SONNET', 'OPUS', 'FABLE'].includes(run.modelTier_code)) throw new Error('--model is sonnet, opus or fable: haiku only does research')
  if (run.reasoning_code && !['MEDIUM', 'HIGH', 'XHIGH', 'MAX'].includes(run.reasoning_code))
    throw new Error('--reasoning is medium, high, xhigh or max: never below medium')
  if (run.decider_code && !['TEAM', 'PERSON'].includes(run.decider_code)) throw new Error('--decider is team or person')
  // a skip without a reason takes the default one of the configurator, as in the app
  if (!options.reset && !options.skip && !options.reason?.trim()) throw new Error('choose needs --reason: the team reads why')
  const [row] = await client.functionOfDraft(options.id, step)
  if (!row) throw new Error(`the draft has no function ${step}: see its functions with plan ${options.id}`)
  // a choice on a function without its function (written by earlier clients) keeps the draft from being saved
  for (const c of await client.choicesOfDraft(options.id))
    if (c.choice_code === 'FUNCTION' && !c.step) await client.removeChoice(c.ID)
  // the function is set where it is, as in the app: the service writes its FUNCTION choice, or removes it
  if (options.reset) {
    await client.setFunction(options.id, row, { skipped: false, skill_ID: row.proposed_ID ?? null, choiceReason: null })
    log(`${step} back to the configuration on the draft.`)
    return 0
  }
  const reason = options.reason?.trim() || null
  if (runs && !options.skill && !options.manual && !options.skip) {
    await client.setFunction(options.id, row, { ...Object.fromEntries(Object.entries(run).filter(([, v]) => v)), choiceReason: reason })
    log(`${step} · ${row.title}: ${[run.modelTier_code, run.reasoning_code, run.decider_code && `decided by ${run.decider_code.toLowerCase()}`]
      .filter(Boolean).join(', ')} on the draft: save it with activate ${options.id}.`)
    return 0
  }
  await client.setFunction(options.id, row, options.skip ? { skipped: true, choiceReason: reason }
    : { skipped: false, skill_ID: options.manual ? null : options.skill, choiceReason: reason })
  const how = options.skip ? 'not done' : options.manual ? 'by hand' : options.skill
  log(`${step} · ${row.title}: ${how} on the draft: save it with activate ${options.id}.`)
  return 0
}

/** An area of the draft out of the scope of the work, or back in it. */
async function chooseScope(client, options, log) {
  if (!options.id) throw new Error('choose needs the draft')
  if (options.outOfScope) {
    await client.setScope(options.id, options.outOfScope, { inScope: false, ...(options.reason?.trim() ? { scopeNote: options.reason.trim() } : {}) })
    log(`${options.outOfScope} out of the scope of the work on the draft: its functions are not done. Save it with activate ${options.id}.`)
  } else {
    await client.setScope(options.id, options.inScope, { inScope: true, scopeNote: null })
    log(`${options.inScope} back in the scope of the work on the draft: save it with activate ${options.id}.`)
  }
  return 0
}

/** A choice of the developer on the draft of a development: one per entry, so a new one replaces the old. */
async function choose(client, options, log) {
  if (options.outOfScope || options.inScope) return chooseScope(client, options, log)
  if (options.function) return chooseFunction(client, options, log)
  const [choice, skill] = options.exclude ? ['EXCLUDE', options.exclude] : options.include ? ['INCLUDE', options.include]
    : options.drop ? [null, options.drop] : []
  if (!options.id || !skill) throw new Error('choose needs the draft and --exclude <entry>, --include <entry> or --drop <entry>')
  if (choice && !options.reason?.trim()) throw new Error('choose needs --reason: the team reads why')
  const existing = (await client.choicesOfDraft(options.id)).filter(c => c.choice_code !== 'FUNCTION' && c.skill_ID === skill)
  for (const c of existing) await client.removeChoice(c.ID)
  if (!choice) {
    log(existing.length ? `Choice on ${skill} removed from the draft.` : `The draft has no choice on ${skill}.`)
    return 0
  }
  await client.addChoice(options.id, { skill_ID: skill, choice_code: choice, reason: options.reason.trim() })
  log(`${choice === 'EXCLUDE' ? 'Left out' : 'Added'} ${skill} on the draft: save it with activate ${options.id}.`)
  return 0
}

// ---------------------------------------------------------------------------
// The lessons of the developments, step by step
// ---------------------------------------------------------------------------

/** The lessons paid in the developments: references/lessons.md of this skill. */
export const LESSONS = fileURLToPath(new URL('../references/lessons.md', import.meta.url))

/**
 * The lessons of lessons.md, one per rule: its theme (the ## heading), its lines, and the steps it is for, from its
 * *Passi:* line: the step ids in backticks, a family as `CF_*`, the gates ("controlli bloccanti"), the challenged
 * steps ("ogni sfida"), or every step ("tutti"), which are the general lessons.
 */
export function parseLessons(text) {
  const lessons = []
  let theme = null
  let current = null
  for (const line of text.split('\n')) {
    const heading = line.match(/^##\s+(.+)$/)
    if (heading) [theme, current] = [heading[1].trim(), null]
    // a rule: a bullet in bold, under a theme; the lines above the first theme say how the file is written
    else if (theme && /^- \*\*/.test(line)) lessons.push(current = { theme, lines: [line] })
    else if (current && /^\s+\S/.test(line)) current.lines.push(line)
    else if (line.trim()) current = null
  }
  for (const lesson of lessons) {
    const steps = (lesson.lines.find(line => line.includes('*Passi:*')) ?? '').replace(/^.*\*Passi:\*/, '')
    lesson.steps = [...steps.matchAll(/`([A-Z0-9_]+\*?)`/g)].map(match => match[1])
    lesson.general = /^\s*tutti\.?\s*$/i.test(steps)
    lesson.gates = /controlli bloccanti/i.test(steps)
    lesson.challenged = /ogni sfida/i.test(steps)
  }
  return lessons
}

/** Whether a lesson is for a step of the playbook ({ id, kind, challengers }): by its id, its family, its kind. */
export const lessonFor = (lesson, step) =>
  lesson.steps.some(code => code.endsWith('*') ? step.id.startsWith(code.slice(0, -1)) : code === step.id) ||
  (lesson.gates && step.kind === 'GATE') || (lesson.challenged && Boolean(step.challengers?.length))

// the lessons by theme, as lessons.md writes them
const lessonsText = lessons => [...new Set(lessons.map(l => l.theme))]
  .flatMap(theme => ['', `## ${theme}`, '', ...lessons.filter(l => l.theme === theme).flatMap(l => l.lines)])

/**
 * The lessons of one step, so that the playbook reads before each step only the few that are for it, not the whole
 * file; with --general, the lessons for every step, read once per session. The step of the playbook of the project
 * (.claude/nova/skills.manifest.json) gives its kind and its challengers; without it the step is matched by its id.
 */
async function lessonsCommand(options, log) {
  const lessons = parseLessons(await readFile(LESSONS, 'utf8'))
  if (options.general || !options.id) {
    const general = lessons.filter(l => l.general)
    log([`General lessons (${general.length}), for every step: read them once per session.`, ...lessonsText(general)].join('\n'))
    return 0
  }
  const id = options.id.toUpperCase()
  let step = { id }
  try {
    const manifest = JSON.parse(await readFile(join(resolve(options.project ?? process.cwd()), '.claude/nova/skills.manifest.json'), 'utf8'))
    step = (manifest.playbook ?? []).find(s => s.id === id) ?? step
  } catch {
    // no installation in this folder: the step by its id
  }
  const found = lessons.filter(l => !l.general && lessonFor(l, step))
  log((found.length ? [`Lessons for ${id} (${found.length}): apply them in this step.`, ...lessonsText(found)]
    : [`No lesson is for ${id}.`]).concat('', 'The general lessons, for every step: lessons --general, once per session.').join('\n'))
  return 0
}

/** Whether the command line asks for the usage: help, --help or -h, anywhere. */
export const wantsHelp = argv => argv[0] === 'help' || argv.some(argument => argument === '--help' || argument === '-h')

/**
 * What a session of the run manager asks of the configurator, which it cannot reach (docs/wolf/23): the waves of a plan,
 * the link to SAP Cloud ALM, rows of the register. The runtime gives the session the file of its run (NOVA_RUN_ACTIONS):
 * the request goes there as a line of JSON, and the run manager sends it to the configurator after the session, which
 * does it only on the development of the run. Returns the request, or null for any other command (it runs as always).
 */
export async function deferredRequest(options) {
  const joined = value => Array.isArray(value) ? value.join(', ') : value ?? ''
  if (options.command === 'waves' && options.id && options.file && !options.dryRun) {
    const parsed = JSON.parse(await readFile(resolve(options.file), 'utf8'))
    const waves = Array.isArray(parsed) ? parsed : parsed?.waves
    if (!Array.isArray(waves) || !waves.length) throw new Error(`${options.file}: no waves (an array, or {"waves": [...]})`)
    for (const [n, w] of waves.entries())
      if (!w?.title || (!joined(w.packages) && !joined(w.objects))) throw new Error(`${options.file}: wave ${n + 1} needs a title and packages or objects`)
    return { action: 'WAVES', id: options.id, waves: waves.map(w => ({ title: w.title, packages: joined(w.packages) || null,
      objects: joined(w.objects) || null, focus: w.focus ?? null })) }
  }
  if (options.command === 'alm' && options.id) {
    const link = { project: options['calm-project'], task: options.task, feature: options.feature, tenant: options.tenant,
      requirement: options.requirement, release: options.release }
    if (!Object.values(link).some(Boolean)) return null
    return { action: 'ALM', id: options.id, ...Object.fromEntries(Object.entries(link).filter(([, v]) => v)) }
  }
  // the approval of the units by the team: the run manager sends it with the credential of the decider, never as the run
  if (options.command === 'units' && options.id && options.decide) {
    const decisions = unitDecisions(JSON.parse(await readFile(resolve(options.decide), 'utf8')))
    return { action: 'UNITS', id: options.id, decisions: JSON.stringify(decisions) }
  }
  if (options.command === 'objects' && options.id && options.file && !options.export) {
    let text = await readFile(resolve(options.file), 'utf8')
    let parsed = null
    try { parsed = JSON.parse(text) } catch { /* lines TYPE NAME (PACKAGE): as they are */ }
    const rows = opportunityRows(parsed)
    if (rows) text = JSON.stringify(rows)
    return { action: 'OBJECTS', id: options.id, objects: text, status: options.status ?? null }
  }
  return null
}

export async function main(argv, { log = console.log, client = configurator(), env = process.env } = {}) {
  if (wantsHelp(argv)) {
    log(USAGE)
    return 0
  }
  const options = parseArguments(argv)
  // a session of the run manager: what it asks of the configurator goes to the run manager (docs/wolf/23)
  const deferred = env.NOVA_RUN_ACTIONS ? await deferredRequest(options) : null
  if (deferred) {
    await mkdir(dirname(env.NOVA_RUN_ACTIONS), { recursive: true })
    await appendFile(env.NOVA_RUN_ACTIONS, JSON.stringify({ ...deferred, at: new Date().toISOString() }) + '\n')
    log(`${options.command} ${options.id}: recorded for the run manager, which sends it to the configurator after this session ` +
      '(a session of a run does not reach the configurator). It is in the log of the run.')
    return 0
  }
  switch (options.command) {
    case 'types': {
      const types = await client.types()
      // the type of a wave is not created with create: its program creates it (wave <program>)
      const programOf = new Map(types.filter(t => t.waveType_ID).map(t => [t.waveType_ID, t.ID]))
      for (const t of types)
        log(`${t.ID} · ${t.name} (${t.family_code}, catalog coverage ${t.coverage_code}) · ` + (programOf.has(t.ID)
          ? `a wave of a ${programOf.get(t.ID)} program: wave <program>, never create`
          : `targets: ${t.targets.map(x => x.target_ID + (x.minVersion_ID ? ` from ${x.minVersion_ID}` : '')).join(', ')}` +
            (t.waveType_ID ? ` · its waves: wave <program>` : '')))
      return 0
    }
    case 'profile': {
      if (!options.id) throw new Error('profile needs the type, e.g. profile FE_APP')
      const { type, questions, targets } = await client.profile(options.id)
      log(`${type.ID} · ${type.name}\n${type.description ?? ''}\nClean Core: ${type.cleanCoreLevel ?? '-'} · coverage ${type.coverage_code}` +
        (type.coverageNotes ? `: ${type.coverageNotes}` : ''))
      log('\nTargets (--target, and --release when the target asks for it):')
      for (const t of targets)
        log(`  ${t.ID} · ${t.name}${t.requiresVersion ? ` · releases: ${t.versions.map(v => v.ID).join(', ')}` : ''}` +
          (t.minVersion_ID ? ` · at least ${t.minVersion_ID}` : ''))
      log('\nQuestions (--set <characteristic>=<value>; FIXED ones are set by the type):')
      for (const c of questions)
        log(`  ${c.code} (${c.element}) · ${c.name} · ${c.usage_code}` + (c.defaultValue ? ` · default ${c.defaultValue}` : '') +
          (c.conditionsText ? ` · asked when: ${c.conditionsText}` : '') + `\n    values: ${c.values.map(v => `${v.code} (${v.name})`).join(', ')}`)
      return 0
    }
    case 'change': {
      const { systems, paths, levels } = await client.change()
      log('Change of an existing development: create --mode REVISION --objects <packages, objects, app or repository>')
      log('  --repository <git URL of the existing code> --ref <branch, tag or commit to start from>, when the code is in git;')
      log('  --source <SYSTEM> [--source-release <ID>] --level <KEEP|A|B>, with --type, --target and --release of the result.')
      log('\nSource systems (--source, and --source-release when the system asks for it):')
      for (const t of systems)
        log(`  ${t.ID} · ${t.name}${t.requiresVersion ? ` · releases: ${t.versions.map(v => v.ID).join(', ')}` : ''}`)
      log('\nPaths (set by the configurator from source and target):')
      for (const p of paths) log(`  ${p.code} · ${p.name}: ${p.descr}`)
      log('\nClean Core levels (--level):')
      for (const l of levels)
        log(`  ${l.code} · ${l.name}: ${l.descr}\n    targets: ` +
          (l.targets.length ? l.targets.map(t => t.target_ID + (t.minVersion_ID ? ` from ${t.minVersion_ID}` : '')).join(', ') : 'all'))
      return 0
    }
    case 'systems': {
      const systems = await client.systems(options.id)
      if (!systems.length) log(`No SAP system${options.id ? ` of ${options.id}` : ''} yet: the admins register them in the configurator (SAP systems).`)
      for (const s of systems)
        log(`${s.ID} · ${s.name} · ${s.target_ID}${s.version_ID ? ` (${s.version_ID})` : ''} · ${s.connection_code}` +
          `${s.writes === false ? ' · read only' : ''}\n  ${s.connectionText}`)
      return 0
    }
    case 'subaccounts': {
      if (options.purpose && !['DEV', 'TEST', 'PROD', 'TRANSPORT'].includes(options.purpose.toUpperCase()))
        throw new Error(`--purpose is DEV, TEST, PROD or TRANSPORT, not ${options.purpose}`)
      const subaccounts = await client.subaccounts(options.id, options.purpose)
      if (!subaccounts.length)
        log(`No SAP BTP subaccount${options.id ? ` of ${options.id}` : ''}${options.purpose ? ` for ${options.purpose.toUpperCase()}` : ''} yet: ` +
          'the admins register them in the configurator (SAP BTP landscape).')
      for (const s of subaccounts)
        log(`${s.ID} · ${s.name} · ${s.purpose_code}${s.target_ID ? ` · ${s.target_ID}` : ''} · ${s.region}` +
          `\n  subaccount ${s.subdomain ?? s.subaccountId} (${s.subaccountId})${s.globalAccount ? `, global account ${s.globalAccount}` : ''}` +
          (s.cfApiUrl ? `, Cloud Foundry ${s.cfApiUrl} org ${s.cfOrg ?? '?'}` : '') + (s.kymaApiUrl ? `, Kyma ${s.kymaApiUrl}` : '') +
          (s.iasTenant ? `, IAS ${s.iasTenant}` : '') + (s.cloudAlmTenant ? `, SAP Cloud ALM ${s.cloudAlmTenant}` : ''))
      return 0
    }
    case 'create': {
      for (const required of ['title', 'type'])
        if (!options[required]) throw new Error(`create needs --${required}`)
      // a single development derived from a unit of a wave (docs/10, section 5.4): what the options do not say comes
      // from the wave, the objects of the unit change on the system of the wave
      const from = options.from ? await client.derivedFrom(options.from) : null
      if (from) {
        if (from.family_code !== 'CUSTOM_CODE') throw new Error(`--from names ${from.title}, not a wave or a program of the custom code`)
        if (!options.target && !options.system && from.system_ID) options.system = from.system_ID
        if (options.objects && !options.mode) options.mode = 'REVISION'
        if (options.objects && !options.origin && !options.source && from.system_ID) options.origin = from.system_ID
        if (options.rigor === undefined && from.rigor_code) options.rigor = from.rigor_code
        if (options.owner === undefined && from.functionalOwner) options.owner = from.functionalOwner
      }
      // a wave has no life of its own: its program creates it
      const waveOf = (await client.types()).find(t => t.waveType_ID === options.type)
      if (waveOf) throw new Error(`${options.type} is the type of the waves of a ${waveOf.ID} program: create the program, then ` +
        `its waves with: wave <program> --title <title> --packages <packages>`)
      if (!options.target && !options.system) throw new Error('create needs --system, or --target without a system of the registry')
      const revision = (options.mode ?? 'NEW').toUpperCase() === 'REVISION'
      if (revision && !options.objects) throw new Error('the change of an existing development needs --objects')
      if (revision && !options.source && !options.origin)
        throw new Error('the change of an existing development needs --origin, or --source without a system of the registry')
      const draft = await client.createDraft(options.title)
      log(`Draft ${draft.ID}:`)
      const data = {
        ...(from ? { derivedFrom_ID: from.ID } : {}),
        ...(options.description ? { description: options.description } : {}),
        // what the application must do comes first: the profile follows from it
        ...await requestFields(options),
        // the mode first: it opens the questions of a change; the origin system sets the source and its release
        ...(revision ? { mode_code: 'REVISION', existingObjects: options.objects } : {}),
        ...(revision && options.repository ? { sourceRepository: options.repository } : {}),
        ...(revision && options.ref ? { sourceRef: options.ref } : {}),
        ...(revision && options.origin ? { originSystem_ID: options.origin } : {}),
        ...(revision && options.source ? { sourceSystem_ID: options.source } : {}),
        ...(revision && options['source-release'] ? { sourceVersion_ID: options['source-release'] } : {}),
        type_ID: options.type,
        // the system sets the target and its release
        ...(options.system ? { system_ID: options.system } : {}),
        ...(options.target ? { target_ID: options.target } : {}),
        ...(options.release ? { targetVersion_ID: options.release } : {}),
        ...(revision && options.level ? { cleanCoreTarget: options.level.toUpperCase() } : {}),
        ...workRepositoryFields(options),
        ...await answers(client, options.set),
        // a custom code program with a release upgrade (--set CONVERSION=UPGRADE, docs/wolf/20): the lower release its
        // system starts from, after the system and the answer that say where it starts from
        ...(!revision && options['source-release'] ? { sourceVersion_ID: options['source-release'] } : {}),
        // after the target: the landscape is asked of an app on SAP BTP
        ...landscapeFields(options)
      }
      await patchInOrder(client, draft.ID, data, log)
      await addToRequest(client, draft.ID, options, log)
      await addDocuments(client, draft.ID, options.document, log)
      return saveAndReport(client, draft.ID, log)
    }
    case 'edit':
      if (!options.id) throw new Error('edit needs the development')
      await client.edit(options.id)
      log(`Draft of ${options.id} open: change it with set ${options.id} --set <K>=<V>, then save it with activate ${options.id}.`)
      return 0
    case 'set': {
      const fields = {
        ...await requestFields(options),
        ...(options.origin ? { originSystem_ID: options.origin } : {}),
        ...(options.system ? { system_ID: options.system } : {}),
        ...(options.repository ? { sourceRepository: options.repository } : {}),
        ...(options.ref ? { sourceRef: options.ref } : {}),
        ...workRepositoryFields(options),
        ...landscapeFields(options)
      }
      const adds = options['add-request'] !== undefined || options['add-request-file'] !== undefined
      if (!options.id || (!options.set.length && !Object.keys(fields).length && !options.document.length && !adds))
        throw new Error('set needs the draft and at least one --set, --system, --origin, --repository, --ref, --work-repository, ' +
          '--branch, --team-repository, --team-branch, --subaccount, ' +
          '--space, --request, --request-file, --add-request, --add-request-file, --owner, --rigor or --document')
      await patchInOrder(client, options.id, { ...fields, ...await answers(client, options.set) }, log)
      await addToRequest(client, options.id, options, log)
      await addDocuments(client, options.id, options.document, log)
      return 0
    }
    case 'activate':
      if (!options.id) throw new Error('activate needs the development')
      return saveAndReport(client, options.id, log)
    case 'close': {
      if (!options.id) throw new Error('close needs the development')
      const closed = await client.close(options.id, options.note, options.giveBack)
      log(`${closed.title}: closed. It stays for reading; reopen ${options.id} to change it or report on it again.`)
      return 0
    }
    case 'wave': {
      // a wave of a custom code program: a part of its perimeter, in its folder of the repository of the program
      if (!options.id) throw new Error('wave needs the program')
      if (!options.title || (!options.packages && !options.objects))
        throw new Error('wave needs --title <title> and --packages <packages>, --objects "<TYPE NAME (PACKAGE)>, ..." or both')
      const wave = await client.newWave(options.id, options.title, options.packages, options.focus, options.objects)
      log(`Wave ${wave.ID} of the program ${options.id}: ${wave.title}, folder ${wave.folder}` +
        (wave.waveFocus ? `, focus ${wave.waveFocus}` : '') + `, ${wave.existingObjects ?? '-'}.`)
      await printPlan(client, wave.ID, log)
      log(`At the root of the repository of the program: node nova-config.mjs install ${wave.ID} (it goes into ${wave.folder}, ` +
        `on the branch wave/${String(wave.folder).replace(/^waves\//, '')}).`)
      return 0
    }
    case 'waves': {
      // the waves of a plan (docs/10, section 7.3): wave-plan.mjs proposes them, the developer reviews the file
      if (!options.id || !options.file) throw new Error('waves needs the program and --file <waves.json>')
      const parsed = JSON.parse(await readFile(resolve(options.file), 'utf8'))
      const waves = Array.isArray(parsed) ? parsed : parsed?.waves
      if (!Array.isArray(waves) || !waves.length) throw new Error(`${options.file}: no waves (an array, or {"waves": [...]})`)
      const joined = value => Array.isArray(value) ? value.join(', ') : value ?? ''
      for (const [n, w] of waves.entries())
        if (!w?.title || (!joined(w.packages) && !joined(w.objects)))
          throw new Error(`${options.file}: wave ${n + 1} needs a title and packages or objects`)
      if (options.dryRun) {
        for (const w of waves) log(`${w.title}: ${[joined(w.packages), joined(w.objects)].filter(Boolean).join(' · ')}` +
          (w.focus ? ` · focus ${w.focus}` : ''))
        log(`${waves.length} waves: nothing created (--dry-run).`)
        return 0
      }
      const created = []
      for (const w of waves) {
        try {
          const wave = await client.newWave(options.id, w.title, joined(w.packages) || null, w.focus, joined(w.objects) || null)
          created.push(wave)
          log(`Wave ${wave.ID}: ${wave.title}, folder ${wave.folder}.`)
        } catch (error) {
          log(`${w.title}: not created. ${error.message}`)
          log(`${created.length} of ${waves.length} waves created; fix the file and run waves again with the waves not created.`)
          return 1
        }
      }
      log(`${created.length} waves created. Each one: node nova-config.mjs install <ID of the wave> at the root of the repository.`)
      return 0
    }
    case 'objects': {
      // the register of the objects of a program or a wave (docs/10, section 7.3)
      if (!options.id) throw new Error('objects needs the program or the wave')
      const counters = row => `${row.objectsTotal} objects: ${row.objectsDone} done` +
        (row.objectsDonePercent !== null && row.objectsDonePercent !== undefined ? ` (${row.objectsDonePercent}%)` : '') +
        `, ${row.objectsRemaining} still to do · to analyze ${row.objectsToAnalyze}, to adapt ${row.objectsToAdapt}, ` +
        `in a wave ${row.objectsInWave}, adapted ${row.objectsAdapted}, no change ${row.objectsNoChange}, ` +
        `exempt ${row.objectsExempt}, in retirement ${row.objectsRetiring}, retired ${row.objectsRetired}`
      if (options.file) {
        let text = await readFile(resolve(options.file), 'utf8')
        // the result of «Nuove opportunità»: the proposals of the upgrade re-assessment, as rows of the register
        let parsed = null
        try { parsed = JSON.parse(text) } catch { /* lines TYPE NAME (PACKAGE): as they are */ }
        const rows = opportunityRows(parsed)
        if (rows) text = JSON.stringify(rows)
        const result = await client.reportObjects(options.id, text, options.status)
        log(`Register: ${result.added} objects added, ${result.updated} updated.` + (rows
          ? ` Nuove opportunità (${parsed.targetRelease}): re-read ${parsed.counts.reread}, to A ${parsed.counts.riseToA}, ` +
            `to B ${parsed.counts.riseToB}, stay ${parsed.counts.stay}; the team decides them (CR_UPGRADE_APPROVE, ` +
            'opportunities --decide), a person the exceptions.' : ''))
      }
      const row = await client.objectCounters(options.id)
      if (!row.isProgram && !row.isWave) throw new Error(`${row.title} is not a program or a wave of the custom code`)
      if (options.export) {
        const objects = await client.objectsOf(options.id, row.isWave)
        await writeFile(resolve(options.export), JSON.stringify(objects.map(o => ({
          type: o.objectType, name: o.name, package: o.objectPackage, ...(o.mainType ? { main: `${o.mainType} ${o.mainName}` } : {}),
          status: o.status_code, wave: o.wave_ID, usage: o.usage,
          dossier: o.dossier, findings: o.findings, levelStart: o.levelStart, levelNow: o.levelNow, note: o.note,
          // a modification of SAP code or an SAP Note (track W4): its category, the proposal and a person's decision, to
          // read: a report ignores `decided`, and refuses a `decision` (only a person decides, in the configurator)
          ...(o.modCategory || o.modProposal || o.modDecision_code ? { category: o.modCategory, proposal: o.modProposal,
            decided: o.modDecision_code, owner: o.modOwner, expiry: o.modExpiry } : {}),
          // a proposal of «Nuove opportunità» and its decision, to read: a report ignores opportunityDecided and refuses
          // an opportunityDecision (the team decides with opportunities --decide, a person in the configurator)
          ...(o.opportunity ? { opportunity: o.opportunity, effortLowPd: o.opportunityLowPd, effortHighPd: o.opportunityHighPd,
            evidence: o.opportunityEvidence, opportunityDecided: o.opportunityDecision, opportunityDecider: o.opportunityDecider_code,
            opportunityDecidedBy: o.opportunityDecidedBy } : {})
        })), null, 2) + '\n')
        log(`${objects.length} objects written to ${options.export}.`)
      }
      log(`${row.title}: ${counters(row)}.`)
      return 0
    }
    case 'opportunities': {
      // the decisions of the team on «Nuove opportunità» (CR_UPGRADE_APPROVE, docs/wolf/20): A-02 for the team, with the
      // credential of the decider; the configurator records who decided from it, and leaves the exceptions to a person
      if (!options.id) throw new Error('opportunities needs the program')
      if (!options.decide) throw new Error('opportunities needs --decide <decisions.json> (docs/program/upgrade-decisions.json)')
      let parsed
      try {
        parsed = JSON.parse(await readFile(resolve(options.decide), 'utf8'))
      } catch (error) {
        throw new Error(`${options.decide} cannot be read as JSON: ${error.message}`, { cause: error })
      }
      const decisions = opportunityDecisions(parsed)
      const authorization = await deciderAuthorization()
      if (authorization && !process.env.NOVA_CONFIG_URL)
        throw new Error('NOVA_CONFIG_URL (the service of the configurator) is required with the client credentials of the decider')
      const team = authorization ? configurator({ url: process.env.NOVA_CONFIG_URL, authorization }) : client
      const result = await team.decideOpportunities(options.id, JSON.stringify(decisions))
      log(`Decided by the team: ${result.approved} approved, ${result.rejected} rejected. Left to a person: ${result.forPerson}.`)
      for (const refused of result.refused) log(`  ${refused.object}: ${refused.message}`)
      return 0
    }
    case 'units': {
      // the approval of the units of a refactoring wave by the team (CRW_APPROVE, docs/wolf/23): A-02 for the team, with
      // the credential of the decider; the configurator records it on every work item of a unit, and leaves the
      // exceptions to a person
      if (!options.id) throw new Error('units needs the wave')
      if (!options.decide) throw new Error('units needs --decide <approvals.json> (docs/refactor-approvals.json)')
      let parsed
      try {
        parsed = JSON.parse(await readFile(resolve(options.decide), 'utf8'))
      } catch (error) {
        throw new Error(`${options.decide} cannot be read as JSON: ${error.message}`, { cause: error })
      }
      const decisions = unitDecisions(parsed)
      const authorization = await deciderAuthorization()
      if (authorization && !process.env.NOVA_CONFIG_URL)
        throw new Error('NOVA_CONFIG_URL (the service of the configurator) is required with the client credentials of the decider')
      const team = authorization ? configurator({ url: process.env.NOVA_CONFIG_URL, authorization }) : client
      const result = await team.approveUnits(options.id, JSON.stringify(decisions))
      log(`Units approved by the team: ${result.approved}, excluded: ${result.excluded}. Left to a person: ${result.forPerson}.`)
      for (const refused of result.refused) log(`  ${refused.unit}: ${refused.message}`)
      return 0
    }
    case 'report':
    case 'sheet': {
      // the two documents for who never opens the product (R4, S4): the files the service writes, as the one click does
      if (!options.id || !DEVELOPMENT_ID.test(options.id))
        throw new Error(`${options.command} needs the ID of the ${options.command === 'report' ? 'program' : 'development'}`)
      const document = options.command === 'report' ? 'status-report' : 'delivery-sheet'
      const formats = (options.format ?? 'docx,pptx,pdf').split(',').map(f => f.trim().toLowerCase()).filter(Boolean)
      const wrong = formats.filter(f => !['docx', 'pptx', 'pdf', 'html', 'json'].includes(f))
      if (wrong.length) throw new Error(`--format takes docx, pptx, pdf, html or json, not ${wrong.join(', ')}`)
      const query = new URLSearchParams({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(options.lang ? { lang: options.lang } : {}), ...(options.days ? { days: options.days } : {}) })
      const out = resolve(options.out ?? '.')
      await mkdir(out, { recursive: true })
      // the language, the title and the name of the files come with the data: one source for every format
      const data = JSON.parse((await client.report(options.id, document, 'json', `?${query}`)).toString('utf8'))
      // the same name as the download of the app (fileNameOf in configurator/srv/report-docs.js)
      const clean = value => String(value ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '').slice(0, 60)
      const base = `${clean(data.title)}_${clean(data.subject.title)}_${data.generatedAt.slice(0, 10)}`
      query.set('lang', data.lang)
      const written = []
      const save = async (format, bytes) => {
        const file = join(out, `${base}.${format}`)
        await writeFile(file, bytes)
        written.push(file)
        return file
      }
      for (const format of formats.filter(f => f !== 'pdf'))
        await save(format, format === 'json' ? JSON.stringify(data, null, 2) + '\n' : await client.report(options.id, document, format, `?${query}`))
      if (formats.includes('pdf')) {
        // the PDF as the documents of a program make it (program-docs.mjs deliver): the Word, converted by LibreOffice
        const word = join(out, `${base}.docx`)
        if (!existsSync(word)) await writeFile(word, await client.report(options.id, document, 'docx', `?${query}`))
        const work = await mkdtemp(join(tmpdir(), 'nova-report-'))
        const converted = spawnSync('soffice', [`-env:UserInstallation=file://${work}/lo`, '--headless', '--convert-to', 'pdf', '--outdir', out, word],
          { encoding: 'utf8', timeout: 300_000 })
        await rm(work, { recursive: true, force: true })
        if (!formats.includes('docx')) await rm(word, { force: true })
        if (converted.status === 0 && existsSync(join(out, `${base}.pdf`))) written.push(join(out, `${base}.pdf`))
        else {
          const page = await save('html', await client.report(options.id, document, 'html', `?${query}`))
          log(`PDF not made: LibreOffice (soffice) is ${converted.error ? 'not installed' : 'failing'}; ${page} is the page to print as PDF from a browser.`)
        }
      }
      log(`${data.title} · ${data.subject.title} · ${data.date}`)
      for (const file of written) log(`  ${file}`)
      return 0
    }
    case 'patterns': {
      // the correction patterns of the batch factory with their objects: the data of the documents of the patterns, in
      // the format of the runtime (wolf pattern-docs), byte for byte
      if (!options.id) throw new Error('patterns needs the wave (or the program)')
      const data = await client.patternExport(options.id)
      const of = data.wave ?? data.program
      const corrections = data.patterns.reduce((n, p) => n + p.objects.length, 0)
      if (options.export) {
        await writeFile(resolve(options.export), JSON.stringify(data, null, 2) + '\n')
        log(`${data.patterns.length} correction patterns written to ${options.export}.`)
      }
      log(`${of.title}: ${data.patterns.length} correction patterns` + (data.patterns.length ? `, ${corrections} corrections.` : '.'))
      for (const p of options.export ? [] : data.patterns)
        log(`  ${p.check ?? ''}: ${p.message ?? ''} · version ${p.version} · ${p.objects.length} corrections` +
          (p.decidedBy ? ` · decided by ${p.decidedBy}` : ''))
      return 0
    }
    case 'volumes': {
      // the volumes with their history: the data of the AS-IS document, of the final one and of the diagrams
      if (!options.id) throw new Error('volumes needs the program (or the wave)')
      const data = await client.volumeExport(options.id)
      const measures = new Set(data.history.map(h => h.measure))
      if (options.export) {
        await writeFile(resolve(options.export), JSON.stringify(data, null, 2) + '\n')
        log(`${data.history.length} measurements written to ${options.export}.`)
      }
      log(`${data.program.title}: ${data.history.length} measurements of ${measures.size} measures` +
        (data.waves.length ? `, ${data.waves.length} waves.` : '.'))
      // the first and the last value the program measured: the «before» and the «after» of its documents
      for (const measure of options.export ? [] : [...measures].sort()) {
        const own = data.history.filter(h => h.measure === measure && h.wave === null)
        if (own.length) log(`  ${measure}: ${own[0].value} (${own[0].step ?? 'no step'})` +
          (own.length > 1 ? ` → ${own.at(-1).value} (${own.at(-1).step ?? 'no step'})` : ', measured once'))
      }
      return 0
    }
    case 'run-waves': {
      // the waves of a program at the same time (docs/10, section 5.5): one worktree and one session per wave
      if (!options.id) throw new Error('run-waves needs the program')
      const root = resolve(options.project ?? process.cwd())
      const parallel = options.parallel === undefined ? 2 : Number(options.parallel)
      if (!Number.isInteger(parallel) || parallel < 1) throw new Error('--parallel is a whole number, at least 1')
      if (spawnSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).status !== 0)
        throw new Error(`${root} is not the repository of the program`)
      const program = await client.objectCounters(options.id)
      if (!program.isProgram) throw new Error(`${program.title} is not a custom code program`)
      const files = wave => {
        const into = join(`${root}-waves`, String(wave.folder).replace(/^waves\//, ''), ...String(wave.folder).split('/'))
        return { into, session: join(into, '.claude', 'nova', 'session.json'), handoff: join(into, 'docs', 'handoff.md'),
          manifest: join(into, '.claude', 'nova', 'skills.manifest.json') }
      }
      const alive = pid => { try { process.kill(pid, 0); return true } catch { return false } }
      const sessions = waveSessions(await client.wavesOf(options.id), {
        root, parallel, state: wave => {
          const f = files(wave)
          const session = existsSync(f.session) ? JSON.parse(readFileSync(f.session, 'utf8')) : null
          return { running: Boolean(session && alive(session.pid)), handoff: existsSync(f.handoff), installed: existsSync(f.manifest) }
        }
      })
      const claude = process.env.NOVA_CLAUDE ?? 'claude'
      for (const s of sessions) {
        const f = files(s.wave)
        const said = { done: 'closed', taken: `taken by ${s.wave.takenBy}`, running: 'its session runs', waiting: `waits for a person: ${f.handoff}`,
          queued: 'queued: run run-waves again when a session ends', launch: options.launch ? 'starting' : 'would start' }
        log(`${s.wave.title} · ${s.branch} · ${s.worktree} · ${said[s.action]}`)
        if (s.action !== 'launch' || !options.launch) continue
        // taken by the reader before the session starts: another developer cannot start it at the same time
        try {
          await client.takeWave(s.wave.ID)
        } catch (error) {
          log(`  not started: ${error.message}`)
          continue
        }
        // the worktree of the wave, on its branch, outside the repository of the program
        if (!existsSync(s.worktree)) {
          const known = spawnSync('git', ['-C', root, 'rev-parse', '--verify', '--quiet', s.branch]).status === 0
          const added = spawnSync('git', ['-C', root, 'worktree', 'add', s.worktree, ...(known ? [s.branch] : ['-b', s.branch])],
            { encoding: 'utf8' })
          if (added.status !== 0) { log(`  worktree not created: ${added.stderr.trim()}`); continue }
        }
        // the wave installed in its folder of the worktree, as from the root of the repository
        if (!existsSync(f.manifest)) {
          const installed = spawnSync(process.execPath, [fileURLToPath(import.meta.url), 'install', s.wave.ID], { cwd: s.worktree, stdio: 'inherit' })
          if (installed.status !== 0) { log('  not installed: the session does not start'); continue }
        }
        await mkdir(dirname(f.session), { recursive: true })
        const out = join(dirname(f.session), 'session.log')
        const fd = openSync(out, 'a')
        const child = spawn(claude, ['-p', wavePrompt(s.wave, program.title),
          ...(options['permission-mode'] ? ['--permission-mode', options['permission-mode']] : [])],
        { cwd: f.into, detached: true, stdio: ['ignore', fd, fd] })
        child.on('error', error => log(`  ${claude} did not start: ${error.message}`))
        child.unref()
        await writeFile(f.session, JSON.stringify({ pid: child.pid, startedAt: new Date().toISOString(), log: out }, null, 2) + '\n')
        log(`  session ${child.pid}, log ${out}`)
      }
      if (!options.launch) log('Nothing started: add --launch to start the waves marked "would start".')
      return 0
    }
    case 'alm': {
      // where a program, a wave or a development lives in SAP Cloud ALM: the tenant, the project, the requirement, the
      // release, the task and the feature its steps created or read
      if (!options.id) throw new Error('alm needs the program, the wave or the development')
      const link = { project: options['calm-project'], task: options.task, feature: options.feature, tenant: options.tenant,
        requirement: options.requirement, release: options.release }
      if (!Object.values(link).some(Boolean)) {
        throw new Error('alm needs --tenant, --calm-project, --requirement, --release, --task or --feature')
      }
      const row = await client.linkCloudAlm(options.id, link)
      log(`${row.title} in SAP Cloud ALM: ` + [row.calmTenant && `tenant ${row.calmTenant}`, row.calmProject && `project ${row.calmProject}`,
        row.calmRequirement && `requirement ${row.calmRequirement}`, row.calmRelease && `release ${row.calmRelease}`,
        row.calmTask && `task ${row.calmTask}`, row.calmFeature && `feature ${row.calmFeature}`].filter(Boolean).join(', ') + '.')
      return 0
    }
    case 'take':
    case 'leave': {
      if (!options.id) throw new Error(`${options.command} needs the development, program or wave`)
      // the interactive session first (track W1): a run of the API waits for it, and it never starts under a run
      if (options.command === 'take') {
        const session = await client.takeSession(options.id, { host: hostname(), takeOver: options.takeOver })
        log(`${options.id}: yours in Claude Code until ${session.leaseUntil}; no run of the API takes it meanwhile.`)
        if (session.stopped.length) log(`Stopped at their next report: run ${session.stopped.join(', ')}.`)
        if (session.queued.length) log(`Waiting for you in the queue: run ${session.queued.join(', ')} (it starts when you leave).`)
        // a program: the run executors still take its waves, and say so (decision of 12/11/2026)
        if (session.program) log('The waves of this program are not held by your session: a run executor may still start them, and you are told.')
        for (const notice of session.notices ?? []) log(`Note: ${notice.text}`)
      } else {
        const left = await client.leaveSession(options.id)
        // an administrator may end the session of someone else: say whose it was
        if (left.left) log(`${options.id}: the session in Claude Code${left.holder ? ` of ${left.holder}` : ''} is over; the queued runs go on.`)
        else if (!await client.isWave(options.id)) log(`${options.id}: nobody held it in Claude Code.`)
      }
      if (!await client.isWave(options.id)) return 0
      const wave = options.command === 'take' ? await client.takeWave(options.id) : await client.leaveWave(options.id)
      log(options.command === 'take' ? `${wave.title}: taken by ${wave.takenBy}.` : `${wave.title}: free, for another developer.`)
      return 0
    }
    case 'session': {
      if (!options.id) throw new Error('session needs the development, program or wave')
      const status = await client.sessionStatus(options.id)
      log(status.holder ? `${status.title}: ${status.mine ? 'your session' : `the session of ${status.holder}`} in Claude Code, until ${status.leaseUntil}.`
        : `${status.title}: nobody holds it in Claude Code.`)
      for (const notice of status.notices ?? []) log(`Note: ${notice.text}`)
      return 0
    }
    case 'reopen': {
      if (!options.id) throw new Error('reopen needs the development')
      const reopened = await client.reopen(options.id)
      log(`${reopened.title}: open again.`)
      return 0
    }
    case 'plan':
      if (!options.id) throw new Error('plan needs the development')
      return printPlan(client, options.id, log)
    case 'guide': {
      if (!options.id) throw new Error('guide needs the development, a program or a wave')
      const guide = await client.runGuide(options.id)
      log(`${guide.title}\n`)
      log(guide.text.trimEnd())
      return 0
    }
    case 'request':
      if (!options.id) throw new Error('request needs the development')
      return printRequest(client, options.id, log)
    case 'choose':
      return choose(client, options, log)
    case 'inventory': {
      const project = resolve(options.project ?? process.cwd())
      // without a development: the installation against the whole catalog
      if (!options.id) return withCatalog(client, files => catalogInventory(client, files, project, log))
      return withInstaller(client, options.id, files => inventoryAndReport(client, options.id, files, project, log))
    }
    case 'progress': {
      if (!options.id) throw new Error('progress needs the development')
      const project = resolve(options.project ?? process.cwd())
      return withInstaller(client, options.id, files => progressAndReport(client, options.id, files, project, log))
    }
    case 'gap': {
      if (!options.id) throw new Error('gap needs the development, e.g. gap <ID> --step SCENARIO_RESEARCH --text "<what is missing and why>"')
      if (!DEVELOPMENT_ID.test(options.id)) throw new Error(`gap needs the ID of the development (a UUID), got "${options.id}"`)
      if (!options.step) throw new Error('gap needs --step, the step of the playbook that found it, e.g. --step SCENARIO_RESEARCH')
      if (!options.text?.trim()) throw new Error('gap needs --text "<what is missing and why>"')
      const gap = await client.reportGap(options.id, { step: options.step, text: options.text, sources: options.sources })
      log(`Gap ${gap.duplicate ? 'already recorded' : 'recorded'} on ${options.id} (${gap.step}): the admins of NOVA see it ` +
        `in the configurator (gaps ${options.id}).`)
      return 0
    }
    case 'gaps': {
      if (options.id && !DEVELOPMENT_ID.test(options.id)) throw new Error(`gaps takes the ID of a development (a UUID), got "${options.id}"`)
      const gaps = await client.gaps(options.id, { open: options.open })
      if (!gaps.length) {
        log(`No ${options.open ? 'open ' : ''}gap${options.id ? ` on ${options.id}` : ''}.`)
        return 0
      }
      log(`${gaps.length} gap${gaps.length === 1 ? '' : 's'}${options.open ? ' still open' : ''}${options.id ? ` on ${options.id}` : ''}, the newest first:`)
      for (const g of gaps) {
        log(`- ${g.resolved ? 'HANDLED' : 'OPEN'} · ${g.step} · ${g.development?.title ?? '?'} (${g.development_ID}) · ` +
          `${String(g.createdAt ?? '').slice(0, 10)}${g.createdBy ? `, ${g.createdBy}` : ''}\n  ${g.text.replace(/\n/g, '\n  ')}` +
          (g.sources ? `\n  sources: ${g.sources.split('\n').join(', ')}` : '') +
          (g.resolved ? `\n  handled${g.resolvedBy ? ` by ${g.resolvedBy}` : ''}${g.resolvedAt ? ` on ${g.resolvedAt.slice(0, 10)}` : ''}` +
            (g.resolution ? `: ${g.resolution}` : '') : ''))
      }
      return 0
    }
    case 'install': {
      const project = resolve(options.project ?? process.cwd())
      // the whole catalog on this machine: a plugin of the user, never the repository
      if (options.catalog) {
        if (options.id) throw new Error('install --catalog takes no development: it installs the whole catalog')
        return withCatalog(client, files => installCatalog(client, files, options, log))
      }
      if (!options.id) throw new Error('install needs the development, or --catalog')
      // a wave is installed by the developer who takes it: one at a time (docs/10, section 5.5)
      if (await client.isWave(options.id)) {
        const taken = await client.takeWave(options.id)
        log(`Wave ${taken.title}: taken by ${taken.takenBy}.`)
      }
      return withInstaller(client, options.id, async files => {
        // a wave of a custom code program (docs/10) goes into its folder of the repository of the program, unless
        // --project says where; the root then registers it, with the other waves
        const wave = await waveFolder(files.manifest, options.project, project)
        const into = wave?.into ?? project
        if (wave) await mkdir(into, { recursive: true })
        const result = spawnSync(process.execPath, [files.installer, 'apply', '--manifest', files.manifest, '--project', into,
          ...(options.force ? ['--force'] : [])], { stdio: 'inherit' })
        if (wave && result.status === 0) {
          log(`Wave installed in ${relative(project, into)}: registering the developments of ${project} at its root.`)
          spawnSync(process.execPath, [join(into, '.claude', 'nova', 'install.mjs'), 'root', '--project', project], { stdio: 'inherit' })
        }
        // the installation as it is now, for the team: a report that does not get through does not fail the install
        await inventoryAndReport(client, options.id, files, into, log, { required: false })
        await progressAndReport(client, options.id, files, into, log, { required: false })
        return result.status ?? 1
      })
    }
    case 'login': {
      // login <URL>: the configurator to sign in to, remembered for the commands after it
      if (options.id && !/^https:\/\//i.test(options.id))
        throw new Error(`login takes the https address of the configurator on SAP BTP, got "${options.id}"`)
      // login --as <user>: who must sign in; the browser may hold the SAP session of someone else
      const env = options.as ? { ...process.env, NOVA_CONFIG_USER: options.as } : undefined
      const target = options.id || env ? configurator({ url: options.id ?? client.base, ...(env ? { login: { env } } : {}) }) : client
      const { user, expiresAt, refreshExpiresAt } = await target.login()
      log(`Signed in to ${target.base}${user ? ` as ${user}` : ''}` +
        (refreshExpiresAt ? `, renewed without the browser until ${refreshExpiresAt}` : expiresAt ? `, until ${expiresAt}` : '') + '.' +
        (user && !env?.NOVA_CONFIG_USER ? ` If ${user} is not you: logout, then login again in a private window of the browser.` : ''))
      return 0
    }
    case 'lessons':
      return lessonsCommand(options, log)
    case 'logout':
      log(await client.logout() ? `Signed out of ${client.base}.` : `No kept login for ${client.base}.`)
      return 0
    default:
      log(USAGE)
      return options.command ? 2 : 0
  }
}

const invoked = (() => {
  try {
    return process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
  } catch {
    return false
  }
})()
if (invoked) {
  main(process.argv.slice(2)).then(
    code => { process.exitCode = code },
    error => {
      console.error(`error: ${error.message}`)
      process.exitCode = 1
    })
}
