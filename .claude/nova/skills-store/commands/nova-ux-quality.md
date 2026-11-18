---
description: Audit della qualità delle interfacce (pulsanti e azioni, coerenza fra app, navigazione, tile e card, accessibilità WCAG 2.2 AA misurata a runtime sulla lista e sulla pagina di dettaglio, comportamento responsive) con strumenti che girano davvero; rapporto, gate e correzioni sicure su un ramo dedicato.
argument-hint: "[all|<app>[,<app>…]] [report|fix|visual|a11y]"
---

Misura la qualità percepita e l'usabilità delle app dello sviluppo, Fiori elements o freestyle: pulsanti e azioni, aspetto e coerenza fra le app, menu e navigazione, tile del launchpad e integration card, accessibilità (WCAG 2.2 AA, accessibilità SAP Fiori), comportamento responsive. La misura la fanno strumenti che girano, non una rilettura del codice; sicurezza e dominio hanno i loro comandi. È il comando della parte di accessibilità del passo `E2E_A11Y` del playbook NOVA (categoria C15); `/nova-audit-all` lo esegue dopo l'ultimo `/nova-app-audit`, sull'insieme delle app.

Comando generico del toolkit NOVA, derivato da `nova-ux-quality` di un prodotto CAP + Fiori elements: i valori del progetto non sono scritti qui, si leggono o si misurano a ogni esecuzione.

## Argomento: $ARGUMENTS

```text
<ambito> [modalità]
```

- `<ambito>`: `all` (default), tutte le app scoperte, oppure un elenco separato da virgole: il nome della cartella dell'app, o la sua parte finale. Per una prima passata, le app che l'utente usa ogni giorno secondo la richiesta (`REQUEST.md`).
- `[modalità]`: `report` (default), nessuna modifica · `fix`, i quick win sicuri su un ramo dedicato · `visual`, solo i finding `VISUAL-QA`, con il browser · `a11y`, solo il perimetro, i gate e la misura di accessibilità a runtime (Fasi 1, 2, 5 e 6), quando serve solo l'evidenza di accessibilità del passo `E2E_A11Y`.

## Contesto — Fase 0, sempre

Prima di giudicare, leggi e misura. Non chiedere all'utente ciò che il repository o lo sviluppo NOVA già dicono, e non usare una lista scritta a mano dove si può derivare. Quello che resta da chiedere lo chiedi con lo strumento AskUserQuestion, a scelta: da 2 a 4 opzioni con i valori misurati o ammessi, la consigliata per prima con «(consigliato)», fino a 4 domande per chiamata; senza lo strumento, un elenco numerato. Mai segreti.

1. **Lo sviluppo NOVA**, se il repository ha `.claude/nova/skills.manifest.json`:
   - `development`: tipologia, target e release, modalità (nuovo o modifica; per una modifica, `change` con lo sviluppo esistente, il sistema sorgente, il percorso e il livello Clean Core obiettivo) `profile`, le risposte del profilo in parole, e `answers`, le stesse in codici (per esempio `SAP_STORE` e `PROCESS`, `YES` o `NO`): su quelle si decide che cosa si applica;
   - la richiesta, in `.claude/nova/REQUEST.md`: cosa deve fare l'applicazione, per chi, con quali regole. È il **dominio**: distingue un difetto di dominio da uno di stile;
   - le skill del piano: le voci di `items`, con le loro `categories`. Per ogni area usa quelle installate (sezione *Skill e MCP*);
   - il passo del playbook per cui il comando gira: `node .claude/nova/install.mjs status`.

   Senza manifest il comando vale lo stesso: dichiaralo nel rapporto e ricava tutto dal repository.
2. **Il profilo d'audit**, `docs/audit/AUDIT_PROFILE.md`: le decisioni che il codice non dice. Questo comando usa `PROJECT_NAME`, `REPORT_LANG`, `AUDIT_DIR`, `PENDING_REGISTER`, `A11Y_BASELINE` e, in `fix`, `BRANCH_CONVENTION` e `COMMIT_TRAILER`. Se il file manca, esegui prima `/nova-audit-profile`; se manca solo una chiave, chiedila e aggiungila. Un valore del profilo che il repository smentisce è un finding, non un dato.
3. **Il repository**, misurato adesso:
   ```bash
   git rev-parse --show-toplevel && git branch --show-current && git log -1 --oneline
   git status --short                      # file già modificati da altri: non si toccano
   node -e "console.log(JSON.stringify(require('./package.json').scripts ?? {}, null, 1))" 2>/dev/null
   ```
   Poi le app, una riga per app, e la versione UI5 che servono:
   ```bash
   for app in $(git ls-files | grep -E '(^|/)webapp/manifest\.json$' | sed -E 's#/webapp/manifest\.json$##' | sort -u); do
     node -e '
       const [app] = process.argv.slice(1), m = require("./" + app + "/webapp/manifest.json"), ui5 = m["sap.ui5"] ?? {};
       const tpl = (n) => ui5.routing?.targets?.[n]?.name ?? "", t = Object.keys(ui5.routing?.targets ?? {}).map(tpl);
       const root = (ui5.routing?.routes ?? []).find((r) => /^(:\?query:)?$/.test(r.pattern ?? ""));
       console.log(JSON.stringify({ app,
         tipo: m["sap.ui.generic.app"] ? "FE v2" : t.some((n) => /^sap\.fe\.templates\./.test(n)) ? "FE v4" : "freestyle",
         minUI5: ui5.dependencies?.minUI5Version, servizio: m["sap.app"]?.dataSources?.mainService?.uri,
         paginaOggetto: t.some((n) => /ObjectPage$/.test(n)), radiceSuLista: [].concat(root?.target ?? []).some((n) => /^sap\.fe\.templates\./.test(tpl(n))),
         lingue: [m["sap.app"]?.i18n, ui5.models?.i18n?.settings].map((s) => s && [s.supportedLocales, s.fallbackLocale]),
         enhanceI18n: (JSON.stringify(m).match(/"enhanceI18n"/g) ?? []).length, inbound: Object.keys(m["sap.app"]?.crossNavigation?.inbounds ?? {}).length }));' "$app"
   done
   git ls-files | grep -E '(^|/)(webapp/[^/]*\.html|ui5[^/]*\.ya?ml)$' | xargs grep -hoE '(ui5\.sap\.com|sapui5\.hana\.ondemand\.com|openui5\.hana\.ondemand\.com)/[0-9][0-9.]*|^ *version: *"?[0-9][0-9.]*' 2>/dev/null | sort | uniq -c
   ```
   Per cap, il servizio di ogni app si abbina al modello compilato (Fase 3). Per abap, l'app sta nel repository git o nel repository ABAP del sistema (BSP); service binding, metadata extension e behavior si leggono con `SAPRead` del server MCP `nova-arc-1`.

   I finding di `/nova-app-audit`, se è girato prima, sono un ingresso. Chiamato da `/nova-audit-all` o da `/nova-app-audit`, baseline e inventario degli strumenti arrivano da lì: non rimisurarli, restituisci i finding e non scrivere né rapporto né registro.

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

| Se guardi… | Skill del catalogo (categoria) |
|---|---|
| Linee guida di design: floorplan, pulsanti, messaggi, stati vuoti | `sap-fiori-guidelines` (C04) |
| Accessibilità: ARIA, nomi accessibili, focus, tastiera, screen reader, dimensione dei bersagli | `ui5-best-practices-accessibility` (C04) |
| Annotazioni e manifest di Fiori elements: azioni, sezioni, tabelle, stati vuoti | `sap-fiori-app-development` (C05) |
| Estensioni di Fiori elements: frammenti e controller custom | `fix-fiori-elements-extensions` (C05) |
| Filtri visuali, grafici analitici, tree table | `sap-fiori-add-visual-filter` · `sap-fiori-analytical-chart` · `sap-fiori-tree-table` (C05) |
| Codice UI5: binding, caricamento asincrono, controlli | `ui5-best-practices` · `sapui5` (C06) |
| Tabelle (responsive, grid, tree, MDC, smart) | `ui5-best-practices-tables` (C06) · `fix-table-row-mode` (C14) |
| Controlli MDC e smart | `ui5-best-practices-mdc` · `ui5-best-practices-smart-controls` (C06) |
| Tile e sandbox del launchpad | `modernize-flp-sandbox` (C10) |
| Integration card | `ui5-best-practices-integration-cards` (C10) |
| Manifest | `fix-manifest-json` (C14) |
| Errori a runtime che il linter non vede | `fix-linter-blind-spots` (C14) |
| API deprecate, globali, pseudo-moduli, HTML nativo nelle viste | `fix-deprecated-controls` · `fix-partially-deprecated-apis` · `fix-js-globals` · `fix-xml-globals` · `fix-pseudo-modules` · `fix-xml-native-html` (C14) |
| Bootstrap, CSP, componente asincrono, renderer, librerie, cicli fra moduli | `fix-bootstrap-params` · `fix-component-async` · `fix-control-renderer` · `fix-library-init` · `fix-cyclic-deps` (C14) · `fix-csp-compliance` (C13) |
| ESLint di Fiori, modernizzazione | `sap-fiori-eslint-plugin` · `modernize-ui5-app` (C14) · `ui5-typescript-conversion` (C06) |
| Annotazioni e anti-pattern lato servizio | `sap-cap-capire` · `sap-cap-best-practices` (C07) · `sap-abap-cds` (C08) |
| Test OPA5, QUnit e il loro starter | `sap-fiori-opa5-test-development` · `ui5-best-practices-opa5` · `ui5-best-practices-qunit` · `modernize-test-starter` (C15) |
| Misura a runtime | MCP `playwright` · CLI `@axe-core/playwright` (C15) |

Prima consulta, poi giudica: mai «limitazione del framework» senza la risposta dello strumento in mano. Usa le skill che il piano ha installato (voci `items` del manifest); una skill della tabella che il piano non ha non è un errore: di' quale hai usato al suo posto, o `TOOL UNAVAILABLE`. Una skill fuori catalogo presente nella sessione (per esempio una revisione di accessibilità di un plugin) si usa in aggiunta, dichiarata: non sostituisce la misura.

MCP, per server e strumento: `run_ui5_linter`, `run_manifest_validation`, `get_api_reference`, `get_guidelines` e `get_version_info` del server MCP UI5 (`ui5-mcp-server`); `ui5_version_diff` e la documentazione SAP del server `sap-docs`; `search_model` del server CAP (`cap-js`); il server `fiori-mcp` (SAP Fiori tools), per modificare un'app Fiori elements con le sue funzionalità invece che a mano; `SAPRead` e `SAPSearch` del server `nova-arc-1` (`DDLX`, `BDEF`, `SRVB`, `DDLS`); del server `playwright`, `browser_navigate`, `browser_snapshot` (l'albero di accessibilità: ruoli e nomi), `browser_press_key`, `browser_resize`, `browser_take_screenshot`, `browser_evaluate` e `browser_network_requests`.

### Gli strumenti si provano, non si assumono

Prima di qualsiasi giudizio verifica che linter, validatore e browser esistano e rispondano **su questo repository**: ogni skill con lo strumento Skill, ogni server MCP con una chiamata innocua (`get_version_info`, `run_manifest_validation` su un manifest, `browser_navigate` su una pagina dell'app). Apri il rapporto con la tabella «strumento → risponde sì/no, con quale chiamata, quale istanza».

- **Un elenco è una fotografia, non un inventario.** Trappole misurate su un prodotto reale: guardando una sola cartella, una skill è stata dichiarata assente, e c'era; due elenchi presi a pochi minuti di distanza, nella stessa sessione, contenevano insiemi diversi.
- **Lo stesso server può essere esposto due volte**: su un prodotto reale un'istanza falliva a ogni chiamata, l'altra funzionava. Se uno strumento fallisce, prova l'istanza alternativa esposta nella sessione, altrimenti `TOOL UNAVAILABLE`.
- **`get_api_reference` può non risolvere i simboli `sap.fe.*`**, quando `sap.fe` non è fra le librerie che il progetto dichiara al tooling: per Fiori elements ripiega sulla documentazione SAP (`sap-docs`), e dillo.
- **Senza il server `playwright` la misura a runtime non si salta**: usa `@playwright/test` e `@axe-core/playwright` del repository (`node_modules/.bin/`), e scrivilo nella tabella. Su un prodotto reale il render è stato l'unico a trovare difetti che nessun gate statico vedeva.
- **Un audit di accessibilità senza browser non è un audit di accessibilità**: contrasto, zoom e riflusso non si deducono dal sorgente, e dirlo è più utile di sette finding sui soli attributi. Misurato su un prodotto reale: le skill di accessibilità coprivano tastiera, focus, screen reader e dimensione dei bersagli, non riflusso e contrasto. Quei criteri restano `NON VERIFICATO` finché non c'è una misura a runtime, e non passano per analogia con gli altri.

## Procedura

### Fase 1 — Perimetro

- **Le app si scoprono da git**, mai da `ls` (Contesto). Trappola misurata su un prodotto reale: una cartella rimasta su disco dopo che la sua app era confluita in un'altra; una lista statica lintava l'app morta e ne saltava due vere.
- **La versione UI5 è quella servita**: il bootstrap dell'`index.html` o `framework.version` di `ui5.yaml`, per abap quella del sistema, a runtime `sap.ui.version`. `minUI5Version` è un minimo. Ogni giudizio su che cosa esiste o è deprecato si dà su quella versione (`get_version_info`; `ui5_version_diff` per il delta).
- **Le superfici si derivano dal manifest**, per app: la lista (la rotta radice) e la pagina oggetto (un target `sap.fe.templates.ObjectPage`); per freestyle, le rotte di `sap.ui5.routing`. Se la radice non porta a un template di Fiori elements (l'app apre su una pagina indice sua), la pagina oggetto esiste ma non si raggiunge in un salto: dichiaralo, non saltarla in silenzio.
- **Launchpad e card**: gli inbound (`crossNavigation.inbounds`; tile dinamica se c'è `indicatorDataSource`), la sandbox del launchpad dove esiste (`modernize-flp-sandbox` ha materia solo lì), le integration card, nei manifest `sap.card` o costruite dal codice a runtime (`git grep -nE '"sap\.card"|sap/ui/integration/widgets/Card'`).
- **I dati.** Le liste devono mostrare dati prima di misurare. Trappola misurata, e invalida la misura: con i dati di prova scaduti (date fuori dal filtro di default) le liste si aprivano vuote e la baseline di accessibilità misurava una griglia vuota credendo di misurare il prodotto; i tentativi di aprire la pagina di dettaglio erano falliti per la stessa causa, non per il clic. Se un gate presidia le date dei dati di prova, controlla che non fosse già rosso.

### Fase 2 — Gate esistenti — estendi, non riscrivere

```bash
git ls-files | grep -vE '(^|/)(node_modules|\.claude|\.agents)/' | grep -iE '(a11y|accessib|axe|playwright|opa|journey|wdi5|support.?assistant)|(^|/)e2e/' | sed -E 's#/[^/]+$##' | sort | uniq -c | sort -rn
git ls-files | grep -iE 'baseline[^/]*\.json$'
node -e "const p=require('./package.json'),d={...p.dependencies,...p.devDependencies};console.log(Object.entries(d).filter(([k])=>/axe|playwright|wdio|wdi5|ui5-test-runner|@ui5\/linter|eslint-plugin-fiori|@sap-ux\/eslint/.test(k)).map(e=>e.join('@')).join('\n'))" 2>/dev/null
```

Per ogni gate trovato (scan di accessibilità, spec end-to-end, journey OPA5, test su manifest e annotazioni): che cosa misura (quali superfici, quali tag axe, quali impatti), se le app le deriva o le elenca a mano, se gira (script, CI) e con quale ultimo esito. Prima di aprire un finding, guarda se un gate lo copre e perché non è scattato: un gate che c'è e tace è più grave del difetto. Un gate nuovo accanto a uno che misura quasi la stessa cosa produce due numeri che divergeranno: estendi quello che c'è.

**La baseline** (`A11Y_BASELINE`) registra il debito per bloccare le regressioni; non dichiara la conformità. Si rigenera dall'output dello scan, non si scrive a mano; lo scan la confronta nei due versi (una violazione nuova è una regressione, una sparita va tolta, o la baseline marcisce); se manca, lo scan misura e stampa senza asserire, così il primo giro produce il dato invece di fallire a vuoto. Una baseline non chiude il passo `E2E_A11Y`. Il profilo che nomina una baseline assente dal repository, o il contrario, è un finding.

### Fase 3 — Analisi statica, con i suoi limiti

- `run_ui5_linter` su ogni app, e gli script `lint*` del progetto. Trappola 1: verde su tutte le app con finding gravi sotto; per ciò che il linter non vede, `fix-linter-blind-spots`.
- `run_manifest_validation` su ogni manifest. Trappola 2: valida lo schema UI5 generico, non la semantica di Fiori elements. Sul prodotto misurato `tableSettings.noDataText`, che Fiori elements v4 non ha, passava la validazione, e gli stati vuoti contati come implementati non arrivavano all'utente. Per le impostazioni di Fiori elements serve la documentazione SAP; un `enhanceI18n` si confronta col disco.
- Il contratto effettivo del servizio: per cap l'EDMX compilato (con `@sap/cds-dk` è `cds compile srv app --service <Servizio> --to edmx`; senza, l'API di `@sap/cds` sotto), dalla radice CAP; per abap il `$metadata` del service binding.

```bash
OUT="${TMPDIR:-/tmp}/nova-ux-quality-$(git rev-parse --short HEAD)"; mkdir -p "$OUT"   # fuori dal repository; ogni blocco che la usa la ridefinisce così: le variabili della shell non passano da un comando all'altro
node -e "const cds=require('@sap/cds');cds.load('*').then(m=>{for(const s of cds.linked(m).services) console.log(cds.service.protocols.path4(s), s.name)})"   # da abbinare a dataSources
node -e "const cds=require('@sap/cds');cds.load('*').then(m=>process.stdout.write(cds.compile.to.edmx(m,{service:process.argv[1]})))" <Servizio> > "$OUT/<Servizio>.edmx"
git grep -c '@Core.OperationAvailable' -- '*.cds'; grep -c 'Core.OperationAvailable' "$OUT/<Servizio>.edmx"      # dichiarato contro compilato
grep -oE '<PropertyValue Property="Action" String="[^"]+"' "$OUT/<Servizio>.edmx" | sort -u; grep -oE '<(Action|Function) Name="[^"]+"' "$OUT/<Servizio>.edmx" | sort -u
```

### Fase 4 — Che cosa guardare

**Pulsanti e azioni.**
- Visibile ma il servizio lo rifiuta (403, 409): falso positivo. Nascosto a chi ne ha diritto: falso negativo. Confronta ciò che rende il pulsante visibile e abilitato con ciò che il servizio applica: per cap `@restrict` e i controlli di stato dell'handler; per abap `authorization master` e `features: instance`, con i loro metodi.
- `@Core.OperationAvailable` nel sorgente e assente nell'EDMX: il layer dichiarativo non è quello attivo. Per abap il controllo dinamico arriva nel `$metadata` su `__OperationControl`: verificalo lì, non nel behavior.
- Ogni `Action` di un `UI.DataFieldForAction` è `<Servizio>.<azione>` ed esiste nel `$metadata` (un `DataFieldForIntentBasedNavigation` ha un'azione semantica, non OData).
- Trappola misurata su un prodotto reale: i flag che abilitano un'azione, nascosti con `@UI.Hidden`, sparivano dal `$select` (con `autoExpandSelect`) e il pulsante restava morto; il prodotto li ha tenuti solo `@Core.Computed`. Verifica nella richiesta reale (`browser_network_requests`) che il flag venga chiesto.
- Criticità dei pulsanti, un'azione primaria sola, azioni di massa su selezioni miste (righe non azionabili nella selezione), posizione in header, riga, overflow o footer. Fiori elements genera già il pulsante di modifica delle entità in bozza: non duplicarlo.

**Aspetto e coerenza fra app.** Le app devono sembrare un prodotto solo: densità (`condensedTableLayout`, `contentDensities`), gerarchia dell'header, ordine delle sezioni della pagina oggetto, semantica dei colori di stato (lo stesso stato con la stessa criticità ovunque), un'icona per concetto, la stessa azione con la stessa etichetta e la stessa posizione. Cerca le divergenze fra le app, non i difetti dentro una.

**Usabilità.**
- Caricamento, vuoto, errore, nessun risultato: tutti e quattro esistono e dicono che cosa fare, e lo stato vuoto arriva davvero all'utente (Fase 3).
- `initialLoad` e filtri inerti: impostazioni che la versione UI5 servita non onora (sul prodotto misurato, nascondere il filtro dello stato di bozza con `availability: Hidden` non funzionava sulla versione in uso). `liveMode: true` solo su dati anagrafici piccoli, altrimenti un `$batch` a ogni tasto.
- Click per completare il compito; informazione lontana dal punto in cui serve; testo libero dove esiste un value help; un message popover che dice che cosa fare.

**Menu e navigazione.** Il layout dichiarato è quello che il router usa: trappola misurata, un `FlexibleColumnLayout` dichiarato e non attivo (per Fiori elements v4 servono `routerClass` `sap.f.routing.Router` e i target con `controlAggregation` delle colonne). Intent del launchpad, deep link (l'URL con la chiave apre il dettaglio), indietro, breadcrumb. Aggiornamento dopo un'azione: `@Common.SideEffects` mancanti, o puntati a navigation che nel `$metadata` non esistono; per abap, `side effects` nel behavior.

**Tile e card.**
- Tile dinamiche: che cosa conta il numero, da quale servizio, se è quello giusto (lo stesso filtro della lista che apre) e ogni quanto si aggiorna.
- Integration card: ogni `{parameters>/X/value}` ha il suo `sap.card/configuration/parameters/X`; la richiesta dei dati sta solo in `sap.card/data`, mai sotto `content/data` o `header/data` (`ui5-best-practices-integration-cards`). Trappola misurata su un prodotto reale: il render ha smentito il sintomo atteso di una card configurata così, non la regola: una configurazione non conforme che oggi funziona resta non conforme. Una card costruita a runtime si misura a runtime.

**Accessibilità nel codice.**
- Ogni comando e ogni campo ha un nome accessibile. Un'etichetta che *sembra* collegata può non esserlo: senza `labelFor` non viene emesso `aria-required`, e `required: true` da solo è un pixel. Ogni dialog ha un titolo o un `ariaLabelledBy`.
- Landmark e ruoli: `landmarkInfo`, `accessibleRole`, `ariaLabelledBy`. Misurato su un prodotto il cui audit non aveva mai guardato l'accessibilità: zero occorrenze. Il conteggio è un segnale, non una prova.
- Un testo che diventa nome accessibile è anche materia di `/nova-text-polish`: qui si guarda il legame, lì la parola.

**Responsive.** `deviceTypes` dichiarati e davvero provati; colonne con `@UI.Importance` per la visualizzazione a righe su schermi piccoli; overflow e troncamenti; la barra degli strumenti su telefono.

**i18n che rompe la schermata.** Una chiave mancante stampa la chiave: l'utente legge un nome tecnico in un dialog. `fallbackLocale` vive in due punti per manifest (`sap.app.i18n` e `sap.ui5.models.i18n.settings`); un binding annidato `{i18n>{modello>chiave}}` non funziona e si risolve nel controller. Il resto dei testi è di `/nova-text-polish`.

### Fase 5 — Misura a runtime: render e accessibilità

1. **Avvia le app** come fa il progetto: gli script `watch*` o `start*` di `package.json`, `cds watch` o `cds-serve` per cap, `ui5 serve` o `fiori run` con il proxy di `ui5.yaml`; per abap il launchpad del sistema, o `fiori run` contro il backend. Senza un utente di test le misure a runtime sono `NON VERIFICATO`. Dichiara il prerequisito di rete: se UI5 arriva da una CDN, la CDN deve essere raggiungibile.
2. **La pagina deve aver reso contenuto reale**: UI5 inizializzato, DOM stabile, testo nella pagina, tema applicato. Trappola misurata su un prodotto reale: al primo giro lo scan diede zero violazioni su tutte le app, con zero caratteri di testo, perché la rete bloccava la CDN di UI5. Zero violazioni perché zero contenuto: il controllo deve fallire dicendo «non ho misurato», non «tutto a posto».
3. **Lista e pagina oggetto, per ogni app.** Trappola misurata su un prodotto reale: uno scan che apre solo la List Report non misura mai la pagina oggetto, dove vivono i frammenti custom, le sezioni aggiunte e la modalità bozza, cioè il codice che il repository può correggere (i residui della lista stanno spesso nel DOM generato dal framework). Arriva al dettaglio con il gesto dell'utente, la freccia di navigazione della riga, non costruendo l'hash a mano; poi verifica di esserci con un marcatore che la lista non ha: in Fiori elements v4 `.sapUxAPObjectPageLayout`, perché anche la List Report è una `.sapFDynamicPage` e un guard su quella passerebbe senza aver navigato.
4. **axe, con i tag giusti e due scansioni concordi.** WCAG 2.2 estende 2.0 e 2.1, non le sostituisce: i tag sono tutti e cinque. Due scansioni consecutive devono dare lo stesso risultato (su un prodotto reale una pagina analitica oscillava fra una e zero violazioni a codice fermo); se non concordano, la pagina non è deterministica e la misura non vale.

   ```js
   const AxeBuilder = require('@axe-core/playwright').default;
   const TAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
   async function misura(page, superficie) {   // dentro un test di @playwright/test, con expect
     const testo = await page.evaluate(() => document.body.innerText.trim().length);
     expect(testo, `${superficie}: pagina senza contenuto, nessuna misura è valida`).toBeGreaterThan(40);
     const impronta = (r) => r.violations.map((v) => `${v.id}#${v.nodes.length}`).sort().join('|');
     const a = await new AxeBuilder({ page }).withTags(TAG).analyze();
     await page.waitForTimeout(2000);
     const b = await new AxeBuilder({ page }).withTags(TAG).analyze();
     expect(impronta(b), `${superficie}: due scansioni discordi, la pagina non è deterministica`).toBe(impronta(a));
     console.log(`A11Y ${superficie} ${impronta(b) || 'nessuna violazione'} · incomplete=${b.incomplete.length}`);
     return { gravi: b.violations.filter((v) => ['serious', 'critical'].includes(v.impact)), tutte: b.violations, daRivedere: b.incomplete };
   }
   ```

   Stampa sempre la misura, anche quando passa: una misura che si vede solo quando fallisce non è una baseline. I risultati `incomplete` sono materiale per una verifica a mano, tracciata: né un esito né un'eccezione.
5. **Ciò che axe non vede.** I temi ad alto contrasto (`?sap-ui-theme=sap_horizon_hcb` e `sap_horizon_hcw`), verificando che il tema sia caricato davvero (la classe `sapUiTheme-<tema>` sull'elemento `html`); il riflusso a 320 px CSS, l'equivalente WCAG 1.4.10 di 1280 px al 400%, senza scorrimento orizzontale della pagina; la tastiera: Tab, F6 e Maiusc+F6 fra i gruppi, Esc nei dialog, focus visibile e mai intrappolato. Il Support Assistant di UI5 in OPA5 (`sap/ui/core/support/RuleEngineOpaExtension`, `noRuleFailures` con le regole di accessibilità) aggiunge le regole di UI5 che axe non conosce. Lo zoom reale del browser e gli screen reader restano una verifica umana: dichiarala.
6. **Con il server `playwright`**: `browser_snapshot` dà l'albero di accessibilità (ruoli e nomi, ciò che legge uno screen reader), `browser_press_key` la tastiera, `browser_resize` il riflusso, `browser_take_screenshot` le prove dei finding `VISUAL-QA`, `browser_evaluate` la versione UI5 e il tema.
7. **Dichiara le superfici visitate**: quante, su quante derivate dal manifest, e quali no, con il motivo.

### Fase 6 — Classifica e verifica i finding

- Ogni finding ha `file:riga`, l'impatto sull'utente in una frase, l'evidenza (comando o output, non impressione), una classe (`falso-positivo`, `falso-negativo`, `bloccato`, `incoerenza-visiva`, `accessibilità` con il criterio WCAG, `responsive`) e la gravità: P1, l'utente non completa il compito o una barriera lo blocca (violazione axe seria o critica, funzione non raggiungibile da tastiera); P2, lo completa con fatica; P3, difetto di qualità senza effetto sul compito.
- Ciò che non si prova senza render è `VISUAL-QA`, e si verifica con uno screenshot allegato.
- Una violazione nel DOM generato dal framework resta un finding del prodotto: si traccia (incidente SAP, versione che la corregge) e si chiude con una patch, o con una deroga dichiarata dal responsabile del prodotto per causa e per app, con il livello di prova accanto. Mai con una patch del DOM, mai disattivando la regola nello scan. Anche la deroga ha il suo gate, rosso in quattro versi: un riscontro che nessuna regola attribuisce; una causa misurata dove non è dichiarata; un conteggio diverso da quello registrato, in su o in giù; una causa dichiarata che non si misura più, e la deroga va tolta.
- Ciò che nessuna regola attribuisce al framework è lavoro dell'applicazione finché non si prova il contrario: è la direzione sicura. Trappola misurata su un prodotto reale: il contatore dei riscontri attribuiti all'applicazione era un letterale zero, e la condizione «nessun riscontro applicativo» era vera per costruzione.

## Correzioni (`fix`)

- Mai sul ramo di default: un ramo dedicato, con la convenzione del profilo (`BRANCH_CONVENTION`).
- Mai file già modificati da altri, salvo richiesta esplicita.
- Solo quick win: impatto locale e reversibile, pochi file, nessuna migrazione di dati, nessun contratto di servizio nuovo, nessuna decisione di prodotto (ruoli, separazione dei compiti, stati del processo), nessuna credenziale reale.
- Correzioni in parallelo solo su file disgiunti: si raggruppa per proprietario del file, non per tema.
- Ogni finding chiuso porta il test o il gate che lo tiene chiuso, con la prova di sensibilità.
- Test e compilazione mirati, commit con il trailer del profilo, push e pull request. Niente `[skip ci]`.

Per l'interfaccia, in più:

- **Si correggono**: testi i18n mancanti, tooltip, `labelFor` e `ariaLabelledBy`, nomi accessibili, ordine di attraversamento, stati vuoti nel modo che il framework onora, un'annotazione spostata nel file giusto, `SideEffects` su una navigation che esiste, il binding del manifest su un flag che esiste, la coerenza visiva fra app.
- **Vanno nel piano delle correzioni**, con una stima dell'effort: ridisegno del processo, o del layout senza una verifica visiva; stati del processo, ruoli e separazione dei compiti; schema; un nuovo contratto OData.
- Un fix di accessibilità si chiude rimisurando con lo stesso scan, non rileggendo il codice; la baseline si rigenera dall'output.
- Nessuna patch del DOM generato dal framework, nessuna regola axe disattivata per far passare il gate.
- Pull request in bozza quando la correzione cambia ciò che l'utente vede, con gli screenshot prima e dopo: la revisione è visiva.
- Mai in parallelo con `/nova-app-audit` né con `/nova-text-polish` in `fix`: toccano gli stessi file e si sovrascrivono.

## Esito

```markdown
# Qualità dell'interfaccia · <PROJECT_NAME> · <ambito> · <aaaa-mm-gg>
## Strumenti provati
| Strumento | Risponde | Chiamata di prova | Istanza o ripiego |
## Perimetro
- app scoperte da git, tipo, versione UI5 servita, dati presenti sì/no
- superfici visitate: N su M derivate dal manifest; quelle non visitate, e perché
## Accessibilità, per superficie
| App | Superficie | critical | serious | moderate | minor | incomplete da rivedere | rispetto alla baseline (nuove, sparite) |
- criteri NON VERIFICATO (contrasto, riflusso, zoom reale, screen reader), e perché
## Finding per app, per gravità e classe
## Finding fra app (coerenza)
## Correzioni applicate · Piano delle correzioni, con l'effort
## Verifiche: comando, esito
## Rischio residuo, e che cosa resta da verificare con un occhio umano
```

Esito del passo `E2E_A11Y`, con il criterio letto nel playbook (`.claude/nova/PLAYBOOK.md`): `PASSA` con zero violazioni axe serie o critiche su tutte le superfici derivate; `FALLISCE` con almeno una; `NON VERIFICATO` se una superficie non è stata misurata o lo scan non ha reso contenuto. Il passo ha anche la metà end-to-end, di `/nova-e2e-run`: si chiude quando passano entrambe, con l'evidenza di tutte e due (`node .claude/nova/install.mjs done E2E_A11Y --evidence "<rapporto>: axe <N> serie o critiche su <M> superfici; e2e <esito di /nova-e2e-run>"`).

Poi, sempre:

- **Rapporto** in `AUDIT_DIR/<aaaa-mm-gg>-<nome-del-comando>.md`, nella lingua `REPORT_LANG`, con `file:riga` come link. Ogni finding ha cinque parti: dove (`file:riga` o il comando che l'ha prodotto), impatto su un utente o su un dato, evidenza (l'output, il numero, la riga), azione, quick win sì/no.
- **Registro dei pendenti** (`PENDING_REGISTER`): i finding già registrati cambiano stato (`Chiuso`, `Ancora aperto`, `Parzialmente corretto`, `Superato`, `Rinviato`) con l'evidenza; i nuovi si aggiungono. Non si cancella niente.
- **Costo**: tempo per fase, cosa non è stato eseguito e perché.
- **Playbook**: se il comando gira per un passo del playbook NOVA, chiudilo solo se l'esito lo consente, con `node .claude/nova/install.mjs done <PASSO> --evidence "<rapporto>: <esito in una riga>"`. Con finding bloccanti aperti il passo resta aperto.

## Regole

1. **Riusa invece di rifare**: `/nova-app-audit <app>` per il contratto fra interfaccia e servizio e i pendenti di un'app, `/nova-text-polish` per il contenuto dei testi, `/nova-e2e-run` per i flussi end-to-end, `/nova-check-matrix` per le fasi del processo.
2. **Nessun numero dalla documentazione**: ogni cifra del rapporto viene da un comando di questo run.
3. **Una misura su una pagina vuota, su dati scaduti o su una sola superficie non è una misura**: il rapporto dice che cosa ha misurato davvero.
4. **Una regola durevole** che distilli va nel file di memoria del progetto (`CLAUDE.md`, `AGENTS.md`), nella sezione giusta: solo se è una regola, non un aneddoto.
