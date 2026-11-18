---
description: Sicurezza e autorizzazioni dello sviluppo — revisione per aree, matrice di ruoli, role collection e operazioni verificata contro il codice, segregazione dei dati, drift RBAC nei due versi, finding mappati sui framework del profilo; correzioni sicure su ramo dedicato.
argument-hint: "[all|security|backend|deploy|secrets|owasp|roles|auth|state-paths|data-scope|compliance] [report|fix|pending-only]"
---

Misura chi può fare cosa, su quali dati, e se il controllo dichiarato è quello che il runtime applica: la revisione di sicurezza del codice per aree, la coerenza di ruoli e role collection fra descrittore, modello, codice e utenti di test, la segregazione dei dati e la mappatura di ogni finding sui framework del profilo. È il comando del passo `AUTH_MATRIX` del playbook NOVA (`/nova-security-matrix auth`), dà l'inventario a `SECURITY_REVIEW` e serve prima di ogni rilascio.

Comando generico del toolkit NOVA, derivato da `nova-security-matrix` di un prodotto CAP + Fiori elements: i valori del progetto non sono scritti qui, si leggono o si misurano a ogni esecuzione.

## Argomento: $ARGUMENTS

`[ambito] [modo]`, entrambi facoltativi.

| Ambito | Esegue |
|---|---|
| vuoto o `all` | tutte le fasi |
| `security` | Fase 1, tutte le aree, più la Fase 3 bis |
| `backend` | Fase 1, aree 1, 2, 3 e 5, più la Fase 3 bis |
| `deploy` | Fase 1, area 4 |
| `secrets` | Fase 1, solo la ricerca dei segreti dell'area 4 |
| `owasp` | Fase 1, area 6, più la gap analysis della Fase 5 |
| `roles` | Fasi 2, 3 bis e 4, senza la segregazione dei dati |
| `auth` | la matrice di autorizzazione del passo `AUTH_MATRIX`: Fasi 2, 3, 3 bis e 4, con i loro finding mappati come nella Fase 5 |
| `state-paths` | Fase 3 bis: i percorsi che raggiungono uno stato protetto senza l'azione che lo protegge |
| `data-scope` | Fase 3; con `TENANT_SCOPE_FIELD` = `nessuno` la dichiara non applicabile e si ferma |
| `compliance` | Fase 5 sui finding dell'ultimo rapporto di questo comando in `AUDIT_DIR` |

Modo: `report` (default: misura e rapporto, nessuna modifica al codice) · `fix` (in più le correzioni della sezione *Correzioni*, su ramo dedicato) · `pending-only` (rimisura solo i finding aperti del registro dei pendenti e ne aggiorna lo stato). Esempi: `/nova-security-matrix`, `/nova-security-matrix roles`, `/nova-security-matrix data-scope fix`.

## Contesto — Fase 0, sempre

Prima di giudicare, leggi e misura. Non chiedere all'utente ciò che il repository o lo sviluppo NOVA già dicono, e non usare una lista scritta a mano dove si può derivare. Quello che resta da chiedere lo chiedi con lo strumento AskUserQuestion, a scelta: da 2 a 4 opzioni con i valori misurati o ammessi, la consigliata per prima con «(consigliato)», fino a 4 domande per chiamata; senza lo strumento, un elenco numerato. Mai segreti.

1. **Lo sviluppo NOVA**, se il repository ha `.claude/nova/skills.manifest.json`:
   - `development`: tipologia, target e release, modalità (nuovo o modifica; per una modifica, `change` con lo sviluppo esistente, il sistema sorgente, il percorso e il livello Clean Core obiettivo) `profile`, le risposte del profilo in parole, e `answers`, le stesse in codici (per esempio `SAP_STORE` e `PROCESS`, `YES` o `NO`): su quelle si decide che cosa si applica;
   - la richiesta, in `.claude/nova/REQUEST.md`: cosa deve fare l'applicazione, per chi, con quali regole. È il **dominio**: distingue un difetto di dominio da uno di stile;
   - le skill del piano: le voci di `items`, con le loro `categories`. Per ogni area usa quelle installate (sezione *Skill e MCP*);
   - il passo del playbook per cui il comando gira: `node .claude/nova/install.mjs status`.

   Senza manifest il comando vale lo stesso: dichiaralo nel rapporto e ricava tutto dal repository.
2. **Il profilo d'audit**, `docs/audit/AUDIT_PROFILE.md`: le decisioni che il codice non dice. Questo comando usa `PROJECT_NAME`, `DOMAIN`, `REPORT_LANG`, `AUDIT_DIR`, `PENDING_REGISTER`, `TENANT_SCOPE_FIELD`, `SOD_PAIRS`, `COMPLIANCE_FRAMEWORKS`, `BRANCH_CONVENTION` e `COMMIT_TRAILER`. Se il file manca, esegui prima `/nova-audit-profile`; se manca solo una chiave, chiedila e aggiungila. Un valore del profilo che il repository smentisce è un finding, non un dato.
3. **Il repository**, misurato adesso:
   ```bash
   git rev-parse --show-toplevel && git branch --show-current && git log -1 --oneline
   git status --short                      # file già modificati da altri: non si toccano
   node -e "console.log(JSON.stringify(require('./package.json').scripts ?? {}, null, 1))" 2>/dev/null
   ```
   Poi il ramo di default e la superficie di autorizzazione: i file tracciati, esclusi gli strumenti installati e i prodotti di build.
   ```bash
   git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@.*/@@'
   git ls-files | grep -vE '^\.(claude|agents)/|(^|/)(node_modules|gen|dist|mta_archives)/' | grep -E \
     '(^|/)(xs-security[^/]*\.json|xs-app\.json|mta\.ya?ml|[^/]*\.mtaext|Chart\.yaml|values[^/]*\.ya?ml|Dockerfile[^/]*|\.cdsrc[^/]*\.json|default-env\.json|\.env[^/]*|[^/]*realm[^/]*\.json)$|\.dcl$|(^|/)(k8s|chart|helm)/.*\.ya?ml$|^\.github/workflows/'
   ```
   Trappola misurata su un prodotto reale: senza le esclusioni, la ricerca trovava anche i descrittori d'esempio dentro le skill installate nel repository (`templates/xs-security.json`), che non descrivono il prodotto.
4. **Lo stack**, dal profilo NOVA (`development.type`, `target`, righe di `profile`) confermato dai file: `cap` (`package.json` con `@sap/cds`), `abap` (`.abapgit.xml`, `src/`, o il package dello sviluppo sul sistema), `deploy` (`mta.yaml` per Cloud Foundry, chart Helm o `k8s/` per Kyma, `xs-app.json` per l'approuter). Per una modifica (`mode` = `REVISION`) il perimetro sono gli oggetti di `change.objects`: confronta le loro autorizzazioni con lo sviluppo esistente nel sistema sorgente (server MCP `nova-arc-1-source`), perché un controllo perso nella migrazione è un finding.
5. **cap: il modello compilato, non i sorgenti**, che non vedono le `annotate` sparse, le proiezioni e ciò che gli aspect aggiungono. Una riga per entità, azione e funzione esposta, con restrizioni e servizio remoto d'origine (in alternativa, `search_model` del server MCP `cap-js`):
   ```bash
   D="${TMPDIR:-/tmp}/nova-security-matrix-$(git rev-parse --short HEAD)"; mkdir -p "$D"   # fuori dal repository; ogni blocco che la usa la ridefinisce così: le variabili della shell non passano da un comando all'altro
   node -e '
   const cds = require("@sap/cds"), j = x => JSON.stringify(x ?? null);
   cds.load("*").then(csn => { const D = csn.definitions, srv = Object.keys(D).filter(n => D[n].kind === "service");
     const remoto = n => { const s = srv.find(s => n.startsWith(s + ".")); return s && (D[s]["@cds.external"] || /odata|rest|hcql/.test(cds.env.requires[s]?.kind)) ? s : "" };
     for (const s of srv.filter(s => !D[s]["@cds.external"])) for (const n of Object.keys(D).filter(n => n.startsWith(s + ".") && /^(entity|action|function)$/.test(D[n].kind))) {
       const e = D[n], src = e.projection?.from?.ref?.[0] ?? e.query?.SELECT?.from?.ref?.[0] ?? "";
       console.log([n, e.kind, j(e["@restrict"]), j(e["@requires"] ?? D[s]["@requires"]), e["@readonly"] ? "readonly" : "", remoto(src) && "remoto:" + remoto(src)].join("\t"));
       for (const [a, x] of Object.entries(e.actions ?? {})) console.log([n + "/" + a, x.kind, j(x["@restrict"]), j(x["@requires"]), "", ""].join("\t"));
     } }).catch(e => { console.error(e.message); process.exit(1) })' > "$D/restrict.tsv"
   ```
   E i ruoli, da quattro fonti che devono dire la stessa cosa:
   ```bash
   D="${TMPDIR:-/tmp}/nova-security-matrix-$(git rev-parse --short HEAD)"
   # 1. modello: i "to" di @restrict e i @requires, senza gli pseudo-ruoli di CAP
   node -e '
   const cds = require("@sap/cds"), P = new Set(["authenticated-user", "any", "system-user", "internal-user"]), R = {};
   const add = (v, w) => [v].flat().filter(r => r && !P.has(r)).forEach(r => (R[r] ??= []).push(w));
   cds.load("*").then(csn => { for (const [n, d] of Object.entries(csn.definitions)) for (const [k, x] of [[n, d], ...Object.entries(d.actions ?? {}).map(([a, x]) => [n + "/" + a, x])]) {
     add(x["@requires"], k); for (const g of x["@restrict"] ?? []) add(g.to, k) }
     for (const r of Object.keys(R).sort()) console.log(r + "\t" + R[r].join(" ")) })' > "$D/roles-model.tsv"
   # 2. descrittore: scope, template e collection; lancialo su ogni xs-security*.json misurato sopra
   node -e '
   const x = require(require("path").resolve(process.argv[1])), n = s => String(s).replace(/^\$XSAPPNAME\./, "");
   const S = new Set((x.scopes ?? []).map(s => n(s.name))), T = Object.fromEntries((x["role-templates"] ?? []).map(t => [t.name, (t["scope-references"] ?? []).map(n)]));
   console.log("tenant-mode", x["tenant-mode"] ?? "-", "| scope", S.size, "| template", Object.keys(T).length, "| collection", (x["role-collections"] ?? []).length);
   for (const [t, r] of Object.entries(T)) for (const s of r) if (!S.has(s) && !s.startsWith("uaa.")) console.log("template", t, "-> scope inesistente", s);
   const used = new Set(Object.values(T).flat()); for (const s of S) if (!used.has(s)) console.log("scope senza template", s);
   const inC = new Set(); for (const c of x["role-collections"] ?? []) { const ts = (c["role-template-references"] ?? []).map(n); ts.forEach(t => inC.add(t));
     console.log("collection", c.name, "->", ts.map(t => T[t] ? T[t].join("+") : t + " INESISTENTE").join(" | ")) }
   for (const t of Object.keys(T)) if (!inC.has(t)) console.log("template senza collection", t)' xs-security.json
   git ls-files '*.dcl' | xargs grep -hoE 'ASSIGN ROLE +"?[A-Za-z0-9_.-]+' 2>/dev/null | sort -u     # con IAS/AMS
   # 3. codice: i controlli di ruolo negli handler
   git ls-files 'srv/*' | grep -E '\.(js|ts|mjs|cjs)$' | xargs grep -HnoE "\.is\(\s*['\"][^'\"]+['\"]" 2>/dev/null
   # 4. utenti di test: gli utenti mocked del profilo di sviluppo, con ruoli e attributi
   node -e 'const cds = require("@sap/cds"); for (const [u, x] of Object.entries(cds.env.requires.auth?.users ?? {})) console.log(u + "\t" + (x.roles ?? []).join(",") + "\t" + JSON.stringify(x.attr ?? {}))'
   ```
   Con `@sap/cds-dk`, `cds compile srv --to xsuaa` dà gli scope che il modello richiede: confrontali con il descrittore committato, che può avere una parte anche in `mta.yaml` (`parameters.config` della risorsa xsuaa). I servizi remoti sono le voci di `cds.env.requires` con `kind` `odata`, `odata-v2`, `rest` o `hcql`.
6. **cap: l'autenticazione che gira davvero.** Leggi `NODE_ENV` e `CDS_ENV` dai descrittori di deploy (`mta.yaml`, valori Helm, manifesti, `Dockerfile`) e risolvi l'autenticazione con le stesse variabili:
   ```bash
   CDS_ENV=<profilo del deploy> NODE_ENV=<valore del deploy> node -e 'const e = require("@sap/cds").env; console.log(e.profiles, e.requires.auth?.kind)'
   ```
   Trappola misurata: con `CDS_ENV` impostato e `NODE_ENV` diverso da `production`, CAP aggiunge da sé il profilo `development`, e con esso l'autenticazione `mocked` di sviluppo. `mocked`, `basic` o `dummy` su un percorso di deploy è un finding critico.
7. **abap**, con Nova ARC-1 in sola lettura: service definition e binding del package (`SAPSearch`, `SAPRead` con `SRVD` e `SRVB`), le access control CDS (`DCLS`), i behavior (`BDEF`), le occorrenze di `AUTHORITY-CHECK` e di `WITH PRIVILEGED ACCESS` (`SAPSearch` sul testo); on-premise anche i campi di autorizzazione (`AUTH`) e la traccia di autorizzazione di `SAPDiagnose`. IAM app (`SIA6`) e business catalog: dal repository abapGit se ci sono, altrimenti chiedine l'export o dichiara `NON VERIFICATO`. All'`abap` non si applicano `xs-security.json`, `@restrict`, `securityContext`, `npm audit` (salvo le app UI del repository git) né l'approuter (salvo un'app distribuita su BTP); scrivilo nel rapporto.
8. **Le regole durevoli e la base di confronto**: `CLAUDE.md`, `AGENTS.md` e le ADR di sicurezza, se ci sono (un controllo che una regola dichiara e il codice non applica è un finding); l'ultimo rapporto di questo comando in `AUDIT_DIR` e il registro dei pendenti, i cui finding aperti si rimisurano, non si ricopiano. Chiamato da `/nova-audit-all`, la baseline (stack, modello compilato, gate già misurati) e l'inventario degli strumenti arrivano da lì: non rimisurarli, restituisci i finding nelle cinque parti del Metodo e non scrivere né rapporto né registro.

## Metodo

Le quattro trappole di verifica, dal metodo degli audit che misurano (`.claude/audit-template/METHOD.md`, se il piano l'ha installato):

1. **Il gate verde non è una prova.** Un linter può essere verde su tutti i progetti con finding gravi sotto: vede i simboli del framework e non i pattern del namespace applicativo. Prima di citare un gate come evidenza, chiedi *cosa* misura, non *se* passa.
2. **Il validatore che passa non valida ciò che credi.** Un validatore di schema dice che il file è conforme allo schema, non che i suoi valori abbiano senso nel framework che li consuma: su un prodotto reale, nove manifest validi contenevano un'impostazione che Fiori elements non conosce.
3. **Il layer dichiarativo non è il layer attivo.** Un'annotazione di autorizzazione che il runtime non applica su un certo percorso è documentazione, non un controllo. Per ogni controllo che dichiari conforme, di' quale funzione lo applica e con quale query.
4. **Un test che non diventa rosso quando il guard sparisce non prova nulla.** Si valida neutralizzando il guard e guardando quali test diventano rossi.

E le regole che ne seguono:

- **Derivare, invertire, cablare.** Un insieme si calcola dalla fonte (le app da `git ls-files`, i ruoli dal descrittore e dal codice). Se non si può, un'allowlist diventa denylist; altrimenti un gate confronta la lista con la sua fonte, nei due versi.
- **Prova di sensibilità.** Un gate che proponi o cabli deve diventare rosso sul caso col difetto, con il testo atteso, e restare verde su quello sano.
- **Verificare prima di correggere.** Nessun fix senza aver letto il codice reale: su un audit misurato, un finding critico su tre era falso. Quando rimisuri, i finding cambiano nei due versi.
- **Lo strumento assente si dichiara.** `TOOL UNAVAILABLE`, con l'impatto sulla completezza. Un controllo che non puoi verificare è `NON VERIFICATO`, un terzo esito accanto a `PASSA` e `FALLISCE`: il silenzio si legge come «verificato e a posto».
- **Il rapporto è immutabile, il registro no.** Il rapporto datato non si riscrive; cambia lo stato dei finding nel registro dei pendenti.

## Skill e MCP

Prima consulta, poi giudica: leggi la skill dell'area prima di scrivere un finding in quell'area. Usa quelle che il piano ha installato (manifest `items`); una skill della tabella che il piano non ha non è un errore: di' quale hai usato al suo posto, o `TOOL UNAVAILABLE`. La disponibilità si misura: `node .claude/nova/install.mjs inventory` dice come l'installazione ha ogni voce del piano, mentre `ls .claude/skills` vede solo le skill del progetto.

| Se guardi… | Skill del catalogo (categoria) |
|---|---|
| Identità: XSUAA, IAS e AMS, role collection, provider OIDC | `sap-btp-cloud-identity-services` (C13) |
| Revisione di sicurezza del codice e del diff | `security-review` (C13, integrata) |
| CSP e intestazioni delle app UI5 | `fix-csp-compliance` (C13) |
| Dipendenze e supply chain | `sap-dependency-security` (C13); CLI `lockfile-lint`, `npm audit`, `@cyclonedx/cyclonedx-npm` |
| `@restrict`, `@requires`, handler e profili CAP | `sap-cap-capire`, `sap-cap-best-practices`, `cap-developer` (C07) |
| Servizi remoti e percorsi di proxy | `cap-add-remote-service` (C07), `sap-btp-connectivity` (C09) |
| Superficie API e policy | `sap-api-policy`, `sap-api-style` (C09) |
| ABAP: `AUTHORITY-CHECK`, DCL, BDEF | `sap-abap`, `sap-abap-cds`, `explain-abap-code` (C08); `sap-clean-core-atc` (C12) |
| Deploy, container e log | `sap-btp-cloud-platform`, `sap-btp-cloud-logging`, `cap-operator` (C16) |
| Gate di CI | `sap-cap-ci-gates-pattern` (C16) |
| Dati personali verso servizi AI | `sap-ai-pathfinder`, `sap-cloud-sdk-ai` (C11) |

MCP, per server e strumento: `search_model` del server `cap-js` per il modello compilato, `search_docs` per la documentazione CAP; il server `sap-docs` per la documentazione SAP e le SAP Note, perché una vulnerabilità SAP si verifica sulla Note, non a memoria; `nova-arc-1` (`SAPRead`, `SAPSearch`, `SAPDiagnose`) per lo stack `abap`; `github` per lo stato dei workflow. Se uno strumento fallisce, prova l'istanza alternativa esposta nella sessione o dichiara `TOOL UNAVAILABLE`.

## Procedura

Tieni una lista delle attività, una voce per fase. Le Fasi 1, 2 e 3 vanno in parallelo (in sequenza se il runtime non ha agenti): un solo messaggio, un agente in sola lettura per area, ognuno con l'area e i file misurati in Fase 0, lo stack, il `DOMAIN`, la sezione *Metodo*, il formato del finding (in fondo alla Fase 1) e un limite di circa 400 parole (600 per l'area 6).

### Fase 1 — Revisione di sicurezza per aree

Un'area che il repository non ha si dichiara non applicabile con la misura che lo dice (nessun upload: area 3 non applicabile), mai «pulita».

**Area 1 — Servizi e handler**
- se `TENANT_SCOPE_FIELD` ≠ `nessuno`, azione che riceve il campo di scope da `req.data` senza confrontarlo con l'attributo dell'utente (`req.user.attr`);
- entità protetta solo dal `@requires: 'authenticated-user'` del servizio, dove chiunque sia autenticato scrive, o con un grant più largo del previsto: le righe di `restrict.tsv` con restrizione `null`;
- injection: il tagged template `` .where`… ${x}` `` è parametrizzato, la stessa stringa fra parentesi (`` .where(`… ${x}`) ``, `` orderBy(`${campo}`) ``, `` cds.run(`… ${x}`) ``) è concatenazione, e diventa un finding se il valore arriva dall'utente senza allowlist:
  ```bash
  git ls-files 'srv/*' | grep -E '\.(js|ts)$' | xargs grep -nE '\.(where|having|orderBy|columns)\(\s*`[^`]*\$\{|\b(run|exec)\(\s*`[^`]*\$\{' 2>/dev/null
  ```
- lettura che precede una scrittura dello stesso dato senza `forUpdate` nelle azioni di ciclo di vita (TOCTOU); dettaglio interno al client (`req.reject` o `req.error` con `err.message` o lo stack); mass assignment, un handler che copia `req.data` e così scrive campi `@Core.Computed`, `@readonly` o immutabili.

**abap**: `AUTHORITY-CHECK` senza test di `sy-subrc` subito dopo (non controlla niente) o con `DUMMY` sul campo di scope; `WITH PRIVILEGED ACCESS` ed EML `PRIVILEGED` senza una ragione scritta; SQL dinamico (`WHERE (lv_cond)`) con input dell'utente senza `cl_abap_dyn_prg`.

**Area 2 — Autenticazione, token e superficie esposta**
- token confrontati senza `crypto.timingSafeEqual`; JWT senza verifica di firma, emittente e audience (niente `alg: none`); token in URL o query string, che finiscono nei log;
- guard fail-closed che riconoscono la produzione con un'allowlist di nomi di profilo: un profilo non elencato non è produzione e il guard non si applica, fail-open per omissione. Trappola misurata su un prodotto reale: nove occorrenze in otto file, tutte nel verso sbagliato. La forma sicura è una funzione sola in cui l'insieme vuoto vale produzione, e che il `development` aggiunto da CAP (Fase 0, punto 6) non declassa;
- endpoint senza autenticazione (health, OpenAPI, debug, route montate nel `server.js` prima dell'autenticazione), CORS `*` su percorsi sensibili, limiti di frequenza e di dimensione (`$top`, `$expand`, corpo della richiesta);
- **deploy**: APIRule di Kyma con `noAuth: true` (o `handler: allow` e `noop`) sui percorsi del servizio, dove l'autenticazione dipende solo dall'applicazione.

**Area 3 — File e parsing**, se il modello ha `@Core.MediaType` o `LargeBinary`, o le dipendenze hanno parser di file, XML o archivi: entità esterne e bombe di espansione nei parser XML; zip slip e path traversal nei nomi di file; tipo verificato sui magic bytes e non sull'header; limite di dimensione applicato prima di leggere lo stream; URL di download scelti dall'utente (SSRF: host e protocollo in allowlist, niente `169.254.169.254`, `localhost`, `file://`); scope propagato sullo stream del contenuto.

**Area 4 — Deploy, piattaforma e segreti**
- **Segreti** nei file tracciati; ogni riscontro si legge: valore reale, segnaposto o credenziale locale usa e getta.
  ```bash
  F=$(git ls-files | grep -vE '^\.(claude|agents)/|(^|/)(node_modules|gen|dist)/')
  echo "$F" | grep -E '\.json$' | xargs grep -nE '"(secret|password|token|apikey|client_secret)"\s*:\s*"[^"$]' 2>/dev/null
  echo "$F" | grep -E '\.ya?ml$' | xargs grep -nE "^\s*-?\s*(password|secret|token|api[_-]?key|client[_-]?secret|private[_-]?key)\s*:\s*[\"']?[^\"'[:space:]\$<{#]" 2>/dev/null
  echo "$F" | grep -E '\.(js|ts|sh|py)$' | xargs grep -nE "(api[_-]?key|secret|password|token|credential)\s*[:=]\s*['\"][A-Za-z0-9+/_=-]{16,}['\"]" 2>/dev/null
  echo "$F" | grep -E '(^|/)(\.env[^/]*|default-env\.json|\.cdsrc-private\.json)$'
  ```
  Un segreto tolto dal file resta nella storia di git: si chiude con la rotazione, non con il commit.
  > Trappola misurata, e vale più della ricerca: un segreto committato può avere già una mitigazione documentata (uno script che lo rigenera al deploy) mentre il percorso di installazione automatico la scavalca applicando il file committato così com'è. Non fermarti a «esiste una mitigazione»: segui il percorso che gira davvero e verifica che passi di lì. È la forma più insidiosa del difetto: il controllo c'è e nessuno ci passa.
- **Kyma e container**: `securityContext`, immagini, limiti e volumi, misurati **parsando** i manifesti per documento e per livello. I template di un chart Helm non sono YAML: rendili prima con `helm template` e passa il file reso.
  ```bash
  python3 - $(git ls-files | grep -E '(^|/)k8s/.*\.ya?ml$') <<'PY'
  import sys, yaml
  W = {'Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet', 'Job', 'CronJob', 'Pod'}
  def pod(d):
      s = d.get('spec') or {}
      if d['kind'] == 'Pod': return s
      if d['kind'] == 'CronJob': s = (s.get('jobTemplate') or {}).get('spec') or {}
      return (s.get('template') or {}).get('spec') or {}
  for f in sys.argv[1:]:
      try: docs = list(yaml.safe_load_all(open(f)))
      except Exception as e: print(f, 'NON PARSABILE', e); continue
      for i, d in enumerate(docs):
          if not isinstance(d, dict) or d.get('kind') not in W: continue
          p = pod(d); ps = p.get('securityContext') or {}
          for c in (p.get('initContainers') or []) + (p.get('containers') or []):
              cs = c.get('securityContext') or {}
              print(f'{f}#{i}', d['kind'], c.get('name'), 'pod:', bool(ps), 'nonRoot:', cs.get('runAsNonRoot', ps.get('runAsNonRoot')),
                    'privEsc:', cs.get('allowPrivilegeEscalation'), 'roFS:', cs.get('readOnlyRootFilesystem'),
                    'drop:', (cs.get('capabilities') or {}).get('drop'), 'image:', c.get('image'), 'limits:', bool((c.get('resources') or {}).get('limits')))
          for v in p.get('volumes') or []:
              if 'hostPath' in v: print(f'{f}#{i}', 'hostPath', v['hostPath'].get('path'))
  PY
  ```
  Senza Python e PyYAML usa il pacchetto `yaml` di `node_modules`, o dichiara la misura `NON VERIFICATO`: mai ripiegare sul grep.
  > Trappola misurata, sulla forma della misura: contare con `grep -q securityContext <file>` dà un numero falso. La stringa può stare a livello di container mentre manca a livello di pod, e il file risulta «coperto»: su un prodotto reale la differenza era 18 su 40 contro i 35 su 42 che il grep riportava.

  Poi: `NetworkPolicy` con egress aperto a tutto; segreti montati come variabili d'ambiente invece che come file; `Dockerfile` con `FROM` non fissato per digest o senza un `USER` non root. Un tag sostituito al deploy (`${…}`) si misura sul valore che il deploy mette, non sul file.
- **Cloud Foundry**, nella configurazione xsuaa (`xs-security.json` e `parameters.config` in `mta.yaml`): `tenant-mode` coerente con il prodotto, `redirect-uris` senza wildcard larghe, `token-validity` esplicita.
- **Approuter** (`xs-app.json`): `authenticationMethod: none` spegne l'autenticazione su tutte le route; una route `authenticationType: none` verso il servizio (non verso risorse statiche pubbliche) vuole una ragione scritta e un'autenticazione applicata dal servizio; `csrfProtection: false` su una route OData va tolto, perché Fiori elements e UI5 lavorano con il token CSRF; vince la prima route che combacia, quindi una route larga prima di una con `scope` rende lo `scope` documentazione. Intestazioni: CSP (`default-src 'self'`, `frame-ancestors`), HSTS, `nosniff`, `Referrer-Policy`, cookie `Secure`, `HttpOnly` e `SameSite`, timeout di sessione; per la CSP delle app UI5, `fix-csp-compliance`.
- **CI** (`.github/workflows/`): `pull_request_target` con checkout della testa della PR; action fissate per tag (`@v4`, `@main`) invece che per SHA; segreti stampati nei log.

**Area 5 — Job, integrazioni e messaggi**, se ci sono: webhook e callback in ingresso senza firma verificata; endpoint del job scheduler o dell'utente tecnico oltre quelli dichiarati; idempotenza e replay dei messaggi; TLS non verificato (`rejectUnauthorized: false`); notifiche in uscita con dati personali non ripuliti; parametri segreti in chiaro nel database; log di audit che il database lascia modificare. Esempio: un inserimento massivo nel log di audit che scavalca la sanitizzazione usata dall'inserimento singolo.

**Area 6 — Controlli trasversali**, ciò che le altre aree non coprono:
- crittografia: niente MD5 o SHA-1 per token e password; `crypto.randomBytes` o `randomUUID`, non `Math.random`; AES-GCM con IV unico e tag verificato; chiavi derivate con PBKDF2, scrypt o Argon2;
- IDOR orizzontale (lookup per un id dell'utente senza vincolo di scope o di proprietario nel `where`); race sulla macchina a stati, replay, confini di fiducia non chiari (un proxy che si fida del chiamante);
- identità: timeout di sessione, rotazione dei refresh token, MFA per i ruoli privilegiati (configurazione IAS);
- log: `cds.log` e non `console.*`; fallimenti di autenticazione registrati e distinguibili; azioni dei ruoli privilegiati tracciate; `req.data`, `req.user`, intestazioni o token passati a un log. I dati personali sono gli elementi `@PersonalData.IsPotentiallyPersonal` e `IsPotentiallySensitive` del modello compilato: se il dominio ne tratta e il modello non ne dichiara, è un finding; se ne dichiara e `@cap-js/audit-logging` non è fra le dipendenze, nessuno registra gli accessi. Un permesso concesso da un guard che non sa decidere è accettabile solo se si registra con il motivo: un permesso silenzioso no;
- componenti: un rapporto recente di `/nova-sap-audit-full` o l'evidenza del passo `SUPPLY_CHAIN`, se ci sono; altrimenti `npm audit --omit=dev --json`, mappando critici e alti;
- inventario API: OpenAPI montata solo in sviluppo, endpoint di debug, versioni vecchie ancora esposte.

**abap**: dati personali nel log applicativo (BAL) e nei messaggi; ATC con i controlli di sicurezza della variante del progetto (`SAPDiagnose`).

Formato del finding, per tutte le aree. Sotto la confidenza 0,8 non è un finding: va fra i controlli da verificare.

```
[ALTO] S-3 — Azione con campo di scope nel corpo, senza controllo
- Dove:       srv/<file>.ts:<riga>
- Impatto:    un utente dello scope A modifica i dati dello scope B passando il valore nella richiesta
- Evidenza:   la riga; nessun confronto con req.user.attr.<attributo> prima della scrittura
- Azione:     confronta il valore ricevuto con l'attributo dell'utente, con l'helper già usato dalle altre azioni
- Quick win:  sì
- Framework:  [Broken Access Control · API1 · ASVS V4 · NIST AC-3 · SOM Roles & Authorizations]
- Confidenza: 0,9
```

### Fase 2 — Matrice di coerenza di ruoli e role collection

L'insieme dei ruoli è l'unione delle fonti della Fase 0, mai una lista.

- **A. Definizione**: ogni ruolo del modello e del codice esiste nel descrittore (scope e role template, o policy AMS); nessun ruolo zombie; stessa grafia ovunque (`Admin` e `admin` sono due ruoli).
- **B. Role collection**: ogni template sta in almeno una collection, o ha un motivo scritto; nessuna collection unisce una coppia di `SOD_PAIRS`, salvo esenzioni dichiarate con un responsabile (esempio: la collection dell'amministratore che include anche i due ruoli di una coppia, così chi la riceve approva e registra da solo); la collection dell'utente tecnico è isolata, senza ruoli utente, e nessuno scope tecnico sta in una collection per persone.
- **C. Scope e attributi**: ogni `scope-references` punta a uno scope che esiste e ogni scope ha un template; se `TENANT_SCOPE_FIELD` ≠ `nessuno`, l'attributo che lo porta sta sui template degli utenti con una fonte dichiarata, e manca dai template tecnici per scelta scritta; gli scope concessi ad altre applicazioni (`grant-as-authority-to-apps`) non si assegnano a persone.
- **D. Provider di identità** (IAS, o un realm OIDC nel repository): ogni ruolo ha il suo gruppo o la sua mappatura; nessun gruppo o ruolo predefinito con privilegi; durate di token e sessioni esplicite.
- **E. Uso a runtime**: nessun ruolo nel codice fuori dal descrittore; le liste di ruoli esenti (da controlli o dalla separazione dei compiti) contengono solo ruoli dichiarati.
- **F. Ruoli di processo**: se il dominio ne ha (chi approva un passo, a chi è assegnato un lavoro), sono dati che fanno riferimento a un'entità, mai valori di `@restrict.to` o di `req.user.is`.

**abap**: gli stessi controlli su oggetti di autorizzazione, IAM app, business catalog e business role (on-premise, ruoli PFCG): un oggetto controllato nel codice ma assente dall'IAM app (o dai valori SU24) rende la funzione irraggiungibile, un oggetto dell'IAM app che nessun codice controlla è un permesso morto. L'avvio del servizio OData si controlla a parte, secondo la versione del binding:
- **OData V4**: oggetto `S_START` sul service group, con `AUTHPGMID` = `R3TR`, `AUTHOBJTYP` = `G4BA` e `AUTHOBJNAM` = ID del service group; i default si mantengono in SU22 sull'oggetto R3TR G4BA. Un ruolo con solo `S_SERVICE` non apre un servizio V4 (finding alto); il controllo vale per l'intero service group, non per il singolo servizio ([SAP Help, Security Enhancements for OData V4, ABAP Platform 2023](https://help.sap.com/docs/ABAP_PLATFORM_NEW/68bf513362174d54b58cddec28794093/c6dd838722ce4b8d9cc4a0741d93d864.html?version=202310.000));
- **OData V2**: `S_SERVICE` sul servizio (hash del nome, con le proposte SU24 di R3TR IWSV);
- nella Public Edition e in BTP ABAP lo coprono la IAM app e il business catalog: non si scrivono `S_START` né `S_SERVICE` a mano.

Tre matrici, con le righe derivate, obbligatorie nel rapporto:

```
| Ruolo | Descrittore | Collection o gruppo | Modello (@restrict/@requires) | Codice | Utente di test | Stato |
| Entità o azione | <ruolo> | <ruolo> | … | where di scope | Applicato da | Provato da |
| Collection | Ruoli dentro | Conflitti SOD_PAIRS | Stato |
```

La seconda è la matrice ruoli × operazioni del passo `AUTH_MATRIX`: in ogni cella i verbi concessi (`READ`, `CREATE`, …, le azioni). *Applicato da* dice quale funzione applica la restrizione su quel percorso (trappola 3), *Provato da* quale test la esercita con un utente di test. Una cella senza test è `NON VERIFICATO`, perché non si deduce dal modello: sondala con `cds.test` (o `@cap-js/cds-test`) e gli utenti mocked, fuori dal repository in `report`, con un test vero in `fix`.

### Fase 3 — Segregazione dei dati

Solo se `TENANT_SCOPE_FIELD` ≠ `nessuno`. Altrimenti una riga nel rapporto, «nessun campo di scope nel profilo: controlli di segregazione non applicabili», e nessuna ricerca a vuoto.

- **L'insieme si deriva**: le entità del modello compilato che portano il campo, come elemento o associazione; le globali sono tutte meno le scopate, non una lista scritta a mano.
- Per ognuna, ogni grant ha il `where` sul campo (`<campo> = $user.<attributo>`), salvo i ruoli dichiarati globali. `grant: '*'` e un elenco esplicito di verbi sono lo stesso permesso scritto in due sintassi: un controllo che ne conosce una sola non vede l'altra.
- **CREATE e NEW.** Trappola misurata su un prodotto reale e confermata nel runtime di CAP 9 e 10 (`node_modules/@sap/cds/libx/_runtime/common/generic/auth/restrict.js`): il `where` non statico di un `@restrict` non si valuta su `CREATE` e `NEW`, quindi chi crea può scrivere lo scope di un altro. Serve un guard `before(['CREATE', 'NEW'], '*')` con l'insieme derivato dai grant e il nome della colonna preso dal `where`: `CREATE` oltre a `NEW`, perché l'attivazione di un draft inserisce l'istanza attiva con evento `CREATE`, e un guard sul solo `NEW` si aggira in tre mosse (NEW vuoto, PATCH del draft con lo scope altrui, attivazione). Controprova che isola il difetto: sulla stessa riga `EDIT` e `DELETE` rispondono 403, la creazione no. Rileggi il sorgente del runtime installato: una versione successiva può cambiare il comportamento.
- Azioni che ricevono il campo dal corpo della richiesta: il `@restrict` da solo non basta, serve il confronto nell'handler prima della logica. Poi: query per solo id (repository, helper) senza il vincolo di scope; associazioni ed `$expand` verso entità non scopate; ruoli di configurazione con grant sulle azioni di ciclo di vita.
- > Trappola misurata: un valore **vuoto** del campo di scope non significa «nessuno»: se il prodotto lo usa come fallback globale, significa **tutti**. Ogni filtro scritto come «se il campo è vuoto, passa» è un buco. Cerca esplicitamente `!row[campo] ||` e simili.
- > Trappola misurata: un vincolo dichiarativo può non essere applicato sui percorsi che fanno da proxy verso un sistema esterno: se il layer di proxy passa la query così com'è, il vincolo non viene valutato. Verifica almeno un percorso per tipo (locale, remoto, azione, draft), non solo quelli locali. Le righe `remoto:` di `restrict.tsv` sono i candidati: leggi l'handler `on` che le serve.
- **abap**: la DCL delle entità scopate (`DEFINE ROLE … GRANT SELECT ON <entità> WHERE (<campo>) = ASPECT pfcg_auth(<oggetto>, <campo di autorizzazione>, ACTVT = '03')`); `@AccessControl.authorizationCheck: #NOT_REQUIRED`, o `#CHECK` senza DCL, su un'entità scopata non filtra niente. La DCL vale per la lettura: le modifiche passano dal BDEF (`authorization master ( global, instance )`, `authorization dependent by`) e da `get_instance_authorizations` e `get_global_authorizations` con `AUTHORITY-CHECK` sul campo di scope, e un metodo che non nega nulla concede tutto.

### Fase 3 bis — Percorsi verso gli stati protetti (obbligatoria)

La matrice delle Fasi 2 e 3 dice **chi** può eseguire un'azione. Non dice se esiste **un altro percorso** che porta allo stesso stato senza passare dall'azione e dal suo controllo. Questa voce è obbligatoria in ogni esecuzione che comprende la Fase 2 o la Fase 1 sul backend, anche quando la matrice è tutta verde.

**Stato protetto**: un valore di un campo (o una combinazione) che un'azione dedicata raggiunge solo dopo un controllo: licenza attiva, documento approvato, versione rilasciata, utente sbloccato, pagamento confermato, periodo chiuso. L'insieme si deriva: le azioni (`action`, `determine action`, gli handler `on` di un'azione CAP, i metodi di un BO) che scrivono un campo di stato dopo un controllo (licenza, autorizzazione, validazione di firma, quattro occhi), più gli stati che la specifica e il modello dello stato chiamano protetti. Una lista scritta a mano non basta.

Per ogni stato protetto, elenca **ogni** percorso che può scrivere quel campo o quella combinazione, e per ognuno scrivi chiuso (con il meccanismo e la riga) o giustificato (con il motivo e chi lo accetta):

| Percorso | Dove cercare | Chiuso quando |
|---|---|---|
| **Campo scrivibile** | BDEF e BDEF di proiezione: il campo non è `readonly` (o `readonly : update`), o la proiezione non lo restringe; `field ( mandatory )` non basta. CAP: l'elemento non ha `@readonly` / `@Core.Computed`, o l'entità della proiezione lo espone in un servizio scrivibile | il campo è `readonly` nella base e nella proiezione; il valore lo scrive solo l'azione, con EML `IN LOCAL MODE` dentro il behavior pool |
| **Update o edit che riattiva** | un `update` (o `EDIT` del draft e la sua attivazione) che accetta il campo o lo ricalcola: una determination `on modify` o `on save` che rimette lo stato, un'attivazione del draft che copia lo stato del draft sopra quello attivo, un `PATCH` CAP sul draft seguito da `draftActivate` | lo stato non è nel draft, o la determination controlla di nuovo (licenza, approvazione) prima di scriverlo; `features` (instance) disabilita edit e update negli stati in cui non vanno |
| **EML locale in altre classi** | `MODIFY ENTITIES … IN LOCAL MODE` fuori dal behavior pool, o `MODIFY ENTITIES` senza `IN LOCAL MODE` da classi che girano con privilegi (job, BAdI, API rilasciata); CAP: `UPDATE(...)` o `cds.run` in un handler di un'altra entità o di un servizio tecnico | l'unica scrittura dello stato è nell'azione; le altre classi chiamano l'azione |
| **Job in background** | job APJ (`IF_APJ_RT_EXEC_OBJECT`), bgPF, `cds.spawn`, scheduler: un job che rinnova, sblocca o riattiva | il job chiama l'azione, o ripete lo stesso controllo, e il rapporto lo mostra |
| **Import e migrazioni** | upload di file, Business Configuration, report di migrazione, `cds deploy` con CSV, `db/data`, script di caricamento iniziale, `INSERT` da un altro sistema | il caricamento non può scrivere lo stato protetto, o lo scrive solo con lo stesso controllo; i dati iniziali non contengono righe già nello stato protetto |
| **SQL diretto** | `INSERT`, `UPDATE`, `MODIFY` sulla tabella persistente dal codice ABAP (anche dentro il behavior pool fuori da save), `cds.run(UPDATE…)` sulla tabella del db, `db.run`, query native | nessuna scrittura diretta fuori dal saver; la tabella non ha manutenzione (`@AbapCatalog.dataMaintenance : #RESTRICTED` o `#NOT_ALLOWED`) né SM30 |
| **Interfacce esterne** | servizi OData o API rilasciate di un altro binding, RFC, servizi A2X, endpoint tecnici, webhook | lo stesso BDEF con lo stesso controllo, o il campo `readonly` anche lì |

Ricerca minima, da adattare allo stack: `grep -rniE "<campo di stato>" src/ srv/ db/` per ogni campo, poi una riga per ogni scrittura trovata; per ABAP anche i BDEF di tutte le proiezioni e i service binding che espongono l'entità.

Un percorso **non elencato** o elencato senza chiusura né giustificazione è un finding **alto** (Broken Access Control, ASVS V4 e V11, NIST AC-3): il controllo dell'azione esiste, ma lo stato si raggiunge senza. Esempi dall'add-on a canone che ha introdotto questa voce: il campo `Active` della licenza era scrivibile nella proiezione, quindi un `update` portava la licenza ad attiva senza la verifica della firma; e un `Edit` seguito dall'attivazione del draft riattivava una licenza scaduta, perché la determination ricopiava lo stato senza ripetere il controllo.

Nel rapporto, una tabella per stato protetto: `| Stato | Percorso | Dove (file:riga) | Chiuso da / Giustificato perché | Provato da | Stato |`. *Provato da* è il test che tenta il percorso e fallisce (un `update` del campo che il framework rifiuta, un edit su un'istanza scaduta che resta inattiva); senza test la riga è `NON VERIFICATO`.

### Fase 4 — Stringhe di ruolo cablate e drift RBAC, nei due versi

Confronta i ruoli usati (modello e codice) con quelli dichiarati (scope del descrittore e policy AMS):

```bash
D="${TMPDIR:-/tmp}/nova-security-matrix-$(git rev-parse --short HEAD)"
{ cut -f1 $D/roles-model.tsv; git ls-files 'srv/*' | grep -E '\.(js|ts|mjs|cjs)$' | xargs grep -hoE "\.is\(\s*['\"][^'\"]+['\"]" 2>/dev/null | sed -E "s/.*['\"]([^'\"]+)['\"]$/\1/"; } | sort -u > $D/roles-used.txt
{ for f in <descrittori xs-security misurati>; do node -e 'for (const s of require(require("path").resolve(process.argv[1])).scopes ?? []) console.log(String(s.name).replace(/^\$XSAPPNAME\./, ""))' "$f"; done
  git ls-files '*.dcl' | xargs grep -hoE 'ASSIGN ROLE +"?[A-Za-z0-9_.-]+' 2>/dev/null | sed -E 's/ASSIGN ROLE +"?//'; } | sort -u > $D/roles-declared.txt
comm -3 $D/roles-used.txt $D/roles-declared.txt      # colonna 1: usati e non dichiarati; colonna 2: dichiarati e non usati
```

Un ruolo del descrittore che nessuno controlla è un permesso morto; un ruolo controllato che il descrittore non assegna è una funzione irraggiungibile in produzione, anche se i test la raggiungono con utenti mocked che portano quel ruolo. La seconda si nota, il primo no. Cerca anche le grafie diverse dello stesso ruolo (maiuscole, prefisso `$XSAPPNAME.`), i ruoli che esistono solo negli utenti di test e quelli citati solo nei commenti. Esempio: `to: 'admin'` in un `@restrict` quando il descrittore definisce `Admin`. **abap**: lo stesso confronto fra gli oggetti di `AUTHORITY-CHECK OBJECT` nel codice e quelli dell'IAM app.

### Fase 5 — Matrice di conformità

I framework sono quelli di `COMPLIANCE_FRAMEWORKS`, nella versione che il profilo dichiara:

- **OWASP Top 10**: se il profilo non dice l'edizione, usa l'ultima pubblicata e scrivila. Le sigle cambiano fra le edizioni (`A05` è Security Misconfiguration nel 2021 e Injection nel 2025): mai mescolarle. La tabella usa i nomi del 2025; nel 2021 SSRF è una categoria a sé, la supply chain è *Vulnerable and Outdated Components* e gli errori non gestiti ricadono in *Security Misconfiguration*.
- **ASVS**: il livello del profilo (L2 di default) è il metro; il requisito puntuale (`V4.2.1`) si cita dopo averlo letto nella versione dichiarata, non a memoria.
- **SAP Secure Operations Map**: cinque livelli e sedici blocchi, si cita il blocco. **CIS**: il benchmark della piattaforma (Kubernetes, Docker), con versione e numero del controllo insieme. **Di settore** (GDPR, SOX, PCI DSS…): una colonna ciascuno, solo se il profilo li nomina. **NIST CSF**, se c'è: il rollup anche per funzione (Identify, Protect, Detect, Respond, Recover).

Punto di partenza del mapping, da confermare finding per finding:

| Tipo di finding | OWASP Top 10 (2025) | API Top 10 (2023) | ASVS | NIST 800-53 | SAP SOM |
|---|---|---|---|---|---|
| Controllo di scope o di proprietario mancante, `where` non applicato su un percorso | Broken Access Control | API1, API5 | V4 | AC-3 | Roles & Authorizations |
| Stato protetto raggiungibile senza l'azione che lo protegge (Fase 3 bis) | Broken Access Control | API5, API6 | V4, V11 | AC-3 | Roles & Authorizations |
| Grant più largo del previsto, mass assignment | Broken Access Control | API3, API5 | V4, V5 | AC-3, AC-6 | Roles & Authorizations |
| Coppia di `SOD_PAIRS` nella stessa collection | Broken Access Control | API5 | V4 | AC-5 | Roles & Authorizations |
| Ruolo zombie, drift di nomi, scope senza template | Security Misconfiguration | API9 | V14 | CM-6, AC-6 | Roles & Authorizations |
| Injection (CQL o SQL, XML, percorsi di file) | Injection | API10 se il dato è esterno | V5, V12 | SI-10 | Custom Code Security |
| SSRF da URL scelto dall'utente | Broken Access Control | API7 | V12 | SC-7 | Network Security |
| Dettaglio interno al client, guard che fallisce aperto | Mishandling of Exceptional Conditions | API8 | V7 | SI-11 | Custom Code Security |
| Token o JWT validati male, token in URL, sessioni lunghe | Authentication Failures | API2 | V2, V3 | IA-2, IA-5, AC-12 | Authentication & Single Sign-On |
| Segreto committato, crittografia debole, TLS non verificato | Cryptographic Failures | — | V6, V9 | IA-5, SC-8, SC-12, SC-13 | Security Hardening |
| Dati personali in log, audit o notifiche | Security Logging & Alerting Failures | — | V7, V8 | SI-12 | Data Privacy & Protection |
| Log di audit modificabile, azioni privilegiate non tracciate | Security Logging & Alerting Failures | — | V7 | AU-2, AU-9 | Security Monitoring & Forensics |
| Intestazioni, CSP, CORS `*`, CSRF spento, endpoint di debug esposti | Security Misconfiguration | API8, API9 | V14 | CM-6, CM-7, SC-23 | Security Hardening |
| Container root, immagine non fissata, rete aperta (più CIS) | Security Misconfiguration | API8 | V14 | CM-6, CM-7, SC-7 | Operating System & Database Security |
| CI con `pull_request_target`, action non fissate, dipendenze vulnerabili | Software Supply Chain Failures | — | V14 | SR-3, SI-2 | Security Hardening |
| Webhook senza firma, consumo di API senza validazione | Software or Data Integrity Failures | API10 | V13 | SI-10 | Custom Code Security |
| Limiti mancanti (frequenza, dimensione, `$expand`) | Insecure Design | API4 | V11, V12 | SC-5 | Security Hardening |

Output: una riga per finding (`| ID | Gravità | OWASP | API | ASVS | NIST | CIS | SOM | settore |`); il **rollup** per framework (finding per categoria, requisiti ASVS del livello verificati su totali, blocchi SOM toccati su sedici, controlli CIS verificati su applicabili); la **gap analysis**, cioè i controlli che nessun finding rappresenta e che non hai verificato, ognuno `NON VERIFICATO` (per esempio l'antivirus sui file caricati). Fonti: <https://owasp.org/Top10/>, <https://owasp.org/API-Security/>, <https://github.com/OWASP/ASVS>, <https://csrc.nist.gov/projects/risk-management/sp800-53-controls>, <https://www.cisecurity.org/cis-benchmarks>.

### Fase 6 — Consolidamento

Due aree che segnalano la stessa cosa danno un finding solo: la descrizione più ricca, con entrambe le fonti. Classifica per gravità e confidenza; una regressione di un controllo già chiuso (nel registro o in un rapporto precedente) cita la chiusura e sale di gravità. Prima di proporre un meccanismo nuovo cerca il pattern che il progetto ha già, e riusalo: un helper unico che confronta lo scope ricevuto con `req.user.attr`, un guard su `CREATE` e `NEW` registrato per primo, errori redatti verso il client con il dettaglio solo nel log, una sanitizzazione unica dei dati personali chiamata da tutti gli scrittori di log, audit e notifiche, token confrontati a tempo costante, audit append-only anche nel database, riconoscimento della produzione per negazione, limiti di pagina (`@cds.query.limit`), magic bytes sugli upload, action di CI fissate per SHA e immagini per digest.

## Correzioni (`fix`)

- Mai sul ramo di default: un ramo dedicato, con la convenzione del profilo (`BRANCH_CONVENTION`).
- Mai file già modificati da altri, salvo richiesta esplicita.
- Solo quick win: impatto locale e reversibile, pochi file, nessuna migrazione di dati, nessun contratto di servizio nuovo, nessuna decisione di prodotto (ruoli, separazione dei compiti, stati del processo), nessuna credenziale reale.
- Correzioni in parallelo solo su file disgiunti: si raggruppa per proprietario del file, non per tema.
- Ogni finding chiuso porta il test o il gate che lo tiene chiuso, con la prova di sensibilità.
- Test e compilazione mirati, commit con il trailer del profilo, push e pull request. Niente `[skip ci]`.

Ammesse, se il finding è verificato e il meccanismo esiste già nel progetto:

1. il controllo di scope mancante in un'azione che riceve il campo dal corpo, con l'helper già usato dalle altre azioni (nessun helper nuovo);
2. la funzione di sanitizzazione esistente, dove un log, un audit o una notifica la scavalca;
3. il `where` di scope su un grant di un'entità scopata, quando gli altri grant della stessa entità lo hanno già, con il test sulla lettura e sulla creazione (il `where` da solo non copre `CREATE`);
4. una stringa di ruolo che è il refuso evidente di un ruolo esistente;
5. il template in conflitto dentro una role collection, quando la coppia è in `SOD_PAIRS` e quindi la decisione è già presa; se la coppia non c'è, è una decisione e va nel piano;
6. il descrittore del provider di identità: durate di token e sessioni rese esplicite con i valori già in uso, un ruolo tecnico mancante dichiarato come gli altri.

Non ammesse, e quindi nel piano con la priorità: firme degli handler, schema e migrazioni, disponibilità delle azioni, collection rinominate (rompono le assegnazioni esistenti), ruoli rimossi, refactor trasversali, rotazione dei segreti (un'azione operativa: il commit toglie il valore, la rotazione lo rende inutile). **abap**: Nova ARC-1 resta in sola lettura salvo che il playbook abbia abilitato la scrittura; senza, la correzione è un diff proposto nel rapporto, con la scrittura va su una richiesta di trasporto dello sviluppo.

Un commit per correzione, `fix(security): <area> — <ID> <descrizione>`; dopo ognuna, compilazione del modello, test mirati sull'handler toccato e gli script `lint*` e `test*` pertinenti del progetto. La pull request ha sommario, piano di test e tabella prima/dopo.

## Esito

Il rapporto ha queste sezioni:

1. **Pre-flight**: ramo, sha, file già modificati, stack, sviluppo NOVA, chiavi del profilo usate.
2. **Sommario**: finding per gravità; aree pulite su aree applicabili; drift di ruoli; buchi di segregazione, o «non applicabile»; rischio residuo da A a D, con il criterio scritto.
3. **Revisione per aree**: `| Area | Esito (PASSA, FALLISCE, NON VERIFICATO, non applicabile) | Finding |`.
4. **Matrici** della Fase 2: definizione dei ruoli, ruoli × operazioni, role collection; e le tabelle della Fase 3 bis, una per stato protetto.
5. **Finding**, con confidenza di almeno 0,8, nel formato della Fase 1.
6. **Matrice di conformità**: per finding, rollup, gap analysis.
7. **Controlli passati**, uno per uno, per la tracciabilità.
8. **Piano delle correzioni** (`report`) o **correzioni applicate** (`fix`, con i commit): `| Gravità | Finding | Sforzo | Quick win |`.
9. **Verifiche**: compilazione, test e gate, ognuno con il comando e l'esito.
10. **Rischio residuo**.

Il passo `AUTH_MATRIX` lancia `/nova-security-matrix auth` e ha come output questo rapporto, con la matrice ruoli × operazioni: si chiude quando la matrice è scritta e verificata nei due versi, con le celle `NON VERIFICATO` dichiarate; se il passo indica un file di output diverso (`node .claude/nova/install.mjs next`), scrivi lì la matrice o il rimando al rapporto. `SECURITY_REVIEW` è un controllo bloccante: resta aperto finché c'è un finding alto o critico aperto e non approvato.

Poi, sempre:

- **Rapporto** in `AUDIT_DIR/<aaaa-mm-gg>-<nome-del-comando>.md`, nella lingua `REPORT_LANG`, con `file:riga` come link. Ogni finding ha cinque parti: dove (`file:riga` o il comando che l'ha prodotto), impatto su un utente o su un dato, evidenza (l'output, il numero, la riga), azione, quick win sì/no.
- **Registro dei pendenti** (`PENDING_REGISTER`): i finding già registrati cambiano stato (`Chiuso`, `Ancora aperto`, `Parzialmente corretto`, `Superato`, `Rinviato`) con l'evidenza; i nuovi si aggiungono. Non si cancella niente.
- **Costo**: tempo per fase, cosa non è stato eseguito e perché.
- **Playbook**: se il comando gira per un passo del playbook NOVA, chiudilo solo se l'esito lo consente, con `node .claude/nova/install.mjs done <PASSO> --evidence "<rapporto>: <esito in una riga>"`. Con finding bloccanti aperti il passo resta aperto.

## Regole

1. **Un finding di sicurezza non verificato è un danno**: sposta lavoro reale su un problema che non c'è e logora la fiducia nel rapporto (su un prodotto reale, 7,7% di falsi positivi). Confidenza di almeno 0,8, `file:riga` e uno scenario concreto: chi, con quale ruolo, fa cosa a quale dato.
2. **La matrice dei ruoli è sempre nel rapporto**, con tutte le fonti e la colonna di stato, e l'insieme dei ruoli è derivato.
3. **Ogni finding cita i framework** fra parentesi quadre: almeno una categoria OWASP (Top 10 o API Top 10, nell'edizione dichiarata), un capitolo ASVS e, se pertinente, un controllo di un altro framework del profilo.
4. **La matrice di conformità è completa**: per finding, rollup e gap analysis. Serve alla tracciabilità di un audit esterno, e un audit completo dice anche che cosa non ha verificato.
5. **Il livello ASVS è quello del profilo**: un finding si misura contro quel livello, non contro L1.
6. **Lo scope si difende nell'handler prima che nel CDS** quando l'azione riceve il campo dal corpo o crea righe, e il rapporto lo ribadisce.
7. **Ogni stato protetto ha l'elenco dei percorsi che lo raggiungono** (Fase 3 bis), anche quando la matrice dei ruoli è verde: un percorso mancante è un finding alto, non una nota.
