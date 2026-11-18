---
description: Esegue in ordine tutti gli audit che si applicano allo sviluppo — una sola baseline dei gate, gli stadi nell'ordine delle loro dipendenze, i finding deduplicati e verificati, un solo rapporto con un solo giudizio.
argument-hint: "[all|fast|security|ui|store|<comando>] [report|fix|candidate]"
---

Esegue la batteria degli audit NOVA in un solo passaggio ordinato. Lanciati a mano, gli audit rimisurano gli stessi gate, riportano lo stesso difetto con parole diverse e, fuori ordine, producono finding fantasma o si perdono a vicenda: qui c'è **una misura, un ordine, un rapporto**. È il comando del passo `RELEASE_AUDIT` del playbook (categoria C17), che si chiude solo senza finding bloccanti aperti.

Comando generico del toolkit NOVA, derivato da `nova-audit-all` di un prodotto CAP + Fiori elements: i valori del progetto non sono scritti qui, si leggono o si misurano a ogni esecuzione.

## Argomento: $ARGUMENTS

```text
[scope] [modo]
```

**Scope**

- vuoto o `all` → tutti gli stadi che si applicano al profilo dello sviluppo, compreso il gate di pubblicazione se il profilo ha un canale;
- `fast` → Stadio 0 e Stadio 1, gli audit indipendenti: il giro prima di una PR su un'area sensibile. Non dichiara la prontezza alla pubblicazione;
- `security` → Stadio 0, `/nova-security-matrix` e, se si applica, `/nova-check-clean-level-a`;
- `ui` → Stadio 0, `/nova-app-audit`, `/nova-ux-quality` e `/nova-text-polish`;
- `store` → Stadio 0 e `/nova-sap-store-compliance`. È una diagnosi: senza i rapporti degli audit a monte sullo stesso commit, sullo stesso artefatto e con lo stesso digest della SBOM non può dare `READY`, e il verdetto è `STOP-SHIP` se trova un blocker, altrimenti `NOT ASSESSABLE`;
- `<comando>` → un solo audit, con la baseline dello Stadio 0: il nome senza `/`, con o senza `nova-` (per esempio `security-matrix`).

**Modo**

- vuoto o `report` → analisi e rapporto unificato; il codice non cambia (default);
- `fix` → dopo il rapporto e la triage apre le correzioni (sezione *Correzioni*), su un ramo dedicato;
- `candidate` → sola lettura su una build candidata immutabile, con il gate di pubblicazione stretto: solo `all candidate` può dare `READY`, alle condizioni di `/nova-sap-store-compliance`. Senza pubblicazione sul SAP Store (`development.answers.SAP_STORE` `NO` o, senza manifest, `STORE_CHANNEL` `nessuno`) non c'è gate di pubblicazione: il run vale come `report` sul candidato, e lo dichiara.

Esempi: `/nova-audit-all` (tutto, solo rapporto: il passo `RELEASE_AUDIT` usa `all report`) · `/nova-audit-all fast` · `/nova-audit-all all fix` · `/nova-audit-all app-audit` · `/nova-audit-all all candidate` (il gate finale sulla build candidata). Cadenza: completo prima di ogni rilascio, `fast` prima di una PR su un'area sensibile, completo con `fix` a intervalli regolari rileggendo i finding ancora aperti del registro.

Misurato su un altro prodotto: ~5 min la baseline, ~25 min lo Stadio 1 in parallelo, ~100–115 min il giro `report` completo. Non è una promessa: il costo di questo run si misura e si dichiara.

## Contesto — Fase 0, sempre

Prima di giudicare, leggi e misura. Non chiedere all'utente ciò che il repository o lo sviluppo NOVA già dicono, e non usare una lista scritta a mano dove si può derivare. Quello che resta da chiedere lo chiedi con lo strumento AskUserQuestion, a scelta: da 2 a 4 opzioni con i valori misurati o ammessi, la consigliata per prima con «(consigliato)», fino a 4 domande per chiamata; senza lo strumento, un elenco numerato. Mai segreti.

1. **Lo sviluppo NOVA**, se il repository ha `.claude/nova/skills.manifest.json`:
   - `development`: tipologia, target e release, modalità (nuovo o modifica; per una modifica, `change` con lo sviluppo esistente, il sistema sorgente, il percorso e il livello Clean Core obiettivo) `profile`, le risposte del profilo in parole, e `answers`, le stesse in codici (per esempio `SAP_STORE` e `PROCESS`, `YES` o `NO`): su quelle si decide che cosa si applica;
   - la richiesta, in `.claude/nova/REQUEST.md`: cosa deve fare l'applicazione, per chi, con quali regole. È il **dominio**: distingue un difetto di dominio da uno di stile;
   - le skill del piano: le voci di `items`, con le loro `categories`. Per ogni area usa quelle installate (sezione *Skill e MCP*);
   - il passo del playbook per cui il comando gira: `node .claude/nova/install.mjs status`.

   Senza manifest il comando vale lo stesso: dichiaralo nel rapporto e ricava tutto dal repository.
2. **Il profilo d'audit**, `docs/audit/AUDIT_PROFILE.md`: le decisioni che il codice non dice. Questo comando usa `PROJECT_NAME`, `REPORT_LANG`, `AUDIT_DIR`, `PENDING_REGISTER`, `PROCESS_PHASES` e `STORE_CHANNEL` (per decidere gli stadi) e, in `fix`, `BRANCH_CONVENTION` e `COMMIT_TRAILER`; le chiavi degli stadi le raccoglie tutte insieme allo Stadio 0. Se il file manca, esegui prima `/nova-audit-profile`; se manca solo una chiave, chiedila e aggiungila. Un valore del profilo che il repository smentisce è un finding, non un dato.
3. **Il repository**, misurato adesso:
   ```bash
   git rev-parse --show-toplevel && git branch --show-current && git log -1 --oneline
   git status --short                      # file già modificati da altri: non si toccano
   node -e "console.log(JSON.stringify(require('./package.json').scripts ?? {}, null, 1))" 2>/dev/null
   ```
   Poi ciò che decide quali audit si applicano:
   ```bash
   ls .claude/commands/nova-*.md 2>/dev/null                            # gli audit installati dal piano
   git ls-files | grep -E '(^|/)webapp/manifest\.json$' | sed -E 's#/webapp/manifest\.json$##' | sort -u
   git ls-files | grep -E '(^|/)\.abapgit\.xml$|\.(clas|ddls|bdef|srvd|srvb|ddlx|dcls)\.' | head -5
   node -e "const cds=require('@sap/cds');for(const [k,v] of Object.entries(cds.env.requires??{}))if(/^(odata|rest|hcql)/.test(v?.kind??''))console.log(k,v.kind,v.model??'',v.credentials?.destination??'')" 2>/dev/null
   git ls-files | grep -E '(^|/)webapp/manifest\.json$' | xargs grep -h '"uri"' 2>/dev/null | grep '/sap/opu/' | sort -u
   ```
   Da queste misure e dal profilo ricava il **piano degli stadi**:

   | Comando | Si applica se | Altrimenti, in *Audit non eseguiti* |
   |---|---|---|
   | `/nova-check-clean-level-a` | lo sviluppo consuma API di S/4HANA o di ERP (servizi remoti in `cds.requires`, `dataSources` delle app su `/sap/opu/`, il sistema sorgente di una modifica), oppure il target è S/4HANA (`S4_ONPREM`, `S4_PCE`, `S4_PUBLIC`) o `BTP_ABAP` | nessuna API esterna da verificare. Con target `ECC` e nessuna API remota, il livello Clean Core lo presidiano i passi ATC del playbook |
   | `/nova-security-matrix` · `/nova-sap-audit-full` | sempre | — |
   | `/nova-enforce-customizing` | lo sviluppo ha un backend suo: un servizio CAP o codice ABAP (come il passo `CUSTOMIZING_CHECK`) | solo interfaccia su un servizio esistente: i parametri non stanno in questo repository |
   | `/nova-check-matrix` | lo sviluppo ha un processo a fasi: `development.answers.PROCESS` è `YES` (senza manifest: `PROCESS_PHASES` non è `nessuno`) | nessun processo a fasi: la matrice uscirebbe vuota e sembrerebbe un successo |
   | `/nova-app-audit` · `/nova-ux-quality` · `/nova-text-polish` | lo sviluppo ha un'interfaccia: app scoperte da git, o un'app nel repository ABAP (la dichiara la riga «Interfaccia utente» del profilo, la trova Nova ARC-1) | nessuna interfaccia |
   | `/nova-sap-store-compliance` | lo sviluppo è un prodotto per il SAP Store: `development.answers.SAP_STORE` è `YES` (senza manifest: `STORE_CHANNEL` non è `nessuno`) | nessuna pubblicazione sul SAP Store |

   Un comando che si applica ma non è installato (`.claude/commands/<nome>.md` assente) non è un errore del run: va in *Audit non eseguiti* come «comando non installato dal piano», con l'impatto sulla completezza. Il piano installa la matrice delle fasi e i controlli del SAP Store solo con quelle risposte a `YES`: un profilo d'audit che le contraddice (per esempio `STORE_CHANNEL` `SAP Store` con `SAP_STORE` `NO`) è un finding, e vale il manifest.

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

Regola: **prima consulta, poi giudica.** Ogni stadio usa la sezione *Skill e MCP* del suo comando: passagliela insieme alla baseline. Usa le skill installate dal piano (voci `items` del manifest); una skill della tabella che il piano non ha non è un errore: di' quale hai usato al suo posto, oppure `TOOL UNAVAILABLE`.

Lo Stadio 0 costruisce una volta l'inventario `STRUMENTI` e lo passa a tutti: per ogni skill e server MCP del piano e delle tabelle degli stadi, se risolve **in questa sessione** (`node .claude/nova/install.mjs verify` per le voci del piano; per un server MCP, una chiamata di prova). Una skill è disponibile se la sua invocazione risolve, non se compare in un elenco. Trappola misurata su un prodotto reale: `ls .claude/skills` vede solo le skill del progetto, e una skill dichiarata assente così c'era; due elenchi presi a pochi minuti di distanza erano diversi.

| Se guardi… | Skill del catalogo (categoria) |
|---|---|
| Stadi e cluster di correzione in parallelo | `workflow-authoring` (C00, integrata), solo con l'opt-in (*Procedura*) |
| Clean Core Share KPI e livelli degli oggetti | `sap-clean-core-atc` · `sap-clean-core-expert` (C12), comando `/clean-core-ask` |
| Dipendenze e SBOM della baseline | `sap-dependency-security` (C13), CLI `npm audit`, `lockfile-lint`, `@cyclonedx/cyclonedx-npm` |
| Revisione delle correzioni (`fix`) | `code-review` · `simplify` (C14), `security-review` (C13) |
| Il gate che tiene chiuso un finding, cablato in CI | `sap-cap-ci-gates-pattern` (C16) |
| Il rapporto in un formato per chi approva il rilascio, se chiesto | `docx` · `pdf` (C18) |
| Tutto il resto | la sezione *Skill e MCP* del comando dello stadio |

MCP della baseline: `run_ui5_linter` del server MCP UI5 (`ui5-mcp-server`); `search_model` del server CAP (`cap-js`) per il modello compilato; SAPDiagnose del server `nova-arc-1` per ATC e ABAP Unit, in sola lettura; `github` per l'identità della build candidata (run CI, tag). Se uno strumento fallisce, prova l'istanza alternativa esposta nella sessione o dichiara `TOOL UNAVAILABLE`.

Trappola misurata su un prodotto reale: prima che ogni comando avesse la sua sezione di skill, l'audit delle app aveva girato per più cicli senza mai coprire l'accessibilità (zero occorrenze di `landmarkInfo`, `accessibleRole`, `ariaLabelledBy` nel repository), e l'audit di sicurezza mappava i framework normativi senza una sola skill di sicurezza.

## Procedura

### Le dipendenze fra gli audit, cioè il perché dell'ordine

| Audit | Dipende da | Perché |
|---|---|---|
| `/nova-check-clean-level-a` · `/nova-security-matrix` · `/nova-sap-audit-full` | solo dalla baseline | domini disgiunti (API esterne · autorizzazioni e sicurezza · stack): girano senza interferire |
| `/nova-check-matrix` · `/nova-enforce-customizing` | dal **modello compilato** e dall'inventario di entità e parametri | su un modello che non compila, o che è cambiato nel frattempo, producono finding falsi: vanno dopo la conferma che il modello compila |
| `/nova-app-audit` | dai finding sull'interfaccia di `/nova-sap-audit-full` | approfondisce per app ciò che `/nova-sap-audit-full` rileva a campione: lanciato prima, duplica il lavoro |
| `/nova-ux-quality` | da `/nova-app-audit` | guarda l'insieme delle app (coerenza, accessibilità) e tocca gli stessi file: dopo, mai in parallelo |
| `/nova-text-polish` | da `/nova-app-audit` e `/nova-ux-quality` | tocca gli stessi file (i18n, label, annotazioni): in parallelo si sovrascrivono. E un finding di testo può essere un difetto di contenuto già trovato da `/nova-app-audit` |
| `/nova-sap-store-compliance` | la baseline, i finding di tutti gli audit precedenti, le fonti correnti del canale | è il gate di pubblicazione trasversale: riconcilia requisiti, finding, evidenze e firme. Lanciato prima rimisura, o perde evidenze |

- Una dipendenza **dal risultato** di uno stadio (la baseline affidabile, il modello che compila) è bloccante: se manca, lo stadio salta e lo dichiari in *Audit non eseguiti*. Una dipendenza **dai finding** (quelli dell'interfaccia per `/nova-app-audit`) è un ingresso: se lo stadio che li produce è fuori scope o è fallito, lo stadio gira da solo e lo dichiara.
- Uno stadio **fallisce** quando non arriva al suo esito (strumento essenziale assente, errore, interruzione), non quando trova finding.

### Come gira uno stadio

- **Modalità incorporata.** Leggi `.claude/commands/<comando>.md` e seguine la procedura, con lo scope completo e il modo `report` qualunque sia il modo globale (per esempio `/nova-security-matrix all report`; se il suo *Argomento* chiama diversamente lo scope completo, usa quello). Passa al comando `BASELINE`, `STRUMENTI`, le chiavi del profilo già raccolte e i finding degli stadi da cui dipende. La sua Fase 0 legge la baseline e misura solo ciò che è suo; un comando che rimisura un gate è un difetto di questa regia: fermalo e usa il valore della baseline. Restituisce i finding nelle cinque parti del Metodo, con la gravità, e non scrive né rapporto né registro: li scrive questo comando, una volta.
- **Parallelismo.** Gli stadi marcati parallelizzabili girano in parallelo solo se il runtime ha lo strumento Workflow **e** l'utente ha dato esplicitamente l'opt-in all'orchestrazione multi-agente: l'opt-in lo dà l'utente, non si deduce. Altrimenti girano in sequenza, e il rapporto dichiara il tempo di ciascuno.

### Stadio 0 — Baseline unica (sempre)

Misura **una volta** e passa i risultati a tutti gli stadi. Nessuno stadio rimisura: se gli serve un valore, lo legge da qui.

1. **Le chiavi del profilo di tutti gli stadi.** Per ogni comando del piano degli stadi, leggi le chiavi che la sua Fase 0 dichiara (`grep -h 'Questo comando usa' .claude/commands/nova-*.md`) e chiedi quelle che mancano prima di partire, con AskUserQuestion (i candidati misurati come opzioni, fino a 4 per chiamata): nessuno stadio si ferma a metà per chiederne una.
2. **Gli strumenti**: l'inventario `STRUMENTI` (sezione *Skill e MCP*).
3. **I gate del progetto**, scoperti dagli script per nome, mai da un elenco:
   ```bash
   R=$PWD; OUT="${TMPDIR:-/tmp}/nova-audit-all-$(git rev-parse --short HEAD)"; mkdir -p "$OUT"   # fuori dal repository; ogni blocco che la usa la ridefinisce così: le variabili della shell non passano da un comando all'altro
   git status --short > "$OUT/status-prima.txt"
   node -e "const s=require(process.argv[1]).scripts??{};const g=Object.keys(s).filter(k=>/^(lint|test|typecheck|build)|typecheck/.test(k)&&!/watch|serve|start|deploy|open/.test(k+' '+s[k]));const radice=new Set(),ws={};for(const k of g)for(const c of s[k].split(/&&|\|\||;|\|/)){const m=c.match(/\bnpm\b.*?\brun(?:-script)?\s+([\w:.-]+)/);if(!m)continue;const n=m[1];const w=[...c.matchAll(/(?:^|\s)(?:--workspace|-w|--prefix)(?:=|\s+)(\S+)/g)].map(x=>x[1]);if(/(?:^|\s)(?:--workspaces|-ws)(?![^\s=])/.test(c))(ws[n]??=[]).push('tutte ('+k+')');else if(w.length)(ws[n]??=[]).push(w.join(',')+' ('+k+')');else if(n!==k)radice.add(n)}for(const k of g)console.log((radice.has(k)?'coperto':'esegui ')+'  '+k+'  '+s[k]);for(const[n,l]of Object.entries(ws))console.log('workspace  '+n+'  '+l.join('; '))" "$R/package.json"
   ```
   Esegui con `npm run <script>` ogni riga `esegui` (le `coperto` le lancia già uno script che le aggrega) e, con lo stesso filtro, gli script dei `package.json` delle app scoperte.
   La regola di `coperto`: uno script della radice è coperto solo se un altro gate della radice lancia **quello stesso script della radice**, cioè `npm run <nome>` senza `--workspace`/`-w`, `--workspaces`/`-ws` o `--prefix`. `npm run lint --workspace app/a` esegue il `lint` di `app/a`, non quello della radice: non copre `lint`, e il `lint` della radice si esegue (è lui che vede i file fuori dalle workspace, per esempio uno script in `scripts/`). Le righe `workspace <nome> <workspace> (<script>)` dicono quali workspace uno script della radice raggiunge: il gate di lint (o il gate configurato) copre le app solo se lancia i linter su **tutte** le workspace, con `--workspaces`/`-ws` (`tutte`) o con una `--workspace` per ognuna delle app scoperte; lo script di un'app che nessuna riga nomina si esegue a parte. Trappola misurata su un prodotto reale: `lint:apps` conteneva `npm run lint --workspace X`, la scoperta segnava `lint` come coperto e non lo eseguiva; uno script della radice con un top-level await rompeva `npm run lint`, e lo si è visto solo all'audit di rilascio. Per ognuno conserva comando, exit code, durata e l'ultima riga utile. Gli script esclusi, perché non terminano o scrivono fuori dal repository, si elencano come non eseguiti.
4. **Il modello e il contratto** (`cap`). Usa `cds` di `node_modules/.bin/` se c'è, altrimenti quello globale di `@sap/cds-dk`, e registra `cds version`:
   ```bash
   cds compile srv --to sql > /dev/null 2> "$OUT/cds-warning.txt"; echo "exit $?"   # tutto srv/, non un solo file
   grep -c '^\[WARNING\]' "$OUT/cds-warning.txt"
   cds compile srv app --to edmx -s all -o "$OUT/edmx"               # un EDMX per servizio, con le annotazioni delle app
   cds compile srv --to serviceinfo > "$OUT/servizi.json"             # servizi e percorsi: legano le app ai servizi
   ```
   Zero errori non basta: conta i warning. Un `annotate` su un elemento che non esiste viene scartato con un warning e con exit 0, e l'annotazione diventa un controllo che credi di avere e non hai.
5. **Le interfacce** (`fiori`): per ogni cartella `$a` di un'app scoperta, il linter UI5 con `run_ui5_linter` del server MCP UI5, oppure `(cd "$a" && "$R/node_modules/.bin/ui5lint")` (o il binario dell'app, se ha il suo `node_modules`). Conserva errori e warning per app, e che cosa il linter misura (trappola 1).
6. **Gli oggetti ABAP** (`abap`): con il server `nova-arc-1`, in sola lettura, SAPDiagnose `atc` sul package dello sviluppo con la variante Clean Core del sistema (quella registrata in `system-info.md` al passo `SYSTEM_CONTEXT`; `SAPDiagnose atc_variants` le elenca, e la variante non si deduce da un'esecuzione), e `unittest` sulle classi di test del package. Il package viene da `package.devc.xml` di abapGit, da `SAP_ALLOWED_PACKAGES` o da `change.objects` di una modifica; se nessuna fonte lo dice, chiedilo. Su ECC e su S/4HANA fino alla 2022 i controlli Clean Core sono remoti: `atc_remote` sul sistema dello sviluppo, con la variante proxy che punta a quella del sistema di controllo centrale, e `atc_results` per un risultato già salvato; li esegui tu, a lotti (al massimo 20 oggetti per `atc` e `atc_remote`, 50 package per `atc_ci`). Conserva i finding per priorità (1, 2, 3): servono al Clean Core Share KPI.
7. **Dipendenze e diff**:
   ```bash
   git ls-files | grep -E '(^|/)package-lock\.json$' | while read -r f; do echo "== $f"; (cd "$(dirname "$f")" && npm audit --omit=dev | tail -3); done
   git diff --check                                                      # e, su un ramo: git diff --check <ramo di default>...HEAD
   ```
8. **L'ambiente**, prima di fidarti dei numeri:
   ```bash
   node -e "const p=require('./package.json');for(const [k,v] of Object.entries({...p.dependencies,...p.devDependencies})){try{require('./node_modules/'+k+'/package.json')}catch(e){console.log('MISSING',k,v)}}"
   npm ls --depth=0 2>&1 | grep -E 'missing|invalid|ERR!'; ./node_modules/.bin/tsc --version 2>/dev/null
   ```
   Pacchetti `MISSING` o `invalid`, o uno strumento più vecchio di quello che la configurazione presuppone (un `tsconfig` con opzioni di una versione di TypeScript successiva a quella installata): il `node_modules` non è quello dichiarato. Trappola misurata su un prodotto reale: il controllo dei tipi moriva su un errore di versione del compilatore, e il gate sembrava rosso per errori di tipo senza aver misurato nulla. In `report` e `fix` esegui `npm ci` dal lockfile, con le impostazioni del progetto (`.npmrc`) e senza aggiungere flag che sopprimono i conflitti fra dipendenze (non avvisano: li disattivano), e ripeti lo Stadio 0; in `candidate` non installare nulla: l'ambiente non allineato blocca e il gate è `NOT ASSESSABLE`. **Non proseguire con una baseline non affidabile.**
9. **Dopo i gate**, il worktree è quello di prima: `git status --short | diff "$OUT/status-prima.txt" -`. Un gate che sporca il repository è un finding. Un gate già rosso va accertato su un checkout pulito dello stesso commit (`git worktree add "$OUT/pulito" HEAD`, con `node_modules` collegato, poi `git worktree remove`), non con `git stash`, che tocca i file degli altri, e dichiarato **pre-esistente**. Trappola misurata: senza questa verifica, il run successivo attribuisce il rosso a chi ha lavorato in mezzo.
10. **Solo in `candidate`, l'identità della build**: commit o tag immutabile, worktree pulito, ID del run CI (server `github`), digest SHA-256 dell'artefatto distribuibile (l'archivio MTA, o il digest dell'immagine) e della SBOM (`sbom.json` del passo `SUPPLY_CHAIN`). I tag si misurano sul remoto (`git ls-remote --tags origin`), non sul clone. Trappola misurata su un prodotto reale: un controllo dichiarava zero tag di rilascio su un prodotto che ne aveva uno, perché il clone non scaricava i tag. Senza queste evidenze il gate di pubblicazione è `NOT ASSESSABLE`.

Due regole valgono per tutti gli stadi: i binari si prendono da `node_modules/.bin/` quando ci sono; le app si scoprono da git, mai da una lista. Trappola misurata su un prodotto reale: dopo la fusione di due app, una cartella rimasta su disco senza essere tracciata faceva lintare a una lista statica un'app morta, e ne saltava due vive.

Esito dello Stadio 0: `BASELINE` = { sha, ramo, file già modificati, app, servizi, stack, gate (comando, exit code, durata, sintesi), compilazione (errori, warning, EDMX per servizio), linter per app, ATC e ABAP Unit, `npm audit`, `git diff --check`, ambiente (dipendenze, versioni), `STRUMENTI`, e in `candidate` tag, run CI, digest dell'artefatto e della SBOM }. La baseline va nel rapporto con lo SHA: un comando che la riusa dopo (per esempio `/nova-sap-store-compliance` al passo `STORE_READINESS`) la può riusare solo sullo stesso commit, con lo stesso worktree.

**Riuso.** Nel passo `RELEASE_AUDIT` un audit che un passo precedente ha già eseguito (`APP_AUDIT`, `/nova-ux-quality` in `E2E_A11Y`, `I18N_COMPLETENESS`) non si rilancia se dal commit del suo rapporto i file che misura non sono cambiati (`git diff --quiet <commit> HEAD -- <percorsi>`): entra nel giudizio con il suo rapporto e il suo commit. Si rilanciano solo gli audit il cui codice è cambiato e quelli che nessun passo ha eseguito.

### Stadio 1 — Audit indipendenti (parallelizzabili)

1. `/nova-check-clean-level-a`, se si applica: API esterne consumate, stato di rilascio per edizione, risoluzione a runtime, Clean Core Share KPI.
2. `/nova-security-matrix`: autorizzazioni, separazione dei compiti, segregazione dei dati, segreti, superficie, framework del profilo.
3. `/nova-sap-audit-full`: lo stack (interfaccia, servizio, piattaforma, dipendenze, revisione del diff). I suoi finding sull'interfaccia sono l'ingresso dello Stadio 3.

Domini disgiunti e nessuna scrittura: è il candidato naturale al parallelismo.

### Stadio 2 — Audit che dipendono dal modello (parallelizzabili fra loro)

Solo se la baseline dice che il modello compila (`cap`: `cds compile` senza errori; `abap`: oggetti attivi e senza errori di sintassi). Altrimenti salta entrambi e dichiaralo.

4. `/nova-check-matrix`, sulle fasi di `PROCESS_PHASES`: fase × controllo × stato × ruolo.
5. `/nova-enforce-customizing`: cablato contro configurabile, nei due versi.

### Stadio 3 — Interfacce, in sequenza

6. `/nova-app-audit <app> report` per ogni app scoperta allo Stadio 0, con i finding sull'interfaccia di `/nova-sap-audit-full` come ingresso: questo stadio li **approfondisce**, non li riscopre. Con il modello che non compila gira lo stesso, ma il contratto fra interfaccia e servizio resta `NON VERIFICATO`.
7. `/nova-ux-quality`, dopo l'ultima app: coerenza fra le app e accessibilità, con strumenti che girano. Trappola misurata su un prodotto reale: uno scan di accessibilità con un solo caricamento per app, sulla pagina d'ingresso, non misurava le pagine di dettaglio, dove vivono i frammenti custom; il rapporto dice quante schermate sono state visitate davvero.

### Stadio 4 — Testi, in coda

8. `/nova-text-polish`, mai in parallelo con lo Stadio 3, con i finding di `/nova-app-audit` come ingresso.

### Stadio 5 — Gate di pubblicazione (per ultimo, solo per un prodotto del SAP Store)

9. `/nova-sap-store-compliance all <modo>`: `candidate` solo se il modo globale è `candidate`, `report` se è `report` o `fix`. Passagli la baseline e tutti i finding, con l'istruzione esplicita di **riusarli e non rilanciarli**: aggiunge solo i controlli del canale (requisiti correnti dalle fonti ufficiali, evidenze a runtime, documenti, firme). In modalità incorporata restituisce la sua matrice e il verdetto, senza un secondo rapporto. Se la baseline ha uno scan di accessibilità con due profili (l'inventario completo e il preset bloccante), non fondere i due denominatori e non contare più volte i tentativi ripetuti.

Il verdetto `READY | STOP-SHIP | NOT ASSESSABLE` resta distinto dal rating A–D: un rating A non compensa un solo `STOP-SHIP`. Lo scope `fast` salta questo stadio e non può dichiarare la prontezza alla pubblicazione.

### Stadio 6 — Consolidamento

A. **Deduplica.** Due finding sono lo stesso difetto se puntano allo stesso `file:riga` (±5 righe) o descrivono la stessa causa in file diversi. Tieni la descrizione più ricca e somma le fonti in `reportedBy: [comando, …]`: un difetto riportato da tre comandi è **uno**, con confidenza più alta. Dichiara quanti ne hai fusi.

B. **Triage.** Scala comune: `CRITICAL` · `HIGH` · `MEDIUM` · `LOW`; i comandi che usano P1/P2/P3 si convertono in HIGH/MEDIUM/LOW, e un P1 diventa CRITICAL solo se la triage conferma perdita o esposizione di dati. Prima del rating leggi il codice reale di ogni CRITICAL e HIGH. Trappola misurata su un prodotto reale: su tre CRITICAL riportati uno era allucinato (citava entità assenti da un file che ne espone una sola), e un'etichetta di livello Clean Core si è rivelata infondata. Ogni finding porta `Verificato: sì/no` e un verdetto: `confermato`, `falso positivo` (resta nel rapporto con la prova, non entra aperto nel registro) o `da decidere`.

C. **Un solo rating**, calcolato sui finding verificati e aperti, con la formula scritta nel rapporto:
   - per ogni dominio, la prima che si applica: `D` se c'è almeno un CRITICAL; `C` se c'è almeno un HIGH; `B` se c'è almeno un MEDIUM o un controllo `NON VERIFICATO`; altrimenti `A` (solo LOW, o nessun finding);
   - il rating complessivo è il **peggiore** dei domini, non la media: una media che nasconde un CRITICAL è peggio di nessun rating;
   - se un audit che si applica non è stato eseguito (dipendenza non soddisfatta, comando non installato, `TOOL UNAVAILABLE`), il rating complessivo non può essere migliore di `B`.

   Per la parte Clean Core usa il **Clean Core Share KPI** di SAP Cloud ALM, non una scala ad hoc: la distribuzione degli oggetti custom fra i livelli A, B, C e D secondo l'ATC con la variante Clean Core (priorità 1 → D, 2 → C, 3 → B; senza finding, A per il codice ABAP Cloud e B per l'ABAP classico). Lo calcola `/nova-check-clean-level-a`: dall'ATC della baseline per il codice ABAP, dagli oggetti consumati per un'estensione side-by-side. Riportalo com'è, (A + B) / totale con i quattro conteggi, la base e la fonte; se lo stadio non è girato o il KPI non è calcolabile, «non calcolato: <motivo>». Il KPI non diventa una lettera: i finding Clean Core entrano nel rating con la loro gravità.

   **Bloccante**, per il passo `RELEASE_AUDIT`: un CRITICAL o un HIGH verificato e aperto, un gate della baseline rosso, un `STOP-SHIP` del gate di pubblicazione. Un finding bloccante esce dal conteggio solo chiuso con evidenza, o rinviato con una deroga approvata da una persona (chi, perché, fino a quando) scritta nel registro: la deroga non la decide il comando.

D. **Requisiti e playbook.** Per ogni criterio di accettazione di `.claude/nova/REQUEST.md` (e di `docs/specification.md`, se c'è), il test che lo copre, cercato nei test per identificativo o per testo del criterio, oppure `non coperto`: un criterio non coperto è un finding. Poi i passi di tipo gate del playbook (`node .claude/nova/install.mjs status --json`): chiusi con evidenza, aperti, saltati con il motivo. Un gate chiuso la cui evidenza è smentita dalla baseline è un finding.

## Correzioni (`fix`)

- Mai sul ramo di default: un ramo dedicato, con la convenzione del profilo (`BRANCH_CONVENTION`).
- Mai file già modificati da altri, salvo richiesta esplicita.
- Solo quick win: impatto locale e reversibile, pochi file, nessuna migrazione di dati, nessun contratto di servizio nuovo, nessuna decisione di prodotto (ruoli, separazione dei compiti, stati del processo), nessuna credenziale reale.
- Correzioni in parallelo solo su file disgiunti: si raggruppa per proprietario del file, non per tema.
- Ogni finding chiuso porta il test o il gate che lo tiene chiuso, con la prova di sensibilità.
- Test e compilazione mirati, commit con il trailer del profilo, push e pull request. Niente `[skip ci]`.

In più, per questo comando:

- Le correzioni si aprono dopo il rapporto e dopo la triage, e toccano solo finding `confermato`, compresi quelli del gate di pubblicazione. Valgono le regole di correzione del comando che ha trovato il finding: qui non si allarga ciò che un comando vieta.
- Un cluster per proprietario del file: un file appartiene a un solo cluster per run. I cluster girano in parallelo solo con la regola del parallelismo (*Procedura*), altrimenti uno alla volta.
- Ordine: CRITICAL → HIGH → MEDIUM → LOW, a wave. Dopo ogni wave rilancia i gate dello Stadio 0 che la wave tocca, almeno la compilazione e i test, prima di passare alla successiva.
- Rimisura mentre chiudi. Trappola misurata su un prodotto reale: sei letture rimisurate su sei sono cambiate, tre più gravi del riportato e tre meno gravi o false. La correzione di una lettura va in coda al rapporto, non al posto della riga sbagliata.
- Il verdetto di pubblicazione dopo le correzioni richiede una baseline nuova e completa: quella di prima non vale più.

## Esito

Un solo rapporto, `AUDIT_DIR/<aaaa-mm-gg>-nova-audit-all.md`, con queste sezioni:

```markdown
# <PROJECT_NAME> · Audit consolidato · <aaaa-mm-gg> · ramo <nome> · <sha>

## Baseline (misurata una volta, Stadio 0)
| Gate | Comando | Esito | Durata | Nota |
- ambiente: dipendenze allineate sì/no; versioni di cds, TypeScript, linter UI5
- app scoperte da git: N, più le cartelle non tracciate trovate su disco
- gate già rossi prima del run, accertati sul checkout pulito

## Piano degli stadi
| Stadio | Comando | Eseguito | In parallelo | Tempo |
- gate rimisurati dagli stadi: 0 (per costruzione)

## Rating unificato
- Rating: A|B|C|D, con la formula e il finding o il controllo che lo determina
- Clean Core Share KPI: (A + B) / totale, con A · B · C · D e la fonte, oppure «non calcolato: <motivo>»
- Per dominio: Clean Core · sicurezza · stack · processo · customizing · app · UX · testi

## Gate di pubblicazione (solo per un prodotto del SAP Store)
- Verdetto: READY | STOP-SHIP | NOT ASSESSABLE
- STOP-SHIP · evidenze esterne e firme mancanti · istantanea dei requisiti con la data

## Requisiti e playbook
| Criterio di accettazione | Test che lo copre | Esito |
| Passo del playbook | Stato | Evidenza |

## Finding consolidati (dopo la deduplica)
| # | Gravità | Titolo | file:riga | reportedBy | Verificato | Verdetto | Bloccante |

## Duplicati fusi
| Finding | Riportato da | Tenuto da |

## Audit non eseguiti
| Audit | Motivo (non si applica al profilo · scope · dipendenza non soddisfatta · comando non installato · TOOL UNAVAILABLE) | Impatto sulla completezza |

## Correzioni (solo fix)
| Finding | Cluster | Esito | File modificati | Test o gate |

## Dettaglio per stadio
Le sezioni di esito di ogni comando, in ordine di stadio.
```

Poi, sempre:

- **Rapporto** in `AUDIT_DIR/<aaaa-mm-gg>-<nome-del-comando>.md`, nella lingua `REPORT_LANG`, con `file:riga` come link. Ogni finding ha cinque parti: dove (`file:riga` o il comando che l'ha prodotto), impatto su un utente o su un dato, evidenza (l'output, il numero, la riga), azione, quick win sì/no.
- **Registro dei pendenti** (`PENDING_REGISTER`): i finding già registrati cambiano stato (`Chiuso`, `Ancora aperto`, `Parzialmente corretto`, `Superato`, `Rinviato`) con l'evidenza; i nuovi si aggiungono. Non si cancella niente.
- **Costo**: tempo per fase, cosa non è stato eseguito e perché.
- **Playbook**: se il comando gira per un passo del playbook NOVA, chiudilo solo se l'esito lo consente, con `node .claude/nova/install.mjs done <PASSO> --evidence "<rapporto>: <esito in una riga>"`. Con finding bloccanti aperti il passo resta aperto.

## Regole

1. **I gate si misurano una volta**, allo Stadio 0. Uno stadio che li rimisura è un difetto di questa regia, non una verifica in più.
2. **L'ordine non si negozia**: lo Stadio 2 solo con il modello che compila; `/nova-ux-quality` e `/nova-text-polish` mai in parallelo con `/nova-app-audit` né fra loro; il gate di pubblicazione per ultimo, sugli output di tutti gli altri.
3. **Gli stadi girano in `report`**, qualunque sia il modo globale: si corregge solo dopo il consolidamento e la triage.
4. **Nessun numero preso dalla documentazione.** Ogni cifra del rapporto viene da un comando eseguito in questo run o da un artefatto dello stesso candidato. Un delta fra documentazione e misura è un finding, non un refuso.
5. **Ogni audit non eseguito è dichiarato**, con il motivo e l'impatto sulla completezza, anche quello che non si applica al profilo.
6. **Un finding, una volta**: nel registro entra dopo la deduplica, con tutte le sue fonti in `reportedBy`.
7. **Idempotente in `report`**: rieseguibile senza effetti oltre al rapporto e al registro. L'unica eccezione è `npm ci` sull'ambiente non allineato dello Stadio 0, che tocca solo `node_modules` e si dichiara nel rapporto.
