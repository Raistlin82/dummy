---
description: Audit completo dello stack SAP — analisi statica per stack su ogni app scoperta, revisione specialistica per area, controlli CAP, domini presenti nel repository, dipendenze e SBOM, revisione formale del diff, gate di verifica; un rapporto unico che rimanda agli audit dedicati.
argument-hint: "[all|ui5|cap|abap|btp|domain|quick|<app>] [report|fix]"
---

Audit generalista dello stack: fa girare gli strumenti che misurano (linter, validatori, compilatore del modello, controllo dei tipi, ATC, test), chiede alle skill e agli agenti la revisione per area, e chiude con la revisione formale del diff e un gate che verifica ogni affermazione del rapporto. Copre ciò che gli audit dedicati non coprono e di quelli riporta l'esito, senza rifarli. Usalo prima di un rilascio o quando lo stack cambia.

Comando generico del toolkit NOVA, derivato da `sap-audit-full` di un prodotto CAP + Fiori elements: i valori del progetto non sono scritti qui, si leggono o si misurano a ogni esecuzione.

## Argomento: $ARGUMENTS

`[ambito] [modo]`, entrambi facoltativi.

| Ambito | Esegue |
|---|---|
| vuoto o `all` | tutte le fasi |
| `ui5` | solo UI5 e Fiori: la Fase 1, le parti UI delle Fasi 2 e 3, poi le Fasi 7, 8 e 9 |
| `cap` | solo il backend CAP |
| `abap` | solo ABAP e RAP, con Nova ARC-1 |
| `btp` | best practice della piattaforma, deploy, connettività e log (Fase 6), con le Fasi 1 e 9 |
| `domain` | solo i controlli di dominio (Fase 5), con le Fasi 1 e 9 |
| `quick` | solo i controlli automatici: Fasi 1, 2 (senza la suite di test), 4, 7 (senza la revisione del diff) e 9; misurato su un altro prodotto: ~4 min |
| altro | filtro su un'app: il nome della sua cartella, o la parte finale del percorso (`app/ordini` → `ordini`); se due app finiscono allo stesso modo, chiedi quale, con quelle app come opzioni |

Modo: `report` (default: misura e rapporto; non tocca altri file oltre al rapporto e al registro) · `fix` (solo se chiesto, ed è l'argomento stesso: applica i quick win verificati con le regole di *Correzioni*).

## Contesto — Fase 0, sempre

Prima di giudicare, leggi e misura. Non chiedere all'utente ciò che il repository o lo sviluppo NOVA già dicono, e non usare una lista scritta a mano dove si può derivare. Quello che resta da chiedere lo chiedi con lo strumento AskUserQuestion, a scelta: da 2 a 4 opzioni con i valori misurati o ammessi, la consigliata per prima con «(consigliato)», fino a 4 domande per chiamata; senza lo strumento, un elenco numerato. Mai segreti.

1. **Lo sviluppo NOVA**, se il repository ha `.claude/nova/skills.manifest.json`:
   - `development`: tipologia, target e release, modalità (nuovo o modifica; per una modifica, `change` con lo sviluppo esistente, il sistema sorgente, il percorso e il livello Clean Core obiettivo) `profile`, le risposte del profilo in parole, e `answers`, le stesse in codici (per esempio `SAP_STORE` e `PROCESS`, `YES` o `NO`): su quelle si decide che cosa si applica;
   - la richiesta, in `.claude/nova/REQUEST.md`: cosa deve fare l'applicazione, per chi, con quali regole. È il **dominio**: distingue un difetto di dominio da uno di stile;
   - le skill del piano: le voci di `items`, con le loro `categories`. Per ogni area usa quelle installate (sezione *Skill e MCP*);
   - il passo del playbook per cui il comando gira: `node .claude/nova/install.mjs status`.

   Senza manifest il comando vale lo stesso: dichiaralo nel rapporto e ricava tutto dal repository.
2. **Il profilo d'audit**, `docs/audit/AUDIT_PROFILE.md`: le decisioni che il codice non dice. Questo comando usa `PROJECT_NAME`, `DOMAIN`, `REPORT_LANG`, `AUDIT_DIR`, `PENDING_REGISTER`, `BRANCH_CONVENTION` e `COMMIT_TRAILER`. Se il file manca, esegui prima `/nova-audit-profile`; se manca solo una chiave, chiedila e aggiungila. Un valore del profilo che il repository smentisce è un finding, non un dato.
3. **Il repository**, misurato adesso:
   ```bash
   git rev-parse --show-toplevel && git branch --show-current && git log -1 --oneline
   git status --short                      # file già modificati da altri: non si toccano
   node -e "console.log(JSON.stringify(require('./package.json').scripts ?? {}, null, 1))" 2>/dev/null
   ```
   Poi il ramo di default, le app, gli strumenti configurati:
   ```bash
   git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@.*/@@'
   # le app UI, da git ed esclusi gli strumenti installati: mai da ls, su disco restano residui non tracciati
   git ls-files | grep -E '(^|/)webapp/manifest\.json$' | grep -vE '^\.(claude|agents)/' | sed -E 's#/webapp/manifest\.json$##' | sort -u
   # le app presenti su disco ma non tracciate: residui di build da segnalare
   comm -13 <(git ls-files | grep -E '(^|/)webapp/manifest\.json$' | sort) <(find . -name manifest.json -path '*/webapp/*' -not -path '*/node_modules/*' | sed 's#^\./##' | sort)
   # configurazione degli strumenti e binari locali
   git ls-files | grep -vE '^\.(claude|agents)/|(^|/)(node_modules|gen|dist)/' | grep -E '(^|/)(package\.json|ui5[^/]*\.yaml|eslint\.config\.[cm]?js|\.eslintrc[^/]*|tsconfig[^/]*\.json|\.abapgit\.xml|abaplint\.jsonc?|\.gitleaks\.toml|mta\.ya?ml)$'
   ls node_modules/.bin 2>/dev/null | grep -xE 'cds|cds-serve|ui5|ui5lint|eslint|tsc|jest|vitest|lockfile-lint|cyclonedx-npm|abaplint'
   ```
   Trappola misurata su un prodotto reale: un'app fusa in un'altra sopravviveva su disco come `dist/` e `node_modules/` non tracciati, e una lista statica lintava l'app morta e ne saltava due reali.
4. **Lo stack**, dal profilo NOVA (`development.type`, `target`, righe di `profile`) confermato dai file: `cap` (`package.json` con `@sap/cds`), `fiori` (le app scoperte, FE v4 se i target del routing usano `sap.fe.templates`, altrimenti UI5 freestyle), `abap` (`.abapgit.xml`, `src/`, o il package dello sviluppo sul sistema, letto con Nova ARC-1), `deploy` (`mta.yaml`, chart Helm o `k8s/`, `xs-app.json`). Per una modifica, il perimetro sono gli oggetti di `change.objects`.
5. **La base di confronto**: l'ultimo rapporto di questo comando in `AUDIT_DIR`, i cui numeri (test e suite, errori di tipo, warning del compilatore, finding del linter per app) sono il termine di paragone, non la misura; il registro dei pendenti; l'ultimo rapporto di ogni audit dedicato, per la sezione che li riassume. Chiamato da `/nova-audit-all`, la baseline (compilazione del modello, linter, controllo dei tipi, test) e l'inventario degli strumenti arrivano da lì: non rimisurarli, restituisci i finding nelle cinque parti del Metodo e non scrivere né rapporto né registro.

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

Prima consulta, poi giudica: prima di scrivere un finding in un'area, leggi la skill dell'area ed estrai i suoi criteri. Usa quelle che il piano ha installato (manifest `items`); una skill della tabella che il piano non ha non è un errore: di' quale hai usato al suo posto, o `TOOL UNAVAILABLE`.

La disponibilità di uno strumento è una misura, non un elenco: `node .claude/nova/install.mjs inventory` dice come l'installazione ha ogni voce del piano, `ls .claude/skills` vede solo le skill del progetto, e l'altra misura è il fallimento vero dell'invocazione. Trappola misurata su un prodotto reale: venticinque nomi di strumenti su venticinque erano scritti in una forma che nessun ambiente risolveva, e il comando girava promettendoli senza dirlo. Non invocare le skill di aree che il progetto non ha (planning, data warehouse, un'integrazione assente): producono finding fuori contesto.

| Se guardi… | Skill del catalogo (categoria) |
|---|---|
| Esito del linter UI5, API deprecate, lacune del linter | `ui5-best-practices`, `sapui5`, `sapui5-cli` (C06); `fix-linter-blind-spots`, `fix-deprecated-controls`, `fix-partially-deprecated-apis`, `fix-js-globals`, `fix-xml-globals`, `fix-pseudo-modules`, `modernize-ui5-app` (C14) |
| Manifest e impostazioni di Fiori elements | `fix-manifest-json`, `fix-bootstrap-params`, `fix-component-async` (C14); `sap-fiori-app-development` (C05) |
| ESLint con il plugin Fiori | `sap-fiori-eslint-plugin` (C14) |
| Floorplan, annotazioni, linee guida | `sap-fiori-app-development` (C05), `sap-fiori-guidelines` (C04) |
| CAP: modello, prestazioni, architettura, build | `sap-cap-capire`, `sap-cap-best-practices`, `cap-developer`, `cap-upgrade` (C07) |
| Servizi remoti e destination | `cap-add-remote-service` (C07), `sap-btp-connectivity` (C09) |
| Contratto OData | `sap-api-style`, `sap-api-policy` (C09) |
| ABAP e RAP | `sap-abap`, `sap-abap-cds`, `explain-abap-code`, `debug-slow-sql` (C08); `sap-clean-core-atc` (C12) |
| Job, trasporti, log, piattaforma, CI | `sap-btp-job-scheduling`, `sap-btp-cloud-transport-management`, `sap-transport-review`, `sap-btp-cloud-logging`, `sap-btp-cloud-platform`, `cap-operator`, `sap-cap-ci-gates-pattern` (C16) |
| AI | `sap-ai-pathfinder`, `sap-cloud-sdk-ai` (C11) |
| Dipendenze, supply chain, SBOM | `sap-dependency-security` (C13); CLI `lockfile-lint`, `npm audit`, `@cyclonedx/cyclonedx-npm` |
| Test e copertura | `generate-cap-cds-test`, `generate-abap-unit-test`, `ui5-best-practices-qunit`, `ui5-best-practices-opa5` (C15) |
| Revisione del diff | `code-review`, `simplify` (C14, integrate); `security-review` (C13, integrata) |

MCP, per server e strumento: del server UI5 (`ui5-mcp-server`) `run_ui5_linter`, `run_manifest_validation`, `get_api_reference`, `get_guidelines`, `get_version_info`; del server `fiori-mcp` `list_fiori_apps`; del server `cap-js` `search_model` e `search_docs`; del server `nova-arc-1` `SAPDiagnose` (controllo di sintassi, ATC, ABAP Unit), `SAPLint`, `SAPRead`, `SAPSearch`, in sola lettura; `sap-docs` per la documentazione SAP e le SAP Note; `github` per i workflow; `context7` per le librerie non SAP. Se uno strumento fallisce, prova l'istanza alternativa esposta nella sessione o dichiara `TOOL UNAVAILABLE`.

## Procedura

Tieni una lista delle attività, una voce per fase.

### Non duplicare gli audit dedicati

Sette aree hanno un comando più profondo: qui non si rifanno in forma debole. Un finding trovato due volte con due gravità diverse costa più di uno non trovato.

| Area | Comando dedicato | Che cosa fa qui questo comando |
|---|---|---|
| Sicurezza, ruoli, segregazione, conformità (OWASP, ASVS, NIST, CIS, SAP Secure Operations Map) | `/nova-security-matrix` | solo la Fase 7: dipendenze, scanner dei segreti, `security-review` del diff |
| Clean Core e API rilasciate | `/nova-check-clean-level-a` | solo la presenza: un catalogo delle API consumate e un gate che lo confronta con il codice |
| Un'app end-to-end: percorso utente, contratto fra interfaccia e servizio, pendenti | `/nova-app-audit` | linter e manifest per app (Fase 2); l'approfondimento per app è suo |
| Qualità dell'interfaccia, accessibilità, coerenza fra app | `/nova-ux-quality` | nessun controllo di UX oltre ai riscontri del linter |
| Testi che l'utente legge | `/nova-text-polish` | solo i bundle i18n che si risolvono (Fase 2B) |
| Customizing cablato nel codice | `/nova-enforce-customizing` | solo lo smoke test della Fase 2I |
| Matrice fase × controllo × stato × ruolo del processo | `/nova-check-matrix` | nessuno |

Nel rapporto, per ognuna, una riga: l'esito sintetico dall'ultimo rapporto di quel comando, con la data, o «non eseguito»; e il rimando.

### Fase 1 — Pre-flight e ambiente

1. **Dipendenze installate contro dichiarate**, prima di ogni gate, perché un ambiente disallineato produce falsi rossi a valle:
   ```bash
   npm ls --depth=0 2>&1 | grep -E 'UNMET|invalid|missing' | head -20
   # lo stesso pacchetto SAP, CAP o UI5 installato in più major
   npm ls --all --parseable --long 2>/dev/null | awk -F: '{print $2}' | grep -E '^(@sap|@sap-cloud-sdk|@cap-js|@ui5|@sap-ux)/' \
     | sed -E 's/@([0-9]+)\.[0-9]+\.[0-9]+.*$/ \1/' | sort -u | awk '{c[$1]++; v[$1]=v[$1]" "$2} END {for (k in c) if (c[k]>1) print k":"v[k]}'
   ```
   Un pacchetto mancante o fuori dal range dichiarato è un **BLOCKER di ambiente**: dillo prima degli esiti dei gate, che diventano inaffidabili. Trappola misurata su un prodotto reale: il compilatore TypeScript installato era un major sotto quello dichiarato, e il controllo dei tipi falliva per l'ambiente, non per il codice.
2. **cap: il modello intero**, non un solo file di servizio, con i messaggi del compilatore; l'API di `@sap/cds` basta, senza `@sap/cds-dk`:
   ```bash
   node -e '
   const cds = require("@sap/cds"), messages = [];
   cds.load("*", { messages }).then(csn => { [...cds.compile.to.edmx(csn, { service: "all", messages })];
     for (const m of messages) console.log(m.severity, m.messageId ?? "", m.$location?.file ?? "", m.$location?.line ?? "", String(m.message).slice(0, 160));
     console.log("definizioni", Object.keys(csn.definitions).length, "| messaggi", messages.length) }).catch(e => { console.error("ERRORE", e.message); process.exit(1) })'
   ```
   > Zero errori non basta: guarda i warning. Un'annotazione che il compilatore scarta in silenzio è un controllo che credi di avere e non hai: su un prodotto reale, quattordici warning nascondevano esattamente questo. Provato su un modello di prova: uscita 0 con un `@readonly` su un'entità che non esiste, visibile solo come warning.
3. **abap**: controllo di sintassi e stato degli oggetti del package con `SAPDiagnose`; un oggetto inattivo è un finding.
4. **Vincoli d'ambiente**: che cosa non è eseguibile qui (un sistema non raggiungibile, un MCP assente, un binario mancante) e con quale impatto.

### Fase 2 — Analisi statica automatica

Usa `node_modules/.bin/<strumento>` quando c'è; altrimenti la versione pinnata dal piano (manifest `items`), non l'ultima. Con un'app come argomento, solo quella.

- **A. Linter UI5** su ogni app scoperta. Se il progetto ha uno script `lint*` che itera le app, usa quello e non riscrivere il loop; se lo script elenca le app a mano, confronta l'elenco con le app scoperte nei due versi: un elenco scritto a mano è un finding anche quando oggi coincide, perché la prima app nuova resterà fuori e lo script resterà verde. Senza script: `ui5lint` nella cartella di ogni app, o `run_ui5_linter` del server MCP UI5. Poi interpreta con le skill (gravità reale, falsi positivi noti, API deprecate per la versione in uso, i pattern del namespace che il linter non vede): un numero senza interpretazione non è un finding. Un finding che il registro dà per chiuso si rimisura: se è ancora chiuso lo si scrive, non si riporta di nuovo.
- **B. Manifest**: `run_manifest_validation` per ogni `webapp/manifest.json`; poi quello che lo schema non vede (trappola 2): le chiavi di impostazione di Fiori elements esistono nella versione in uso (`get_api_reference`, `fix-manifest-json`); il modello i18n si risolve a un file tracciato; `minUI5Version` è coerente con la versione del framework in `ui5.yaml` e con quella caricata dal bootstrap (`index.html`); la versione OData dei `dataSources` è quella del servizio.
- **C. App Fiori**: `list_fiori_apps` del server `fiori-mcp`, per app duplicate, percorsi fuori standard, versione OData incoerente.
- **D. ESLint**, dove configurato (`eslint.config.*` o `.eslintrc*`): con `@sap-ux/eslint-plugin-fiori-tools` fra le dipendenze le regole Fiori fanno parte dell'esito (`sap-fiori-eslint-plugin`), con `@sap/eslint-plugin-cds` quelle del modello CDS (`cds lint`). La configurazione `@sap/cds/eslint.config.mjs` copre solo il JavaScript del servizio: un `eslint .` verde con quella sola non dice niente del modello (trappola 1).
- **E. TypeScript**, dove configurato: gli script `typecheck*`, o `tsc --noEmit -p <tsconfig>` per ogni `tsconfig*.json`. Conta gli `error TS` e confrontali con il rapporto precedente: crescita è regressione, calo è progresso; un errore di configurazione del compilatore è ambiente (Fase 1).
- **F. Backend CAP**, esempi da tarare sul progetto, non un canone:
  ```bash
  S=$(git ls-files 'srv/*' | grep -E '\.(js|ts)$' | grep -vE '\.test\.|/test/')
  echo "$S" | xargs grep -nE 'console\.(log|error|warn|info|debug)\(' 2>/dev/null     # al posto di cds.log
  echo "$S" | xargs grep -nE '\b(TODO|FIXME|XXX|HACK)\b' 2>/dev/null
  echo "$S" | xargs grep -nE 'catch\s*(\([^)]*\))?\s*\{\s*\}' 2>/dev/null           # catch vuoti
  ```
- **G. Script del progetto**, già cablati: quelli di `package.json` che corrispondono a `lint*`, `typecheck*` e `build*` (i `test*` alla voce H). Eseguili e di' quali hanno girato, con l'esito.
- **H. Suite di test** (non in `quick`): lo script `test*` del progetto. Conta i file di test senza eseguirli (`git ls-files | grep -E '\.(test|spec)\.[cm]?[jt]s$' | wc -l`, o `jest --listTests`) e confrontali con le suite che il run riporta: un totale inferiore è una suite incompleta, da capire prima di dichiarare verde. Se c'è uno script di copertura, eseguilo e riporta la copertura per cartella.
  > La copertura non misurata è il posto dove vivono i difetti gravi. Su un prodotto reale, i tre difetti più gravi di un ciclo d'audit stavano tutti nell'area meno coperta: non erano nascosti, erano **non misurati**. Prima di dire che un'area è sana, di' quanta di essa un test esegue.
- **I. Customizing cablato**, solo come smoke test (l'audit vero è `/nova-enforce-customizing`): insiemi di stati letterali e soglie numeriche nel codice del servizio.
  ```bash
  git ls-files 'srv/*' | grep -E '\.(js|ts)$' | grep -vE '\.test\.|/test/' | xargs grep -nE "new Set\(\[\s*['\"][A-Z][A-Z_]{2,}['\"]|[<>]=?\s*[0-9]+\.[0-9]+\b" 2>/dev/null | head -10
  ```
- **J. abap**: ATC con `SAPDiagnose` sul package dello sviluppo, con la variante del progetto (quella Clean Core se il piano ha `sap-clean-core-atc`: il dettaglio è del suo passo del playbook); abaplint dove configurato (`abaplint.json`), o `SAPLint`; ABAP Unit con `SAPDiagnose` (non in `quick`).

### Fase 3 — Revisione specialistica per area

Non in `quick`. Un agente per voce, tutti in un messaggio; ogni prompt dice «solo revisione, nessuna correzione», chiede `file:riga`, al massimo dieci problemi con gravità alta, media o bassa, un voto, circa 400 parole.

1. **UI5 e Fiori** (non con `cap`, `abap`): le app scoperte, per nome, con la versione UI5 misurata e il linguaggio (TypeScript o JavaScript).
2. **Prestazioni CAP** (non con `ui5`): N+1, `SELECT` evitabili, `forUpdate` mancante nelle azioni di ciclo di vita, `cds.tx` usate male, chiamate remote senza timeout o circuit breaker.
3. **Architettura CAP** (non con `ui5`): organizzazione di `srv/`, separazione fra entità, servizio e handler, il layer di accesso ai dati se c'è, draft dove serve, factory di adapter se ci sono.
4. **Fiori elements** (non con `cap`, `abap`): floorplan, annotazioni (i file `.cds` con `@UI.`, misurati con `git ls-files '*.cds' | xargs grep -l '@UI\.'`), value help, UX del draft.
5. **Piattaforma BTP** (non con `ui5`, `cap`): destination, setup di XSUAA o IAS (la matrice è di `/nova-security-matrix`), log di audit, resilienza, variabili d'ambiente, `cds.log`.
6. **Contratto OData** (non con `ui5`), `sap-api-style`: il servizio principale, cioè quello con più entità nel modello compilato; nomi di entità e azioni, metadati di ciclo di vita e deprecazione; e le rotture rispetto al ramo di default, misurate in un solo comando dalla cartella del progetto CAP (se il riferimento manca, prima `git fetch origin <ramo di default>`):
   ```bash
   contratto() { node -e '
   const cds = require("@sap/cds");
   cds.load("*").then(csn => { const D = csn.definitions;
     for (const s of Object.keys(D).filter(n => D[n].kind === "service" && !D[n]["@cds.external"])) for (const n of Object.keys(D).filter(n => n.startsWith(s + "."))) { const e = D[n];
       for (const el of Object.keys(e.elements ?? {})) console.log(n + "." + el);
       for (const [a, x] of Object.entries(e.actions ?? {})) console.log(n + "/" + a + "(" + Object.keys(x.params ?? {}).join(",") + ")");
       if (/^(action|function)$/.test(e.kind)) console.log(n + "(" + Object.keys(e.params ?? {}).join(",") + ")") } })' | sort; }
   N="$PWD/node_modules" P=$(git rev-parse --show-prefix) T=$(mktemp -d) && git worktree add -q "$T/base" "origin/<ramo di default>"
   (cd "$T/base/$P" && NODE_PATH="$N" contratto) > "$T/base.txt"; contratto > "$T/head.txt"
   comm -23 "$T/base.txt" "$T/head.txt"      # tolti o cambiati: breaking
   git worktree remove --force "$T/base" && rm -rf "$T"
   ```
   Provato su un modello di prova: un elemento escluso dalla proiezione e un parametro aggiunto a un'azione escono entrambi come rotture, il modello invariato non ne dà nessuna.
7. **ABAP e RAP** (solo con lo stack `abap`): behavior e implementazione (`lock master`, `etag master`, determinazioni e validazioni, EML dentro i cicli, nessun `COMMIT WORK` negli handler, perché la LUW è del framework), modellazione CDS (`sap-abap-cds`), SQL lento (`debug-slow-sql`).
8. **Storia recente**, `code-review`: gli ultimi dieci commit, per sicurezza (injection, bypass di autorizzazione, leak), correttezza (race, draft, macchina a stati) e rotture del contratto OData; solo gravità alta e media.

### Fase 4 — Controlli specifici CAP

Non con l'ambito `ui5`. Su uno stack `abap` senza CAP vale solo il punto 4, per la LUW di RAP.

1. **Modello**: entità e servizi con `search_model` del server `cap-js`; confrontali con il rapporto precedente e con la documentazione del repository che dichiara dei numeri: una documentazione che dice N e un modello che ne ha M è un finding di documentazione.
2. **Profili**: quelli dichiarati in `package.json` (`cds`) e in `.cdsrc.json`, e per ognuno l'autenticazione risolta (`CDS_ENV=<profilo> node -e 'console.log(require("@sap/cds").env.requires.auth?.kind)'`); un profilo di deploy con `mocked`, `basic` o `dummy` è critico. Trappola misurata: con `CDS_ENV` impostato e `NODE_ENV` diverso da `production`, CAP aggiunge da sé il profilo `development`. I percorsi di deploy nel dettaglio sono di `/nova-security-matrix`.
3. **Build di produzione**: `cds build --production` (serve `@sap/cds-dk`); scrive `gen/`, che git deve ignorare, altrimenti è un finding.
4. **Transazioni e concorrenza**: ogni lettura che precede una scrittura sullo stesso dato prende il lock? Ogni effetto collaterale è dentro o fuori dalla transazione?
   > Trappola misurata: uno stato di **errore** scritto dentro la transazione della richiesta viene **annullato** dal rollback: l'operatore non distingue «mai tentato» da «fallito». Va persistito fuori dalla transazione fallita.

   > Seconda, sulla stessa classe: quando due percorsi scrivono le stesse colonne, la coerenza va **imposta** con una scrittura condizionale sullo stato, non con un `if` in uno dei due: il percorso senza guardia è quello che se ne dimentica.

   Per l'`abap`: la LUW di RAP si annulla tutta insieme, e uno stato di errore scritto dentro sparisce con lei.

### Fase 5 — Controlli di dominio

Non con `ui5`, `quick`. Solo i domini che il repository ha, misurati; un dominio assente è una riga «non presente (misura: …)», mai silenzio. Per ognuno invoca la skill, estrai i suoi criteri, confrontali con il codice e riporta solo le violazioni, con `file:riga`.

| Dominio | Si applica se | Skill (categoria) | Verifica |
|---|---|---|---|
| Job schedulati | `@sap/jobs-client` o un job scheduler in `mta.yaml` o nel chart, manifesti `CronJob`, handler di job | `sap-btp-job-scheduling` (C16) | idempotenza, protezione dalla sovrapposizione, retry con backoff, fallimenti visibili in una storia delle esecuzioni; l'elenco dei job avviabili a mano derivato dal registro dei job, non copiato |
| Trasporti | Cloud Transport Management nel `mta.yaml` o nella pipeline; per l'`abap`, CTS o gCTS | `sap-btp-cloud-transport-management`, `sap-transport-review` (C16) | quality gate prima dell'import, ripiego sicuro quando il servizio non c'è |
| Integrazione e messaggi | messaging in `cds.requires`, Integration Suite, webhook in ingresso | `sap-btp-connectivity`, `sap-api-policy` (C09) | gestione degli errori, retry, idempotenza, credenziali e certificati fuori dal codice |
| Servizi remoti | voci di `cds.requires` con `kind` `odata`, `rest` o `hcql`, modelli in `srv/external/` | `cap-add-remote-service` (C07), `sap-btp-connectivity` (C09) | destination e non URL cablati; utente tecnico o propagazione del principal, dichiarati; timeout; mock solo in sviluppo. Le API rilasciate sono di `/nova-check-clean-level-a` |
| AI | `@sap-ai-sdk/*` o AI Core nel `mta.yaml` o nel chart | `sap-ai-pathfinder`, `sap-cloud-sdk-ai` (C11) | deployment e resilienza, costi, ripiego quando il servizio è spento, dati personali verso il modello |
| HANA | `@cap-js/hana`, artefatti `db/src/*.hdb*`, migrazioni SQL | `sap-cap-capire` (C07) per HDI; per SQLScript nessuna skill del catalogo: quella del piano, o `TOOL UNAVAILABLE` | migrazioni idempotenti e con auto-controllo, compatibili con HDI; con migrazioni per più database, serie coerenti fra loro |
| Contratti ABAP custom consumati | modelli in `srv/external/` importati da servizi custom del sistema | `sap-abap-cds` (C08) | stabilità del contratto e rischio all'upgrade |

### Fase 6 — Best practice della piattaforma

Non con `ui5`, `domain`, `quick`. Invoca le skill che lo stack giustifica: `sap-btp-cloud-platform`, `sap-btp-cloud-logging`, `sap-btp-connectivity`, `sap-cap-best-practices` (o `sap-cap-capire`), `cap-operator` per Kyma, `sap-cap-ci-gates-pattern` per la CI. Per ognuna confronta i suoi criteri con i finding delle Fasi 2–5: le violazioni che restano sono `PRINCIPLE MISMATCH`, con il file.

### Fase 7 — Dipendenze e sicurezza

1. **Deriva e aggiornamenti**: `sap-dependency-security` su `package.json`, con l'esito della Fase 1.
   > Trappola misurata: un flag che sopprime i conflitti fra dipendenze non *avvisa*: li **disattiva**. Un'installazione può uscire con successo e senza una riga di output mentre il grafo è incoerente (`--legacy-peer-deps` nei workflow o nel `Dockerfile` ne è la forma comune).

   Due varianti della stessa classe, misurate: un raggruppamento automatico degli aggiornamenti «non breaking» lo è per configurazione, non per misura, e su un pacchetto `0.x` un minor è un major; due major dello stesso pacchetto possono convivere annidati, e un `npm install --dry-run` che risponde `add` invece di `change` è il segnale.
2. **Vulnerabilità**: `npm audit --omit=dev --json` per ogni `package.json` con lockfile (radice e app). Per ognuna: è raggiungibile dal codice? Un rischio accettato si scrive con la ragione, non si tace. `npm audit fix --force` non è una correzione: cambia major.
3. **Lockfile**: `lockfile-lint --path package-lock.json --allowed-hosts npm --validate-https`; il lockfile è committato e la CI installa con `npm ci`.
4. **SBOM**: `cyclonedx-npm --output-file <cartella temporanea>/sbom.json`; nel percorso del passo `SUPPLY_CHAIN` solo se il playbook lo chiede.
5. **Scanner dei segreti**: se il repository ne ha la configurazione (`.gitleaks.toml` o simile), un workflow lo esegue davvero: la configurazione da sola non scansiona niente.
6. **Revisione di sicurezza del diff**: `security-review` sulle modifiche del ramo corrente (non in `quick`).
7. La matrice completa (OWASP, ASVS, NIST, CIS, SAP Secure Operations Map) è di `/nova-security-matrix`: rimanda, non replicarla.

**abap**: `npm audit` vale solo per le app UI del repository git; le dipendenze ABAP (APACK, `.apack-manifest.xml`) si elencano, e le vulnerabilità SAP si verificano sulle SAP Note (`sap-docs`).

### Fase 8 — Revisione formale del diff

Solo se il ramo corrente non è quello di default: `code-review` su tutte le modifiche del ramo rispetto al default, e una rilettura avversariale: che cosa lo farebbe respingere? Altrimenti scrivi «nessun ramo di lavoro: revisione del diff saltata».

### Fase 9 — Gate di verifica

La fase più importante, e nessuno strumento la sostituisce: ogni affermazione del rapporto deve stare su un output reale.

- ogni `PASSA` ha il comando eseguito e il suo codice di uscita;
- ogni voto ha i numeri che lo giustificano;
- ogni fase saltata è dichiarata, mai il silenzio;
- nessun numero preso dalla documentazione o da un rapporto precedente come misura di questo run.

Un'affermazione che non regge scende a `NON VERIFICATO` prima della consegna.

## Correzioni (`fix`)

- Mai sul ramo di default: un ramo dedicato, con la convenzione del profilo (`BRANCH_CONVENTION`).
- Mai file già modificati da altri, salvo richiesta esplicita.
- Solo quick win: impatto locale e reversibile, pochi file, nessuna migrazione di dati, nessun contratto di servizio nuovo, nessuna decisione di prodotto (ruoli, separazione dei compiti, stati del processo), nessuna credenziale reale.
- Correzioni in parallelo solo su file disgiunti: si raggruppa per proprietario del file, non per tema.
- Ogni finding chiuso porta il test o il gate che lo tiene chiuso, con la prova di sensibilità.
- Test e compilazione mirati, commit con il trailer del profilo, push e pull request. Niente `[skip ci]`.

Senza `fix` il comando non corregge niente: le correzioni si chiedono. Ammesse, sui finding verificati delle aree di questo comando: `console.*` sostituito da `cds.log`; un `catch` vuoto che registra e rilancia; bundle i18n, `minUI5Version` e versione del bootstrap riallineati; un'API deprecata con il sostituto documentato uno a uno (le skill `fix-*`); `gen/` e gli altri prodotti di build in `.gitignore`; l'elenco delle app di uno script sostituito dalla scoperta. Non ammesse, e quindi nel piano: i major delle dipendenze (una divergenza di range è una decisione), `npm audit fix --force`, le correzioni nelle aree dei comandi dedicati (si fanno con il loro `fix`), test disattivati o saltati, regole del linter soppresse senza una ragione scritta, cambi al contratto OData.

## Esito

Il rapporto, con le fasi non eseguite dichiarate:

```markdown
# Audit completo dello stack · <PROJECT_NAME> · <aaaa-mm-gg> · ramo <nome>

## Sommario
- Voto A|B|C|D, con il criterio: A = nessun critico o alto aperto e tutte le fasi eseguite; B = nessun critico, gli alti con un piano;
  C = un critico aperto, o build o test rossi; D = più critici, o gate non eseguibili per l'ambiente
- Critici N · Alti N · Medi N · Bassi N
- Build: modello OK/FAIL (warning N) · build di produzione OK/FAIL
- Test: N/N verdi, N suite su N file di test (rapporto precedente: …)
- Tipi: N errori (delta sul rapporto precedente)
- Ambiente: dipendenze allineate sì/no

## Infrastruttura
modello · tipi per app · suite · delta · customizing cablato (smoke test) · deriva delle dipendenze

## UI5 e Fiori — una riga per app scoperta
| App | Tipo (FE, freestyle) | Linter | Manifest | i18n | minUI5Version · framework · bootstrap | ESLint | Note |

## Backend (CAP o ABAP)
modello (entità e servizi misurati) · servizi · prestazioni · architettura · transazioni · contratto OData

## Controlli di dominio
| Dominio | Presente (misura) | Skill | Esito | Finding |

## Piattaforma: BTP, deploy, log, connettività
| Skill | PRINCIPLE MISMATCH | File |

## Dipendenze e sicurezza
deriva · vulnerabilità · lockfile · SBOM · scanner dei segreti in CI · security-review del diff · rimando a /nova-security-matrix

## Audit dedicati (non duplicati qui)
| Area | Comando | Esito sintetico (ultimo rapporto, con la data) |

## Critici, alti, medi, quick win
1. … (file:riga)

## Fasi non eseguite
| Fase | Motivo (quick, TOOL UNAVAILABLE, ambito) | Impatto sulla completezza |

## Finding per fase
```

Poi, sempre:

- **Rapporto** in `AUDIT_DIR/<aaaa-mm-gg>-<nome-del-comando>.md`, nella lingua `REPORT_LANG`, con `file:riga` come link. Ogni finding ha cinque parti: dove (`file:riga` o il comando che l'ha prodotto), impatto su un utente o su un dato, evidenza (l'output, il numero, la riga), azione, quick win sì/no.
- **Registro dei pendenti** (`PENDING_REGISTER`): i finding già registrati cambiano stato (`Chiuso`, `Ancora aperto`, `Parzialmente corretto`, `Superato`, `Rinviato`) con l'evidenza; i nuovi si aggiungono. Non si cancella niente.
- **Costo**: tempo per fase, cosa non è stato eseguito e perché.
- **Playbook**: se il comando gira per un passo del playbook NOVA, chiudilo solo se l'esito lo consente, con `node .claude/nova/install.mjs done <PASSO> --evidence "<rapporto>: <esito in una riga>"`. Con finding bloccanti aperti il passo resta aperto.

## Regole

1. **Mai una lista scritta a mano** di app, servizi o numeri: le app si scoprono da git, i numeri si misurano in questo run; le cifre dei rapporti precedenti servono da confronto, non da sostituto della misura.
2. **Prima l'ambiente, poi i gate**: un blocker di ambiente si dichiara in testa, e gli esiti che dipendono da esso si leggono come inaffidabili.
3. **In parallelo** le chiamate della Fase 2 e gli agenti della Fase 3, ognuno in un solo messaggio (in sequenza se il runtime non ha agenti); ogni agente ha al massimo dieci minuti, poi è `TIMEOUT` e si prosegue.
4. **Un finding solo** quando due agenti trovano la stessa cosa: la descrizione più ricca, con entrambe le fonti.
5. **Non duplicare** `/nova-security-matrix`, `/nova-check-clean-level-a`, `/nova-app-audit`, `/nova-ux-quality`, `/nova-text-polish`, `/nova-enforce-customizing` e `/nova-check-matrix`: rimanda al loro rapporto.
6. **Uno strumento che manca non ferma l'audit**: `TOOL UNAVAILABLE` con l'impatto, e si prosegue con il resto; ogni fase saltata va nella sezione *Fasi non eseguite*.
