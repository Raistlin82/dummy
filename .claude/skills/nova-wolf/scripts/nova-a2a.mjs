#!/usr/bin/env node
/**
 * The A2A client of Nova WOLF towards Joule, through the SAP Agent Gateway (track W14, docs/wolf/15): the governed route
 * JOULE_A2A of the accesses beyond development. A step routed there asks a Joule agent instead of reading SAP itself.
 *
 *   node nova-a2a.mjs send <ID of the development> --topic <TOPIC> --text <request> [--context <contextId>]
 *   node nova-a2a.mjs task <ID of the development> --topic <TOPIC> --id <task ID>
 *   node nova-a2a.mjs route <ID of the development> --topic <TOPIC>        (the route only, with its endpoint)
 *
 * The configurator says the route of the topic for the development (function governedRoute) and the endpoint: the
 * Agent Gateway's URL, the token URL of SAP Cloud Identity Services (IAS App2App), the names of the variables with the
 * client ID and the secret, the provider application (resource), the Joule capabilities, synchronous or asynchronous.
 * Never a credential: the client reads the variables it names. With the named user, the user's token in
 * NOVA_A2A_USER_TOKEN is exchanged (jwt-bearer) so that Joule acts with the user's context.
 *
 * When the route is not JOULE_A2A (the topic is routed elsewhere, or no Agent Gateway is configured and the route fell
 * back to a person) the client stops with exit code 2 and the reason: it never reads SAP another way.
 *
 * Protocol: A2A 0.3.0. HTTP+JSON transport: POST <url>/v1/message:send, GET <url>/v1/tasks/{id}; JSON-RPC transport
 * (endpoint ending in /jsonrpc, or A2A_TRANSPORT=JSONRPC): method message/send and tasks/get. Joule accepts only text
 * parts and answers a synchronous call within 60 seconds (SAP Architecture Center 76ec36, read 2026-11-12); the
 * bidirectional A2A with third-party agents through the Agent Gateway is not yet GA per SAP (target Q4 2026, to be
 * verified). The exact payload of the HTTP+JSON transport and the IAS App2App grant are to be verified on a tenant.
 */
import { randomUUID } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const TERMINAL = ['completed', 'failed', 'canceled', 'rejected']
// the states that wait for someone: the agent asks for more input or an authorization
export const WAITING = ['input-required', 'auth-required']
const IAS_RESOURCE = 'urn:sap:identity:application:provider:name:'

/** The message of A2A 0.3.0 for a request in words: Joule accepts only text parts. */
export function a2aMessage(text, { contextId, taskId, messageId = randomUUID() } = {}) {
  if (!String(text ?? '').trim()) throw new Error('an A2A request needs its text')
  return { kind: 'message', role: 'user', messageId, parts: [{ kind: 'text', text: String(text) }],
    ...(contextId ? { contextId } : {}), ...(taskId ? { taskId } : {}) }
}

/**
 * The parameters of message/send for an endpoint: blocking when the endpoint answers synchronously; asynchronous with
 * the push notification to Nova's callback (and its token), when there is one.
 */
export function sendParams(endpoint, text, { contextId, notificationToken } = {}) {
  const sync = endpoint.responseMode === 'SYNC'
  const configuration = { acceptedOutputModes: ['text/plain', 'application/json'], blocking: sync }
  if (!sync && endpoint.callbackUrl)
    configuration.pushNotificationConfig = { url: endpoint.callbackUrl, ...(notificationToken ? { token: notificationToken } : {}) }
  return { message: a2aMessage(text, { contextId }), configuration,
    metadata: { capabilities: endpoint.capabilities ?? [], source: 'nova-wolf' } }
}

const jsonRpc = endpoint => process.env.A2A_TRANSPORT === 'JSONRPC' || /\/jsonrpc\/?$/i.test(endpoint.url)
const base = url => url.replace(/\/+$/, '')

/** The HTTP request of an A2A call, for the transport of the endpoint: { url, method, body }. */
export function a2aRequest(endpoint, method, params) {
  if (jsonRpc(endpoint))
    return { url: base(endpoint.url), method: 'POST', body: { jsonrpc: '2.0', id: randomUUID(), method, params } }
  if (method === 'message/send') return { url: `${base(endpoint.url)}/v1/message:send`, method: 'POST', body: params }
  if (method === 'tasks/get') return { url: `${base(endpoint.url)}/v1/tasks/${encodeURIComponent(params.id)}`, method: 'GET' }
  throw new Error(`A2A method not supported by the client: ${method}`)
}

/**
 * What an A2A answer means for the step: a message (synchronous answer), or a task with its ID and state, done or to
 * read later. The text of the answer, from the parts of the message or of the artifacts of the task.
 */
export function a2aResult(answer) {
  const result = answer?.jsonrpc ? (answer.error ? { error: answer.error } : answer.result) : answer
  if (result?.error) return { kind: 'error', error: result.error.message ?? JSON.stringify(result.error) }
  const textOf = parts => (parts ?? []).filter(p => (p.kind ?? 'text') === 'text' && p.text).map(p => p.text).join('\n')
  if (result?.kind === 'message' || (result?.parts && !result?.status)) return { kind: 'message', text: textOf(result.parts) }
  if (result?.kind === 'task' || result?.status) {
    const state = result.status?.state ?? 'unknown'
    const text = [textOf(result.status?.message?.parts), ...(result.artifacts ?? []).map(a => textOf(a.parts))].filter(Boolean).join('\n')
    return { kind: 'task', taskId: result.id, contextId: result.contextId, state, done: TERMINAL.includes(state),
      waiting: WAITING.includes(state), text }
  }
  return { kind: 'unknown', raw: result }
}

/** A push notification of the Agent Gateway, checked: the token Nova gave must come back; the task it carries. */
export function callbackTask(body, headers = {}, expectedToken) {
  const token = headers['x-a2a-notification-token'] ?? headers['X-A2A-Notification-Token']
  if (expectedToken && token !== expectedToken) throw new Error('A2A callback with a wrong or missing notification token')
  const result = a2aResult(body)
  if (result.kind !== 'task') throw new Error('A2A callback without a task')
  return result
}

/**
 * The token for the Agent Gateway from SAP Cloud Identity Services (IAS App2App): client credentials for the provider
 * application, or, with the named user, the user's token exchanged (jwt-bearer). The secret is read from the variable
 * the endpoint names, never passed around. Returns the access token.
 */
export async function iasToken(endpoint, { env = process.env, fetchImpl = fetch } = {}) {
  if (!endpoint.tokenUrl) throw new Error('the Agent Gateway endpoint has no token URL')
  const clientId = endpoint.clientIdVariable ? env[endpoint.clientIdVariable] : undefined
  const secret = endpoint.secretVariable ? env[endpoint.secretVariable] : undefined
  if (!clientId || !secret) throw new Error(`set ${endpoint.clientIdVariable ?? 'the client ID variable'} and ` +
    `${endpoint.secretVariable ?? 'the secret variable'} in the environment (names from the configurator)`)
  const form = new URLSearchParams({ client_id: clientId, client_secret: secret })
  if (endpoint.resource) form.set('resource', endpoint.resource.startsWith('urn:') ? endpoint.resource : IAS_RESOURCE + endpoint.resource)
  const user = env.NOVA_A2A_USER_TOKEN
  if (endpoint.namedUser !== false && user) {
    form.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer')
    form.set('assertion', user)
  } else form.set('grant_type', 'client_credentials')
  const response = await fetchImpl(endpoint.tokenUrl, { method: 'POST', body: form,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } })
  if (!response.ok) throw new Error(`token of SAP Cloud Identity Services: HTTP ${response.status}`)
  const body = await response.json()
  const token = body.access_token ?? body.id_token
  if (!token) throw new Error('token of SAP Cloud Identity Services: no token in the answer')
  return token
}

/** Calls the Agent Gateway: message/send or tasks/get, with the bearer token; the A2A result. */
export async function a2aCall(endpoint, method, params, { token, fetchImpl = fetch } = {}) {
  const request = a2aRequest(endpoint, method, params)
  const response = await fetchImpl(request.url, { method: request.method,
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`,
      ...(request.body ? { 'Content-Type': 'application/json' } : {}) },
    ...(request.body ? { body: JSON.stringify(request.body) } : {}) })
  if (!response.ok) throw new Error(`Agent Gateway: HTTP ${response.status} on ${method}`)
  return a2aResult(await response.json())
}

/**
 * The route of a topic for a development, from the configurator: JOULE_A2A with its endpoint, or why not. `fallback`
 * says that the step goes to a person (never DIRECT in its place).
 */
export function a2aRoute(route) {
  if (route?.path === 'JOULE_A2A' && route.endpoint) return { ok: true, endpoint: route.endpoint }
  return { ok: false, path: route?.path ?? 'UNKNOWN', chosen: route?.chosen, reason: route?.reason ?? null,
    fallback: route?.chosen === 'JOULE_A2A' ? 'PERSON' : route?.path }
}

const option = (args, name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined }

export const USAGE = `usage: nova-a2a.mjs send <ID of the development> --topic <TOPIC> --text <request> [--context <contextId>]
       nova-a2a.mjs task <ID of the development> --topic <TOPIC> --id <task ID>
       nova-a2a.mjs route <ID of the development> --topic <TOPIC>
The topics are those of the accesses beyond development in the configurator, for example TABLE_DATA or USAGE_STATS.`

/** The path of the function governedRoute of the configurator for a development and a topic, the topic quoted. */
export const routePath = (development, topic) =>
  `/governedRoute(development=${encodeURIComponent(development)},topic='${encodeURIComponent(String(topic).replace(/'/g, "''"))}')`

export async function main(args, { client, log = console.log, error: say = console.error } = {}) {
  const [command, development] = args
  const topic = option(args, 'topic')
  if (args.includes('--help') || args.includes('-h')) { log(USAGE); return 0 }
  if (!['send', 'task', 'route'].includes(command) || !development || !topic) {
    say(USAGE)
    return 1
  }
  // what the call needs, before the configurator and the gateway are asked anything
  if (command === 'send' && !option(args, 'text')?.trim()) { say(`send needs the request in words: --text <request>\n${USAGE}`); return 1 }
  if (command === 'task' && !option(args, 'id')) { say(`task needs the ID of the task: --id <task ID>\n${USAGE}`); return 1 }
  if (!client) {
    const { configurator } = await import('./nova-config.mjs')
    client = configurator()
  }
  const answer = await client.request('GET', routePath(development, topic))
  const route = JSON.parse(answer.value)
  const routed = a2aRoute(route)
  if (command === 'route') { log(JSON.stringify(route, null, 2)); return 0 }
  if (!routed.ok) {
    say(`${topic} is not routed to Joule A2A for this development: route ${routed.path}` +
      (routed.reason ? ` (${routed.reason})` : '') + '. Follow the line of that route in the step: a person, or the MCP Gateway.')
    return 2
  }
  const token = await iasToken(routed.endpoint)
  const result = command === 'send'
    ? await a2aCall(routed.endpoint, 'message/send', sendParams(routed.endpoint, option(args, 'text'),
      { contextId: option(args, 'context'), notificationToken: process.env.NOVA_A2A_NOTIFICATION_TOKEN }), { token })
    : await a2aCall(routed.endpoint, 'tasks/get', { id: option(args, 'id') }, { token })
  log(JSON.stringify(result, null, 2))
  return result.kind === 'error' ? 1 : 0
}

// run as a script, also through a link (the copy of the skill in .claude/skills may be one)
const invoked = (() => {
  try {
    return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
  } catch {
    return false
  }
})()
if (invoked)
  main(process.argv.slice(2)).then(code => process.exit(code), error => { console.error(error.message); process.exit(1) })
