---
description: Audit end-to-end di una singola app — prima i finding pendenti, poi percorso utente, contratto fra interfaccia e servizio fino al codice che lo applica, controlli mirati; corregge solo i quick win sicuri, su un ramo dedicato.
argument-hint: "<app|all> [report|no-fix|fix|pending-only]"
---

Esegue l'audit operativo di un'app dello sviluppo: controlla se i finding pendenti sono stati chiusi davvero, cerca problemi nuovi di UX, interfaccia, frontend e servizio seguendo ogni azione fino al codice che la applica, e corregge solo i quick win sicuri. È il comando del passo `APP_AUDIT` del playbook (categoria C14), che si chiude senza P1 aperti in nessuna app; `/nova-audit-all` lo usa per approfondire, app per app, i finding sull'interfaccia di `/nova-sap-audit-full`.

Comando generico del toolkit NOVA, derivato da `nova-app-audit` di un prodotto CAP + Fiori elements: i valori del progetto non sono scritti qui, si leggono o si misurano a ogni esecuzione.

## Argomento: $ARGUMENTS

```text
<app> [modo]
```

- `<app>`: la cartella di un'app scoperta (per esempio `app/ordini`) o la sua parte finale (`ordini`). Se due app finiscono allo stesso modo, chiedi quale, con quelle app come opzioni; se il nome non corrisponde a nessuna, elenca quelle scoperte e fermati. Con lo stack `abap` e l'app nel repository ABAP: il nome dell'app (BSP) o del service binding, trovato con Nova ARC-1.
- `all`: tutte le app scoperte, una dopo l'altra, in un solo rapporto.

**Modo**

- vuoto, `report` o `no-fix` → audit e rapporto, nessuna modifica al codice (default);
- `fix` → corregge i quick win sicuri su un ramo dedicato, con la sua PR;
- `pending-only` → verifica solo i finding pendenti dello scope e ne aggiorna lo stato.

Esempi: `/nova-app-audit ordini` · `/nova-app-audit app/ordini fix` · `/nova-app-audit approvazioni pending-only` · `/nova-app-audit all`. Il playbook lo lancia come `/nova-app-audit <app> report`, per ogni app.

## Contesto — Fase 0, sempre

Prima di giudicare, leggi e misura. Non chiedere all'utente ciò che il repository o lo sviluppo NOVA già dicono, e non usare una lista scritta a mano dove si può derivare. Quello che resta da chiedere lo chiedi con lo strumento AskUserQuestion, a scelta: da 2 a 4 opzioni con i valori misurati o ammessi, la consigliata per prima con «(consigliato)», fino a 4 domande per chiamata; senza lo strumento, un elenco numerato. Mai segreti.

1. **Lo sviluppo NOVA**, se il repository ha `.claude/nova/skills.manifest.json`:
   - `development`: tipologia, target e release, modalità (nuovo o modifica; per una modifica, `change` con lo sviluppo esistente, il sistema sorgente, il percorso e il livello Clean Core obiettivo) `profile`, le risposte del profilo in parole, e `answers`, le stesse in codici (per esempio `SAP_STORE` e `PROCESS`, `YES` o `NO`): su quelle si decide che cosa si applica;
   - la richiesta, in `.claude/nova/REQUEST.md`: cosa deve fare l'applicazione, per chi, con quali regole. È il **dominio**: distingue un difetto di dominio da uno di stile;
   - le skill del piano: le voci di `items`, con le loro `categories`. Per ogni area usa quelle installate (sezione *Skill e MCP*);
   - il passo del playbook per cui il comando gira: `node .claude/nova/install.mjs status`.

   Senza manifest il comando vale lo stesso: dichiaralo nel rapporto e ricava tutto dal repository.
2. **Il profilo d'audit**, `docs/audit/AUDIT_PROFILE.md`: le decisioni che il codice non dice. Questo comando usa `PROJECT_NAME`, `DOMAIN`, `REPORT_LANG`, `AUDIT_DIR`, `PENDING_REGISTER`, `TENANT_SCOPE_FIELD` e, in `fix`, `BRANCH_CONVENTION` e `COMMIT_TRAILER`; legge `STATUS_MACHINE` se c'è, senza chiederla. Se il file manca, esegui prima `/nova-audit-profile`; se manca solo una chiave, chiedila e aggiungila. Un valore del profilo che il repository smentisce è un finding, non un dato.
3. **Il repository**, misurato adesso:
   ```bash
   git rev-parse --show-toplevel && git branch --show-current && git log -1 --oneline
   git status --short                      # file già modificati da altri: non si toccano
   node -e "console.log(JSON.stringify(require('./package.json').scripts ?? {}, null, 1))" 2>/dev/null
   ```
   Poi le app e i servizi:
   ```bash
   OUT="${TMPDIR:-/tmp}/nova-app-audit-$(git rev-parse --short HEAD)"; mkdir -p "$OUT"   # fuori dal repository; ogni blocco che la usa la ridefinisce così: le variabili della shell non passano da un comando all'altro
   git ls-files | grep -E '(^|/)webapp/manifest\.json$' | sed -E 's#/webapp/manifest\.json$##' | sort -u > "$OUT/app.txt"
   find . -path '*/node_modules' -prune -o -path '*/webapp/manifest.json' -print | sed -E 's#^\./##; s#/webapp/manifest\.json$##' | sort -u > "$OUT/disco.txt"
   comm -13 "$OUT/app.txt" "$OUT/disco.txt"                             # cartelle d'app su disco e non tracciate: residui, non app
   cds compile srv --to serviceinfo 2>/dev/null                         # cap: i servizi e i loro percorsi
   ```
   Chiamato da `/nova-audit-all`, la baseline (EDMX per servizio, linter, typecheck, test) e l'inventario degli strumenti arrivano da lì: non rimisurarli, restituisci i finding e non scrivere né rapporto né registro.

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

Regola: **prima consulta, poi giudica.** Usa le skill installate dal piano (voci `items` del manifest); una skill della tabella che il piano non ha non è un errore: di' quale hai usato al suo posto, oppure `TOOL UNAVAILABLE`. Trappola misurata su un prodotto reale: questo audit è girato per più cicli senza uno strumento specialistico, e l'accessibilità delle app non è mai stata guardata; due difetti gravi (un `FlexibleColumnLayout` dichiarato nel descrittore e non attivo, un bundle di testi che nessuna delle chiamate che lo usavano risolveva) sono sopravvissuti a un linter verde su tutte le app.

| Se guardi… | Skill del catalogo (categoria) |
|---|---|
| Floorplan, linee guida Fiori, giudizio di design e coerenza visiva | `sap-fiori-guidelines` (C04) |
| Accessibilità: ARIA, WCAG, focus, tastiera, screen reader | `ui5-best-practices-accessibility` (C04) |
| Annotazioni e pagine di Fiori elements | `sap-fiori-app-development` (C05), con il server MCP `fiori-mcp` |
| Estensioni in `webapp/ext/`: controller extension, fragment, azioni e colonne custom | `fix-fiori-elements-extensions` (C05) |
| Filtri visuali, grafici analitici, tabelle ad albero | `sap-fiori-add-visual-filter` · `sap-fiori-analytical-chart` · `sap-fiori-tree-table` (C05) |
| Standard di codice UI5: caricamento asincrono, binding, CSP, tipi degli eventi in TypeScript | `ui5-best-practices` (C06) |
| Qualsiasi tabella (Responsive, Grid, Tree, MDC, Smart) | `ui5-best-practices-tables` (C06) |
| MDC: FilterBar, Chart, Field, ValueHelp, errori dei delegate | `ui5-best-practices-mdc` (C06) |
| `sap.ui.comp` (SmartField, SmartForm, SmartFilterBar) su OData V2 | `ui5-best-practices-smart-controls` (C06) |
| Conversione a TypeScript; CLI e riferimento SAPUI5 | `ui5-typescript-conversion` · `sapui5-cli` · `sapui5` (C06) |
| Modello CDS, annotazioni lato servizio, azioni bound, draft | `cap-developer` · `sap-cap-capire` (C07) |
| Anti-pattern di CAP con Fiori elements sullo stesso stack: draft che non salva, pulsante sempre grigio, chiave duplicata nelle tabelle di draft, CSP che blocca il live reload | `sap-cap-best-practices` (C07) |
| RAP: behavior definition, feature control, authorization master, determinazioni, validazioni, side effects | `generate-rap-logic` · `generate-rap-service-researched` · `explain-abap-code` (C08) |
| CDS ABAP, metadata extension, DCL; codice ABAP | `sap-abap-cds` · `sap-abap` (C08) |
| UI Integration Cards (`sap.card`), sandbox del launchpad | `ui5-best-practices-integration-cards` · `modernize-flp-sandbox` (C10) |
| Ruoli e identità (XSUAA, IAS), CSP | `sap-btp-cloud-identity-services` · `fix-csp-compliance` (C13) |
| Errori a runtime che il linter non riporta | `fix-linter-blind-spots` (C14) |
| `manifest.json`: versione, librerie, componenti, tipo di view | `fix-manifest-json` (C14) |
| API deprecate, globali, pseudo-moduli, HTML nativo nelle view XML | `fix-deprecated-controls` · `fix-partially-deprecated-apis` · `fix-js-globals` · `fix-xml-globals` · `fix-pseudo-modules` · `fix-xml-native-html` (C14) |
| Bootstrap, Component asincrono, renderer, init delle librerie, cicli fra moduli, row mode delle tabelle | `fix-bootstrap-params` · `fix-component-async` · `fix-control-renderer` · `fix-library-init` · `fix-cyclic-deps` · `fix-table-row-mode` (C14) |
| Modernizzazione dell'app; ESLint di Fiori | `modernize-ui5-app` · `sap-fiori-eslint-plugin` (C14) |
| Revisione del codice delle correzioni | `code-review` (C14, integrata) |
| Test: OPA5, QUnit, starter moderno, test del servizio | `sap-fiori-opa5-test-development` · `ui5-best-practices-opa5` · `ui5-best-practices-qunit` · `modernize-test-starter` · `generate-cap-cds-test` · `generate-abap-unit-test` (C15) |
| Accessibilità e design come revisione di un esperto | `design:accessibility-review`, se presente nella sessione: è una skill di plugin, fuori dal catalogo |

Sul perimetro di alcune:

- `modernize-flp-sandbox` ha materia solo nelle app con una sandbox del launchpad per i test (`webapp/test/flpConfig.*`, `initFLP.*`): contale con `git ls-files`. Un `index.html` standalone coerente con l'approuter di produzione non è un difetto.
- `modernize-test-starter`: un'app con sia `testsuite.qunit.html` sia `testsuite.qunit.js` è a metà strada; lo starter moderno usa solo il `.js`.
- `ui5-typescript-conversion`. Trappola misurata su un prodotto reale: convertito in `.ts`, il bootstrap della sandbox del launchpad non faceva più riportare al linter la deprecazione di `sap.ushell.bootstrap`. Una deroga così si tiene di proposito, e si dichiara.
- `ui5-best-practices-integration-cards`: una card costruita a runtime è superficie utente come le altre, e i workaround dichiarati nei commenti (un expression binding fra modelli, l'escape degli apici per il `BindingParser`) si riverificano, non si ereditano.

MCP da interrogare, non da indovinare:

- `run_ui5_linter` del server MCP UI5 (`ui5-mcp-server`): il lint reale sul percorso dell'app, non il ricordo di un gate.
- `run_manifest_validation`, obbligatorio su ogni manifest toccato: un `manifest.json` sbagliato non fa fallire la compilazione del servizio ma rompe l'app a runtime. Valida lo schema, non la semantica delle impostazioni di Fiori elements (trappola 2): per quelle, la documentazione SAP (server `sap-docs`) o `@sap/ux-specification`, se è fra le dipendenze.
- `get_api_reference`: firma e deprecazione di un controllo, prima di affermare che cosa espone. Può non risolvere i simboli `sap.fe.*`, per esempio quando `sap.fe` non è fra le librerie di `ui5.yaml`: ripiega sulla documentazione SAP e dillo.
- `get_guidelines` · `get_version_info`: sulla versione UI5 pinnata (da `ui5.yaml`, da `minUI5Version` o dal bootstrap); `ui5_version_diff` del server `sap-docs`, se lo espone, per che cosa è cambiato fra due versioni.
- `search_model` del server CAP (`cap-js`): interroga il modello **compilato**, non i `.cds`.
- `nova-arc-1`, per `abap`: SAPSearch per trovare gli oggetti, SAPRead per leggerne la versione **attiva**, SAPDiagnose per sintassi, ATC e ABAP Unit. L'audit legge soltanto: Nova ARC-1 può scrivere, ma le correzioni seguono le regole della modalità `fix`.
- `playwright`: per i finding marcati `VISUAL-QA`, quelli che solo un render mostra.

Se uno strumento fallisce, prova l'istanza alternativa esposta nella sessione o dichiara `TOOL UNAVAILABLE`, con l'impatto, e prosegui.

## Procedura

### Fase 0 — Pre-flight

1. **Risolvi l'app** dall'argomento sulla lista scoperta da git, mai da una lista scritta né da `ls`. Trappola misurata su un prodotto reale: una lista di app scritta a mano era sopravvissuta alla fusione di due app e alla cancellazione di una terza, e lintava un'app morta saltandone due vive. Una cartella su disco non tracciata da git non è un'app, è un residuo: dichiarala.
2. **File già modificati**: nello scope sono lavoro del team, non si sovrascrivono; fuori scope si ignorano.
3. **Mappa i file dell'app**:

   | Che cosa | `cap` + `fiori` | `abap` (Fiori elements su RAP) |
   |---|---|---|
   | descrittore | `webapp/manifest.json`: floorplan (`sap.fe.templates` = Fiori elements; routing su view proprie = freestyle), `dataSources`, versione UI5 | lo stesso, nel repository git o nel repository ABAP |
   | estensioni e testi | `webapp/ext/**`, `webapp/i18n/**` | gli stessi, più i testi degli oggetti (elementi dati, `@EndUserText`) |
   | annotazioni | l'`annotations.cds` dell'app, i file che fanno `annotate` sul servizio, `webapp/annotations/*.xml` | la metadata extension della projection |
   | servizio consumato | quello il cui `urlPath` (`serviceinfo`) corrisponde a `dataSources.mainService.uri` | service binding → service definition → CDS di projection |
   | logica | gli handler del servizio: `this.on`, `before`, `after`, le azioni | behavior definition e behavior pool: azioni, determinazioni, validazioni |
   | autorizzazioni | `@restrict` e `@requires` nel modello compilato, `xs-security.json` | `authorization master`, DCL (`DEFINE ROLE`), oggetti di autorizzazione |
   | test | i test del servizio, `webapp/test/**` | le classi ABAP Unit del behavior pool |

   ```bash
   APP=<cartella dell'app>
   node -e "const m=require(process.argv[1]);for(const [k,v] of Object.entries(m['sap.app'].dataSources??{}))console.log(k,v.uri,v.settings?.odataVersion??'')" "$PWD/$APP/webapp/manifest.json"
   ```
   Un'app su un servizio remoto (per esempio un `uri` su `/sap/opu/`) ha il contratto nel `$metadata` di quel servizio: l'EDMX importato nel repository o il sistema letto con Nova ARC-1. La catena della Fase 3 si ferma dove il repository finisce, e il resto è `NON VERIFICATO`.

### Fase 1 — Finding pendenti, prima di tutto

Leggi `PENDING_REGISTER`. Per ogni finding dello scope che non è `Chiuso` né `Superato`:

1. Rileggi il file e le righe indicate; se il codice si è spostato, ritrovalo per contenuto, non per numero di riga.
2. Verifica **sul contratto a runtime**, non sul sorgente:
   ```bash
   cds compile srv app --service <Servizio> --to edmx > "$OUT/<Servizio>.xml"    # cap: il contratto che l'app riceve
   grep -n -E 'OperationAvailable|SideEffects|<Action |<Function ' "$OUT/<Servizio>.xml" | head -40
   ```
   Per `abap`: la versione attiva di projection, behavior definition e metadata extension (SAPRead) e, se l'ambiente lo raggiunge, il `$metadata` del service binding. Un oggetto salvato e non attivato non è il runtime.
3. Per un finding sull'interfaccia guarda descrittore, EDMX, handler custom, testi i18n se c'è testo visibile, aggiornamento dopo l'azione.
4. Classifica: `Chiuso` (correzione effettiva e verificata), `Ancora aperto` (si riproduce), `Parzialmente corretto` (sorgente sì, runtime no: il caso più frequente e il più utile da trovare), `Superato` (non si applica più per un ridisegno: di' quale). Un `Rinviato` resta tale se la deroga è ancora valida.
5. In `fix`, un pendente che è un quick win sicuro si corregge qui.

Con `pending-only` il comando si ferma qui e passa all'*Esito*.

### Fase 2 — Percorso utente ed esperienza

Ricostruisci il percorso dell'utente, con i ruoli e le regole della richiesta: ingresso (List Report o pagina iniziale) → filtri e varianti → navigazione alla Object Page o al dettaglio → sezioni principali → azioni primarie e secondarie → aggiornamento dopo l'azione → gestione degli errori → stati vuoti → testi → comportamento su tablet e telefono, dove conta.

Controlla in particolare:

- **Azioni**: visibili ma non concesse (l'utente clicca e riceve un rifiuto); nascoste ma dovute (l'utente non sa che cosa fare e apre una segnalazione); pulsanti custom che scavalcano `DataFieldForAction` o duplicano un comando che Fiori elements genera già, come la modifica di un'entità con draft; azioni di massa su selezioni miste o non azionabili; fragment custom con handler non cablati.
- **Dopo l'azione**: un oggetto creato dall'azione (un workflow, un documento) che non si vede senza ricaricare; un aggiornamento che arriva solo in parte della pagina.
- **Informazione**: sezioni in cui l'informazione è lontana dal punto operativo in cui serve; eccezioni mostrate solo in una vista di monitoraggio e non anche nel punto del processo in cui si risolvono; stati da cui non si esce, perché nessuna transizione in uscita è un difetto latente anche se oggi nessun dato ci si trova.
- **Inserimento e testi**: testo libero dove esistono value help, dropdown, date picker o dati anagrafici; testi cablati invece che nei bundle; label, tooltip, microcopy e testi di stato vuoto che non dicono che cosa fare; overflow e testi troncati.
- **Stato dell'app**: `localStorage` o stato salvato senza scadenza, se pertinente; cache o filtri incoerenti con l'utente o con lo scope dei dati (`TENANT_SCOPE_FIELD`; con `nessuno` il controllo non si applica, e lo dichiari).

### Fase 3 — Contratto interfaccia ↔ servizio

Per ogni azione importante dell'interfaccia segui la catena, un anello per volta, fino al codice che la applica:

```text
cap + fiori
descrittore · annotazione (@UI.LineItem, @UI.Identification con DataFieldForAction) · fragment
→ flag calcolato: il path di @Core.OperationAvailable (per esempio in/<flag>), o un elemento virtuale
→ chi lo valorizza: la projection, o l'arricchimento in READ (after READ nell'handler)
→ @restrict o @requires sull'azione e sull'entità, nel modello compilato
→ l'handler dell'azione (this.on('<azione>', …)) e i controlli che fa davvero
→ @Common.SideEffects dell'azione, o l'aggiornamento dell'interfaccia
→ il test che prova la catena, o quello che manca

abap (Fiori elements su RAP), letto con Nova ARC-1
metadata extension (@UI.lineItem, @UI.identification con type #FOR_ACTION) · descrittore · fragment
→ feature control d'istanza (features : instance, get_instance_features) o globale (get_global_features)
→ projection: la behavior definition di projection (use action) e la CDS di projection
→ authorization master d'istanza o globale (get_instance_authorizations, get_global_authorizations) e la DCL sulla CDS
→ l'implementazione dell'azione nel behavior pool, con determinazioni e validazioni al salvataggio
→ side effects nella behavior definition (side effects { action … affects … }), o l'aggiornamento dell'interfaccia
→ il test ABAP Unit (EML, test double) che prova la catena, eseguito con SAPDiagnose unittest
```

Segnala ogni scostamento fra ciò che l'interfaccia mostra e ciò che il servizio consente:

- l'interfaccia mostra un'azione che il servizio rifiuta (403, 409), o nasconde un'azione valida per quel ruolo in quello stato;
- il flag calcolato usa una matrice diversa da quella del servizio (`@restrict`, i controlli dell'handler, l'authorization master);
- uno stato del processo non canonico, o una transizione che salta un controllo (le transizioni da `STATUS_MACHINE`, se il profilo lo ha, altrimenti misurate dagli handler o dal behavior);
- lo scope dei dati (`TENANT_SCOPE_FIELD`) applicato in modo diverso fra la query dell'interfaccia, l'arricchimento in lettura e l'handler;
- comportamento divergente fra draft e attivo: l'azione c'è su uno e non sull'altro, il controllo si fa su uno solo dei due.

Controlli sul contratto compilato:

- Un `@Core.OperationAvailable` presente nel sorgente e assente nell'EDMX è stato scartato: un file che la compilazione non include, un `annotate` sul target sbagliato. Per `abap`, verifica nel `$metadata` che la disponibilità dell'azione arrivi all'interfaccia.
- Il nome di un `DataFieldForAction` è il nome qualificato dell'azione, come compare nel `$metadata`: confrontali.
- Il compilatore non controlla i path delle annotazioni: un `Value` verso un elemento che non esiste o un `@Common.SideEffects` verso una navigation che non c'è compilano senza un warning e finiscono nell'EDMX. Il controllo è grezzo (trova i nomi che il servizio non dichiara da nessuna parte, non quelli che esistono su un'altra entità), ma diventa rosso su un EDMX con un path rotto e resta verde su uno sano:
  ```bash
  X="$OUT/<Servizio>.xml"
  { grep -oE '<(NavigationPropertyPath|PropertyPath|Path|AnnotationPath)>[^<]+' "$X" | sed -E 's/^<[^>]+>//'
    grep -oE ' (Path|PropertyPath|NavigationPropertyPath|AnnotationPath)="[^"]+"' "$X" | sed -E 's/^[^"]+"//; s/"$//'
  } | tr '/' '\n' | grep -vE '^(@|\$|\*|$)' | sort -u > "$OUT/path.txt"
  grep -oE '<(NavigationProperty|Property|Parameter) Name="[^"]+"' "$X" | sed -E 's/.*Name="//; s/"$//' | sort -u > "$OUT/nomi.txt"
  comm -23 "$OUT/path.txt" "$OUT/nomi.txt"        # segmenti di path che il servizio non dichiara: annotazioni rotte
  ```

Trappola misurata, sul flag calcolato: un flag che governa la disponibilità di un'azione e guarda **solo lo stato del dato**, ignorando il ruolo di chi guarda, produce un pulsante attivo che risponde «non autorizzato». E l'inverso: un flag che disabilita invece di nascondere lascia in pagina un comando che non si potrà mai usare.

Trappola misurata su un prodotto reale: i flag di disponibilità annotati `@UI.Hidden` sparivano dal `$select` che Fiori elements costruisce, e i pulsanti restavano spenti per tutti; la correzione era togliere `@UI.Hidden` e lasciare solo `@Core.Computed`. Verifica nella risposta del servizio, non nel sorgente, che il flag arrivi davvero.

### Fase 4 — Controlli automatici mirati

Scegli solo quelli pertinenti allo scope. Chiamato da `/nova-audit-all`, quelli già nella baseline non si rilanciano.

- Il contratto: l'EDMX del servizio, se la Fase 1 non l'ha già prodotto; per `abap`, SAPDiagnose `syntax`, `atc` (con la variante della baseline, se c'è) e `unittest` sugli oggetti della catena.
- Il linter UI5 sull'app: `run_ui5_linter`, oppure `ui5lint` di `node_modules/.bin/` nella cartella dell'app. Verde non vuol dire sana (trappola 1).
- `run_manifest_validation` sul descrittore, sempre se l'hai toccato.
- Typecheck e build dell'app, se il suo `package.json` li ha:
  ```bash
  node -e "const s=require(process.argv[1]).scripts??{};for(const k of Object.keys(s))if(/typecheck|^build$|^lint$/.test(k))console.log(k,'->',s[k])" "$PWD/$APP/package.json" 2>/dev/null
  ```
- I test mirati: il runner del progetto sui file di test del servizio e dell'app (il filtro per percorso di Jest, `node --test <file>`, o lo script `test` con il filtro del runner). Con `cds-plugin-ui5` fra le dipendenze, i test del servizio girano con `CDS_PLUGIN_UI5_ACTIVE=false`.
- Il controllo visivo, se l'utente lo chiede o se hai toccato il frontend: lo script di avvio più specifico dell'app e il server `playwright`, con lo screenshot nel rapporto. Senza browser: `TOOL UNAVAILABLE`, con l'impatto.

### Fase 5 — Quick win: che cosa si corregge subito

Si corregge subito (in `fix`):

- un'annotazione spostata nel file giusto (per `abap`, nella metadata extension giusta);
- un `@Core.OperationAvailable` mancante su un flag che esiste già ed è testabile;
- un `@Common.SideEffects` mancante su una navigation che esiste già;
- un handler custom non cablato, quando esiste già l'helper o l'azione standard;
- un testo cablato semplice da portare nel bundle i18n;
- un value help o un dropdown che esiste già e non è collegato;
- un binding del descrittore sbagliato su un flag che esiste;
- un test di contratto mancante e facile da aggiungere.

Non si corregge subito: va nel rapporto con l'azione proposta.

- ridisegno del processo, macchina a stati;
- ruoli e separazione dei compiti;
- attribuzione di responsabilità e destinatari nei sistemi SAP di workflow;
- schema dei dati e migrazioni;
- un contratto OData nuovo non concordato;
- una politica di sicurezza ambigua;
- un refactoring ampio.

## Correzioni (`fix`)

- Mai sul ramo di default: un ramo dedicato, con la convenzione del profilo (`BRANCH_CONVENTION`).
- Mai file già modificati da altri, salvo richiesta esplicita.
- Solo quick win: impatto locale e reversibile, pochi file, nessuna migrazione di dati, nessun contratto di servizio nuovo, nessuna decisione di prodotto (ruoli, separazione dei compiti, stati del processo), nessuna credenziale reale.
- Correzioni in parallelo solo su file disgiunti: si raggruppa per proprietario del file, non per tema.
- Ogni finding chiuso porta il test o il gate che lo tiene chiuso, con la prova di sensibilità.
- Test e compilazione mirati, commit con il trailer del profilo, push e pull request. Niente `[skip ci]`.

In più, per questo comando:

- Al massimo tre file applicativi per quick win, e solo con un test o una compilazione mirati disponibili.
- Il ramo porta il nome dell'app (`<comando>` = `app-audit-<app>` nella convenzione); se esiste già, un suffisso incrementale.
- `run_manifest_validation` su ogni descrittore toccato; un controllo nel browser se hai toccato l'interfaccia.
- Per `abap`, si scrive nel sistema solo dopo l'approvazione del package e del trasporto (il passo `ABAP_WRITE_APPROVAL` del playbook chiuso) e solo nei package approvati lì; altrimenti la correzione è un diff proposto nel rapporto.
- Senza strumento, remote o permessi per aprire la PR, le modifiche restano committate in locale solo se l'utente l'ha chiesto; altrimenti vanno nel rapporto come patch.
- Dopo una PR, il registro porta lo stato verificato adesso e il rapporto anche quello atteso dopo il merge: un finding diventa `Chiuso` quando un run lo verifica sul ramo di default.

## Esito

Il rapporto, `AUDIT_DIR/<aaaa-mm-gg>-nova-app-audit.md`, con queste sezioni (con `all`, una per app):

```markdown
# <PROJECT_NAME> · Audit dell'app <app> · <aaaa-mm-gg> · ramo <nome>

## Verifica dei pendenti
| ID | Stato | Evidenza | Azione |

## Correzioni applicate
| Area | File | Descrizione | Test o gate |

## Nuovi finding
1. [P1|P2|P3] Titolo
   - Dove: file:riga
   - Impatto: …
   - Evidenza: …
   - Azione: …
   - Quick win: sì/no

## Pull request
- Ramo · commit · PR

## Verifiche
- Contratto: EDMX del servizio (cap) o SAPDiagnose (abap)
- Typecheck e build dell'app
- Test mirati
- Linter UI5 e validazione del descrittore
- Controllo nel browser

## Rischio residuo
```

Se l'ambiente supporta i commenti di revisione sulla riga (una PR aperta, server `github`), aggiungine uno per ogni finding concreto non corretto, con file e righe precise.

Poi, sempre:

- **Rapporto** in `AUDIT_DIR/<aaaa-mm-gg>-<nome-del-comando>.md`, nella lingua `REPORT_LANG`, con `file:riga` come link. Ogni finding ha cinque parti: dove (`file:riga` o il comando che l'ha prodotto), impatto su un utente o su un dato, evidenza (l'output, il numero, la riga), azione, quick win sì/no.
- **Registro dei pendenti** (`PENDING_REGISTER`): i finding già registrati cambiano stato (`Chiuso`, `Ancora aperto`, `Parzialmente corretto`, `Superato`, `Rinviato`) con l'evidenza; i nuovi si aggiungono. Non si cancella niente.
- **Costo**: tempo per fase, cosa non è stato eseguito e perché.
- **Playbook**: se il comando gira per un passo del playbook NOVA, chiudilo solo se l'esito lo consente, con `node .claude/nova/install.mjs done <PASSO> --evidence "<rapporto>: <esito in una riga>"`. Con finding bloccanti aperti il passo resta aperto.

## Regole

1. **Prima i pendenti, poi i nuovi.** Un audit che trova problemi nuovi senza aver chiuso i vecchi riporta due volte lo stesso difetto.
2. **Lo stato di un finding si decide sul contratto attivo**: l'EDMX compilato, la versione attiva degli oggetti ABAP, il render nel browser. Con il solo sorgente un finding non diventa `Chiuso`.
3. **Mai «limite del framework» né «in Fiori elements non si può»** senza avere in mano la risposta dello strumento o della documentazione SAP.
4. **Gravità**: P1, l'utente non completa il compito, o vede e fa ciò che il servizio non consente, o un dato risulta sbagliato; P2, il compito si completa con fatica o con un errore evitabile (ricaricare a mano, un messaggio che non dice che cosa fare); P3, un difetto di qualità senza effetto sul compito. Per il passo `APP_AUDIT` è bloccante un P1 aperto.
