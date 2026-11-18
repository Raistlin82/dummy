---
description: Audit dei testi che l'utente legge (etichette, messaggi, conferme, stati vuoti, tile, notifiche) su registro, canone terminologico, lacune dei bundle, dati personali e dettagli tecnici esposti; riscrittura prima/dopo e correzioni sicure su un ramo dedicato.
argument-hint: "[all|<app>|backend|i18n] [report|fix] [tono:formale|tono:cordiale]"
---

Misura i testi che l'utente legge a runtime (etichette, messaggi d'errore, dialog, toast, conferme, stati vuoti, tile, notifiche) su registro, canone terminologico, completezza dei bundle in ogni lingua, dati personali e dettagli tecnici esposti, e ne propone la riscrittura prima/dopo. Usalo prima di un rilascio, dopo aver aggiunto schermate o messaggi, o quando il tono dei testi non è uniforme.

Comando generico del toolkit NOVA, derivato da `nova-text-polish` di un prodotto CAP + Fiori elements: i valori del progetto non sono scritti qui, si leggono o si misurano a ogni esecuzione.

## Argomento: $ARGUMENTS

```text
<ambito> [modalità] [tono:<registro>]
```

- `<ambito>`: `all` (default), tutte le sorgenti della Fase 1 · `<app>`, il nome della cartella dell'app o la sua parte finale, con i testi del servizio che l'app mostra (annotazioni delle sue entità, messaggi delle azioni che chiama) · `backend`, solo i messaggi del servizio · `i18n`, solo i bundle.
- `[modalità]`: `report` (default), nessuna modifica · `fix`, le correzioni sicure su un ramo dedicato.
- `tono:formale` · `tono:cordiale`: sostituisce il registro di `TONE_PROFILE` solo per questo run, e il rapporto lo dichiara in testa. Il canone terminologico resta quello del profilo.

## Contesto — Fase 0, sempre

Prima di giudicare, leggi e misura. Non chiedere all'utente ciò che il repository o lo sviluppo NOVA già dicono, e non usare una lista scritta a mano dove si può derivare. Quello che resta da chiedere lo chiedi con lo strumento AskUserQuestion, a scelta: da 2 a 4 opzioni con i valori misurati o ammessi, la consigliata per prima con «(consigliato)», fino a 4 domande per chiamata; senza lo strumento, un elenco numerato. Mai segreti.

1. **Lo sviluppo NOVA**, se il repository ha `.claude/nova/skills.manifest.json`:
   - `development`: tipologia, target e release, modalità (nuovo o modifica; per una modifica, `change` con lo sviluppo esistente, il sistema sorgente, il percorso e il livello Clean Core obiettivo) `profile`, le risposte del profilo in parole, e `answers`, le stesse in codici (per esempio `SAP_STORE` e `PROCESS`, `YES` o `NO`): su quelle si decide che cosa si applica;
   - la richiesta, in `.claude/nova/REQUEST.md`: cosa deve fare l'applicazione, per chi, con quali regole. È il **dominio**: distingue un difetto di dominio da uno di stile;
   - le skill del piano: le voci di `items`, con le loro `categories`. Per ogni area usa quelle installate (sezione *Skill e MCP*);
   - il passo del playbook per cui il comando gira: `node .claude/nova/install.mjs status`.

   Senza manifest il comando vale lo stesso: dichiaralo nel rapporto e ricava tutto dal repository.
2. **Il profilo d'audit**, `docs/audit/AUDIT_PROFILE.md`: le decisioni che il codice non dice. Questo comando usa `PROJECT_NAME`, `REPORT_LANG`, `AUDIT_DIR`, `PENDING_REGISTER`, `TONE_PROFILE` e, in `fix`, `BRANCH_CONVENTION` e `COMMIT_TRAILER`; legge `CONFIG_ENTITY` se c'è, senza chiederla. Se il file manca, esegui prima `/nova-audit-profile`; se manca solo una chiave, chiedila e aggiungila. Un valore del profilo che il repository smentisce è un finding, non un dato.
3. **Il repository**, misurato adesso:
   ```bash
   git rev-parse --show-toplevel && git branch --show-current && git log -1 --oneline
   git status --short                      # file già modificati da altri: non si toccano
   node -e "console.log(JSON.stringify(require('./package.json').scripts ?? {}, null, 1))" 2>/dev/null
   ```
   Poi le sorgenti dei testi:
   ```bash
   git ls-files | grep -E '(^|/)webapp/manifest\.json$' | sed -E 's#/webapp/manifest\.json$##' | sort -u   # le app, mai da ls
   git ls-files '*.properties' | grep -E '(^|/)_?i18n/'                                                  # i bundle
   git ls-files | grep -E '(^|/)package\.json$' | xargs grep -l '"@sap/cds"' 2>/dev/null                  # le radici CAP
   ```
   E ricava, da scrivere in testa al rapporto:
   - **lo stack** (`cap`, `fiori`, `abap`), da `development.type`, `target` e dalle righe di `profile`, confermato dai file;
   - **le lingue**: i suffissi `_<lingua>` dei bundle; `supportedLocales` e `fallbackLocale` di ogni manifest, nei due punti in cui vivono (`sap.app.i18n` e `sap.ui5.models.i18n.settings`: devono dire la stessa cosa); per CAP `cds.env.i18n.default_language`; e la lingua che il bundle base, senza suffisso, contiene davvero: leggi il bundle, non dedurla dal nome del file. Per abap, la lingua originale degli oggetti e le traduzioni del sistema;
   - **il registro e il canone**: `TONE_PROFILE`, cioè il registro (`formale` di default) e, se il team li ha fissati, i termini decisi, le sigle e le maiuscole delle etichette. Se il profilo dice solo il registro, misura il canone di fatto (il termine prevalente per ogni concetto, le sigle, le maiuscole prevalenti), proponilo nel rapporto e, confermato dall'utente, scrivilo nel profilo: da lì è una decisione;
   - **gli helper di traduzione**: `git grep -nE 'getText\(|cds\.i18n\.(messages|labels)\.at\('` e le funzioni del progetto che li avvolgono. I loro fallback cablati sono testo che nessuno traduce, perché nessuno sa che esiste;
   - per abap, il pacchetto dello sviluppo (da `development.change.objects` per una modifica, dal repository abapGit o dal playbook; se nessuno lo dice, chiedilo) e le sue classi di messaggi, con `SAPSearch` del server MCP `nova-arc-1`.

   I finding di `/nova-app-audit` e `/nova-ux-quality`, se sono girati prima, sono un ingresso: un finding di testo può essere un difetto di contenuto già trovato. Chiamato da `/nova-audit-all`, baseline e inventario degli strumenti arrivano da lì: non rimisurarli, restituisci i finding e non scrivere né rapporto né registro.

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
| Registro, lunghezza e maiuscole di etichette, messaggi, notifiche ed email | `sap-fiori-guidelines` (C04) |
| Un testo che è il nome accessibile di un controllo: etichette, titoli di dialog, tooltip di pulsanti con sola icona | `ui5-best-practices-accessibility` (C04) |
| Bundle UI5, `getText`, `formatMessage`, lingue supportate e di ripiego | `ui5-best-practices` · `sapui5` (C06) |
| Impostazioni i18n del manifest | `fix-manifest-json` (C14) |
| Etichette generate dalle annotazioni, testi di Fiori elements (`enhanceI18n`), estensioni | `sap-fiori-app-development` · `fix-fiori-elements-extensions` (C05) |
| `cds.i18n`, bundle dei messaggi, `req.error` e `req.reject`, CodeList localizzate | `sap-cap-capire` · `cap-developer` (C07) |
| Classi di messaggi, `@EndUserText`, etichette dei data element, messaggi del behavior | `sap-abap` · `sap-abap-cds` (C08) |
| Testi di integration card e tile | `ui5-best-practices-integration-cards` (C10) |
| Dati personali e dettagli tecnici in messaggi e log | `security-review` (C13, integrata) |
| Il gate che tiene chiuso un difetto di testo | `ui5-best-practices-qunit` · `generate-cap-cds-test` (C15) |

Prima consulta, poi giudica: mai «il framework non lo consente» senza la risposta dello strumento in mano. Usa le skill che il piano ha installato (voci `items` del manifest); una skill della tabella che il piano non ha non è un errore: di' quale hai usato al suo posto, o `TOOL UNAVAILABLE`.

MCP, per server e strumento: `get_api_reference` del server MCP UI5 (`ui5-mcp-server`) su `sap/base/i18n/ResourceBundle` e `sap/base/strings/formatMessage`, prima di toccare un apostrofo, e `get_guidelines`; `search_model` del server MCP CAP (`cap-js`), per le annotazioni del modello **compilato**; `SAPRead` e `SAPSearch` del server `nova-arc-1` per classi di messaggi (`MSAG`), CDS (`DDLS`), metadata extension (`DDLX`), data element (`DTEL`), behavior (`BDEF` e la sua classe); `sap-docs` per le linee guida SAP sui testi. Se uno strumento fallisce, prova l'istanza alternativa esposta nella sessione o dichiara `TOOL UNAVAILABLE`; usa i binari di `node_modules/.bin/` quando ci sono.

## Procedura

### Fase 1 — Le sorgenti

Non solo i bundle: il testo che l'utente legge arriva anche dal servizio, dalle annotazioni e dai fallback cablati negli helper.

| Sorgente | Stack | Dove |
|---|---|---|
| Bundle delle app | fiori | `<app>/webapp/i18n/*.properties` e i bundle che il manifest nomina |
| Testi di Fiori elements | fiori | i bundle `enhanceI18n` dei target: chiavi del framework, lette per convenzione |
| Viste, fragment, controller (freestyle ed estensioni) | fiori | attributi XML con testo letterale, `MessageBox.*` e `MessageToast.show` con una stringa, fallback degli helper |
| Manifest e launchpad | fiori | le chiavi fra doppie graffe di `sap.app` (titolo, descrizione, `crossNavigation.inbounds` con `title`, `subTitle`, `info`); le tile nel contenuto del launchpad (sandbox, CDM, Work Zone, cataloghi ABAP) |
| Integration card | fiori | `sap.card` (`header`, `title`, `subTitle`) e i bundle della card |
| Annotazioni | cap | `@title`, `@description`, `@Common.Label`, `@Common.QuickInfo`, `@Core.Description`, i `Label` di `@UI` (`LineItem`, `FieldGroup`, `Facets`, `HeaderInfo`), letterali o `{i18n>chiave}` |
| Bundle del servizio | cap | `_i18n/i18n*.properties` (etichette) e `_i18n/messages*.properties` (messaggi), o le altre cartelle di `cds.env.i18n.folders` |
| Messaggi del backend | cap | `req.error`, `req.reject`, `req.warn`, `req.info`, `req.notify`; `throw new Error(…)` e `cds.error` che arrivano all'utente; testi composti dal server (notifiche, email, contenuti costruiti a runtime) |
| CodeList e seed | cap | colonne `name` e `descr` dei CSV in `db/data` e i loro `_texts` |
| Testi ABAP | abap | classi di messaggi (`MSAG`), `@EndUserText.label` e `quickInfo` (`DDLS`), label di `@UI` (`DDLX`), etichette dei data element (`DTEL`), messaggi del behavior (`new_message`, `new_message_with_text`), letti con `SAPRead` |

Trappola misurata su un prodotto reale: i bundle delle app erano puliti, ma il termine scartato dal canone stava ancora nei seed, nelle annotazioni, in un `CASE` del servizio che duplicava una CodeList, nelle guide e in decine di messaggi runtime. Il canone vale sulla superficie che l'utente legge, non su una sorgente: dichiara nel rapporto quali sorgenti hai scansionato e quali no.

```bash
OUT="${TMPDIR:-/tmp}/nova-text-polish-$(git rev-parse --short HEAD)"; mkdir -p "$OUT"   # fuori dal repository; ogni blocco che la usa la ridefinisce così: le variabili della shell non passano da un comando all'altro
SRV=$(node -e "console.log(require('@sap/cds').env.folders.srv)" 2>/dev/null || echo srv/)   # la cartella del servizio CAP
git ls-files "${SRV:-srv/}" | grep -E '\.(js|ts)$' | xargs grep -HnE "req\.(error|reject|warn|info|notify)\([^)]*['\"\`][^'\"\`]*[a-zà-ù] [^'\"\`]*['\"\`]"  # testo letterale, non una chiave
git ls-files "${SRV:-srv/}" | grep -E '\.(js|ts)$' | xargs grep -HnE "throw new (Error|cds\.error)\(\s*['\"\`]"
git ls-files '*.xml' | grep '/webapp/' | xargs grep -HnE '\b(text|title|placeholder|tooltip|noDataText|label|headerText|description|subtitle|infoText)="[^{"][^"]*"'
git ls-files '*.js' '*.ts' | grep '/webapp/' | xargs grep -HnE "(MessageToast\.show|MessageBox\.(show|error|warning|confirm|information|success|alert))\(\s*['\"\`]"
git grep -nE "(\?\?|\|\|)\s*(key|sKey|code)\b" -- "${SRV:-srv/}" '*/webapp/*'                                   # la chiave stampata a mano come ripiego
# cap: i servizi con il loro percorso (da confrontare con dataSources del manifest) e l'EDMX non localizzato, per servizio
node -e "const cds=require('@sap/cds');cds.load('*').then(m=>{for(const s of cds.linked(m).services) console.log(cds.service.protocols.path4(s), s.name)})"
node -e "const cds=require('@sap/cds');cds.load('*').then(m=>process.stdout.write(cds.compile.to.edmx(m,{service:process.argv[1]})))" <Servizio> > "$OUT/<Servizio>.edmx"
grep -oE '(Term="(Common\.Label|Common\.QuickInfo|Core\.Description)"|Property="(Label|TypeName|TypeNamePlural|Description)")[^>]*String="[^"{][^"]*"' "$OUT/<Servizio>.edmx" | sort | uniq -c   # etichette letterali: non si traducono
```

Con `@sap/cds-dk` la compilazione è `cds compile srv app --service <Servizio> --to edmx`; senza, l'API sopra dà lo stesso EDMX. Esegui i comandi `node` dalla radice CAP. Ogni blocco di comandi è autonomo: `SRV` è la cartella del servizio misurata qui, `srv/` se il blocco gira in una shell nuova.

### Fase 2 — Bundle e chiavi

**Lacune e difetti strutturali**, per ogni gruppo di bundle (cartella e nome base, con le sue lingue):

```bash
git ls-files '*.properties' | grep -E '(^|/)_?i18n/' | node -e '
const fs = require("fs"), groups = {};
for (const f of fs.readFileSync(0, "utf8").split("\n").filter(Boolean)) {
  const [, dir, base, lang = "(base)"] = f.match(/^(.*\/)?([^/_]+?)(?:_([a-zA-Z]{2,3}(?:_[A-Za-z]{2,4})?))?\.properties$/) ?? [];
  if (!base) continue; const keys = ((groups[(dir ?? "") + base] ??= {})[lang] = new Map());
  fs.readFileSync(f, "utf8").split(/\r?\n/).forEach((l, i) => {
    const t = l.trim(); if (!t || /^[#!]/.test(t)) return;
    const at = t.search(/[=:]/); if (at < 0) return console.log(`${f}:${i + 1} riga senza "=" (chiave con valore vuoto)`);
    const k = t.slice(0, at).trim(), v = t.slice(at + 1).trim();
    if (keys.has(k)) console.log(`${f}:${i + 1} chiave duplicata ${k}: vince l’ultima, in silenzio`);
    if (!v) console.log(`${f}:${i + 1} valore vuoto ${k}`);
    if (/\\\\n/.test(v)) console.log(`${f}:${i + 1} "\\\\n" letterale in ${k}: l’utente legge i caratteri`);
    keys.set(k, { ph: [...new Set(v.match(/\{\w+\}/g) ?? [])].sort().join(",") });
  });
}
for (const [g, langs] of Object.entries(groups)) {
  for (const k of new Set(Object.values(langs).flatMap(m => [...m.keys()]))) for (const [lang, m] of Object.entries(langs)) {
    if (!m.has(k)) { console.log(`${g} [${lang}] manca ${k}`); continue; }
    const ref = Object.values(langs).find(o => o.has(k)).get(k);
    if (m.get(k).ph !== ref.ph) console.log(`${g} [${lang}] segnaposto diversi per ${k}: {${m.get(k).ph}} contro {${ref.ph}}`);
  }
  console.log(`# ${g}: ${Object.entries(langs).map(([l, m]) => `${l}=${m.size}`).join(" ")}`);
}'
```

Ogni riga è un finding `CHIAVE` o `POLISH`, e ognuna ha una trappola misurata su un prodotto reale dietro: una chiave duplicata faceva vincere un'etichetta inglese nel bundle italiano; uno script di propagazione che riscriveva le chiavi con `echo` spezzava su due righe i valori con `\n`, e la seconda riga diventava una chiave vuota in molti file, in silenzio; un `\\n` mostrava i caratteri nel dialog, e il messaggio era peggiore quando il bundle si caricava che quando falliva, perché il fallback cablato aveva gli a capo veri. Una chiave che manca in una lingua non dà un testo vuoto: la catena di ripiego serve un'altra lingua, e con `supportedLocales` che include `""` l'utente italiano leggeva le etichette del bundle base, in inglese.

**La chiave mancante stampa la chiave.** È la trappola peggiore: `getText` di UI5 restituisce la chiave stessa, e anche la localizzazione di CAP sostituisce una chiave assente col suo nome (misurato su `cds.localize`: nel `$metadata` l'etichetta diventa la chiave). Quindi «nessun segnaposto non risolto» non prova niente: le chiavi **letterali** usate nel codice devono esistere nei bundle.

```bash
for app in $(git ls-files | grep -E '(^|/)webapp/manifest\.json$' | sed -E 's#/webapp/manifest\.json$##' | sort -u); do
  git ls-files "$app/webapp" | grep -E '\.(xml|js|ts|json)$' | grep -v '/test/' | xargs grep -ohE "\{i18n>[A-Za-z0-9_.-]+\}|\{\{[A-Za-z0-9_.-]+\}\}|getText\(\s*['\"][A-Za-z0-9_.-]+['\"]" 2>/dev/null \
  | sed -E "s/^\{i18n>//; s/^\{\{//; s/\}\}?$//; s/^getText\(\s*['\"]//; s/['\"]$//" | sort -u | node -e '
    const fs = require("fs"), [app] = process.argv.slice(1), dir = app + "/webapp/i18n/";
    const base = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^[^_]+\.properties$/.test(f)) : [];
    const def = new Set(base.flatMap(f => fs.readFileSync(dir + f, "utf8").split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^[#!]/.test(l)).map(l => l.split(/[=:]/)[0].trim())));
    const used = fs.readFileSync(0, "utf8").split("\n").filter(Boolean), miss = used.filter(k => !def.has(k));
    console.log(`${app}: ${used.length} chiavi usate, ${miss.length} assenti dal bundle base${miss.length ? ": " + miss.join(" ") : ""}`);' "$app"
done
# cap: le chiavi delle annotazioni e dei messaggi, cercate con la stessa risoluzione che usa il servizio
node -e "const cds=require('@sap/cds');cds.load('*').then(m=>{const k=new Set();for(const s of cds.linked(m).services)for(const [,x] of cds.compile.to.edmx(m,{service:s.name}).matchAll(/\{i18n>([^}]+)\}/g))k.add(x);const a=[...k].filter(x=>cds.i18n.labels.at(x,'')===undefined);console.log(k.size,'chiavi del modello,',a.length,'assenti:',a.join(' '))})"
git ls-files "${SRV:-srv/}" | grep -E '\.(js|ts)$' | xargs grep -ohE "req\.(error|reject|warn|info|notify)\((\{ *code: *)?([0-9]{3}, *)?['\"\`][A-Za-z0-9_.]+['\"\`]" | sed -E "s/.*['\"\`]([A-Za-z0-9_.]+)['\"\`]$/\1/" | sort -u \
  | node -e "const cds=require('@sap/cds'),k=require('fs').readFileSync(0,'utf8').split('\n').filter(Boolean),a=k.filter(x=>cds.i18n.messages.at(x,'')===undefined);console.log(k.length,'chiavi di messaggio,',a.length,'assenti:',a.join(' '))"
git grep -nE "\`[A-Za-z][A-Za-z0-9_.]*\\\$\{|[\"'][A-Za-z][A-Za-z0-9_.]*_[\"'] *\+" -- '*.js' '*.ts' '*.xml'   # chiavi calcolate: prefisso + variabile
```

Le chiavi **calcolate** (l'ultimo comando) e le chiamate dentro un helper non le vede nessuno dei controlli sopra: elencale e seguile fino ai valori possibili.

**Chiavi morte.** Una chiave che nessun file nomina fuori dai bundle è una candidata, non una chiave morta:

```bash
for k in $(grep -hoE '^[^#!=:[:space:]][^=:]*' <bundle>.properties | sed 's/[[:space:]]*$//'); do git grep -qwF "$k" -- ':!*.properties' || echo "candidata: $k"; done
```

Verifica ogni candidata prima di cancellarla. Trappola misurata su un prodotto reale: due delle otto «chiavi morte» erano vive, usate da un descrittore e da due controller, e il conteggio è sceso a ogni via di riferimento modellata: le chiavi fra doppie graffe e `{i18n>…}` nel manifest, le chiavi calcolate, le chiavi del framework nei bundle `enhanceI18n` (Fiori elements le legge per convenzione: non compaiono nel codice).

**I bundle di Fiori elements.** Un `enhanceI18n` che punta a un file assente non dà errore: Fiori elements ripiega sui suoi testi di default mentre il manifest afferma che sono personalizzati, e `run_manifest_validation` non lo vede, perché il valore è una stringa valida: l'incoerenza sta fra il manifest e il disco. Nel verso opposto, un bundle di testi di Fiori elements che nessun `enhanceI18n` nomina è testo scritto, tradotto e inerte.

**Divergenze fra app**: la stessa chiave con valori diversi in bundle di app diverse.

```bash
git ls-files '*/webapp/i18n/*.properties' | node -e '
const fs = require("fs"), v = {};
for (const f of fs.readFileSync(0, "utf8").split("\n").filter(Boolean)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([^#!\s][^=:]*?)\s*[=:]\s*(.*)$/), lang = (f.match(/_([a-zA-Z]{2,3}(?:_[A-Za-z]{2,4})?)\.properties$/) ?? [, "(base)"])[1];
  if (m) ((v[`${lang} ${m[1]}`] ??= {})[m[2]] ??= []).push(f.replace(/\/webapp\/.*/, ""));
}
for (const [k, vals] of Object.entries(v)) if (Object.keys(vals).length > 1) console.log(k, "→", Object.entries(vals).map(([t, a]) => `"${t}" (${a.join(", ")})`).join(" | "));'
```

Alcune chiavi divergono per progetto: titolo e descrizione dell'app, titolo della tile, chiavi del framework che nominano l'entità dell'app. Le altre costano anche senza impatto visibile oggi: chi legge il bundle sbagliato conclude il falso, e la forma divergente appare il giorno in cui un controller legge quella chiave dal bundle dell'app. Misurato su un prodotto reale: si chiude subito il sottoinsieme oggettivo (una variante è l'etichetta generata dal nome tecnico); sul resto, dove fra due forme c'è una preferenza e non un difetto, un gate a cricchetto impedisce che il numero cresca invece di pretendere zero.

**CodeList** (cap). Quali tradurre lo dice il modello: quelle raggiunte da un `@Common.Text` su un campo esposto in `@UI.LineItem`, `@UI.SelectionFields` o `@UI.FieldGroup`. Un codice del CSV base assente da `_texts` ricade sulla lingua base (una tendina mezza in un'altra lingua, senza errori); una riga di `_texts` senza il base è orfana; un `name` vuoto è peggio di uno assente, perché la vista localizzata ripiega solo sul `NULL` e con `@Common.TextArrangement: #TextOnly` la cella resta bianca. Se la cella prende il testo da un `case … end` nella proiezione e la tendina dalla CodeList, filtro e cella parlano due lingue: si corregge nella proiezione, con l'associazione di testo, non in `db/data`.

**La lingua che arriva davvero** (backend). Misura la catena di risoluzione: la lingua della richiesta, `cds.env.i18n.default_language`, le variabili d'ambiente che il codice legge; e cerca quelle variabili nei descrittori di deploy (`mta.yaml`, chart, `Dockerfile`). Trappola misurata su un prodotto reale: una catena con due variabili e un ripiego all'inglese, variabili impostate in nessun descrittore, quindi in ogni ambiente il bundle inglese e quello italiano morto, con il default del prodotto in italiano. Nessun test lo vedeva, perché la suite gira con l'ambiente di sviluppo.

**abap.** Un messaggio T100 sta in 73 caratteri e usa `&1`…`&4` in modo coerente fra le lingue; `new_message_with_text` con un testo letterale non si traduce: è un finding. Le traduzioni si verificano nel sistema: se Nova ARC-1 non le legge, sono `NON VERIFICATO`.

### Fase 3 — Formattazione: apostrofi, segnaposto, a capo

Verifica prima di toccare un solo apostrofo, con `get_api_reference` su `ResourceBundle#getText`:

- **UI5.** `getText(chiave, args)` passa per `formatMessage` ogni volta che `args` c'è, anche vuoto, con o senza segnaposto; lì l'apostrofo singolo è il carattere di escape. Non raddoppiato viene mangiato (misurato: l'utente leggeva «Loperazione», «dallarchivio») e, in un testo con segnaposto, il segnaposto non viene sostituito. L'errore simmetrico: raddoppiato dove `formatMessage` non gira (binding `{i18n>chiave}`, `getText` senza argomenti) mostra due apici. Quindi mai «raddoppia tutti gli apostrofi»: per ogni chiave con apostrofo, trova come viene letta. Per le chiavi del framework, confronta col bundle della libreria per la stessa chiave e lingua.
- **CAP.** `cds.i18n` sostituisce `{0}` e `{nome}` con un semplice `replace` (verificato in `@sap/cds`, `lib/i18n/bundles.js`): nei bundle del servizio l'apostrofo è letterale e non si raddoppia. In ABAP l'apostrofo dei T100 è letterale.
- Un segnaposto fra apici (`'{0}'`) in `formatMessage` è inerte: va sistemato in ogni caso.
- **Segnaposto sui due lati insieme.** Misurato su un prodotto reale: la conferma di un'azione di massa non diceva quanti elementi, mentre la gemella sì; aggiungere `{0}` al solo bundle avrebbe stampato `{0}`, passare gli argomenti al solo chiamante li avrebbe scartati in silenzio. Non è un difetto la chiave usata come modello e sostituita a mano (`.replace("{0}", …)`): un gate che la segnala viene spento al primo giro.
- **Formati.** `formatMessage` non supporta tipi né stili: `{0,number,#,##0.00}` e `{0,date,medium}` valgono `{0}`, il resto viene ignorato (verificato sul sorgente UI5). Numeri, importi e date si formattano prima, con i tipi e i formatter di UI5 o sul server con la lingua della richiesta; mai stringhe pre-formattate a mano, mai concatenazione con `+`.
- Nel `.properties`, `\n` è un a capo e `\\n` sono due caratteri.

### Fase 4 — Classificazione

| Classe | Quando |
|---|---|
| `OK` | già conforme al registro e al canone |
| `POLISH` | ritocco: punteggiatura, maiuscole, articolo, accento |
| `REWRITE` | riscrittura di tono o di struttura |
| `CHIAVE` | manca, è morta o diverge |
| `PII_RISK` | dato personale non mascherato in un messaggio, una notifica o un log |
| `TECH_LEAK` | dettaglio tecnico esposto: stack trace, ID interni, SQL, costanti e codici interni, testo d'errore di un sistema remoto o del database |
| `CONTENUTO` | il testo è giusto, sbagliata è la logica che lo mostra: non si riscrive, si segnala |
| `LEGAL_REVIEW_REQUIRED` | testo legale (informativa privacy, consenso, condizioni d'uso): non si tocca senza firma |

Trappola misurata, e cambia la natura del finding: un finding che chiede «una riga che spieghi perché il comando è disabilitato» può essere un difetto di **contenuto**. Su un prodotto reale nove punti del codice trattavano un solo codice documento dove il catalogo ne classificava due: aggiungere il testo avrebbe spiegato il difetto invece di chiuderlo. Prima di riscrivere un testo, chiediti se sta descrivendo un comportamento sbagliato.

Anti-pattern da rilevare:

| Difetto | Perché conta |
|---|---|
| colloquiale o telegrafico («ops!», «ok dai», abbreviazioni, emoticon); maiuscole indiscriminate, esclamativi multipli | toglie credibilità a un'applicazione aziendale |
| tono accusatorio («hai sbagliato», «non puoi») | → «l'operazione non è disponibile per …» |
| tecnicismo non spiegato («404», «null pointer», «SQL error») | all'utente il messaggio operativo, al log il dettaglio |
| «Errore.» senza contesto né azione | costa un ticket |
| sigla del dominio non sciolta alla prima occorrenza | il dominio lo dice `REQUEST.md`, non chi scrive |
| due lingue nello stesso messaggio; punteggiatura incoerente | |
| segnaposto mancante o concatenazione | Fase 3 |
| terminologia diversa fra due schermate per lo stesso concetto | l'utente crede che siano due cose diverse |
| stato vuoto senza un'azione | è il momento in cui si abbandona |
| identificatore interno nel testo: costante, enum grezzo, nome tecnico, dove una CodeList dà l'etichetta | l'utente non può farci nulla. Eccezione derivata, non decisa a mano: se il token è una chiave dei parametri configurabili (`CONFIG_ENTITY`) che l'amministratore deve digitare, nominarlo è l'informazione. Le deroghe vanno per chiave, non per token |
| in italiano, accento mancante o reso con l'apostrofo (`puo`, `piu`, `perche`, `societa`, `e'`) | un vocabolario chiuso, non un correttore ortografico: zero rumore |

Per i dati personali parti dal modello: i campi `@PersonalData.IsPotentiallyPersonal` o `IsPotentiallySensitive`, cercati in messaggi, notifiche e log. Se il modello non li annota, ripiega sui nomi (email, telefono, codice fiscale, IBAN…) e dichiara che è un'euristica.

```bash
node -e "require('@sap/cds').load('*').then(m=>{for(const [n,d] of Object.entries(m.definitions))for(const [e,el] of Object.entries(d.elements??{}))if(el['@PersonalData.IsPotentiallyPersonal']||el['@PersonalData.IsPotentiallySensitive'])console.log(n+'.'+e)})"
git ls-files "${SRV:-srv/}" | grep -E '\.(js|ts)$' | xargs grep -HnE "req\.(error|reject|warn|info)\([^)]*\b(err|e|error|ex)\.(message|stack)"   # errore interno passato all'utente
```

### Fase 5 — Riscrittura

Per ogni `POLISH` e `REWRITE`: tieni l'intento (che cosa è successo, che cosa fare ora); applica il registro; conserva i segnaposto, o aggiungili dove c'era una concatenazione; un testo letterale diventa una chiave in tutti i bundle dell'app, con la convenzione di nomi che il bundle già usa; un messaggio del backend con testo letterale diventa una chiave di `messages*.properties`. Riscrivi prima nella lingua `REPORT_LANG`, se i bundle l'hanno, poi allinea le altre lingue misurate: una traduzione non verificata da un madrelingua si marca `REVISIONE_MADRELINGUA`.

Registro `formale` (default):

- soggetto impersonale o implicito («L'operazione non può essere completata», non «Non puoi completarla»); voce attiva e frase diretta («Riprova tra qualche minuto», non «Sarà necessario riprovare»); una sola persona in tutto il prodotto;
- chiusura operativa: un passo successivo concreto, quando esiste;
- lingua canonica: niente troncamenti («config» → «configurazione»), niente prestiti dove esiste il termine, salvo quelli del canone;
- lunghezze indicative: messaggio d'errore ≤ 120 caratteri, corpo di un dialog ≤ 250, toast ≤ 80; per notifiche, email e pulsanti le soglie di `sap-fiori-guidelines`;
- maiuscole: le linee guida SAP Fiori prescrivono il title case per le **etichette** (campi, colonne, sezioni, tab, pulsanti) e il sentence case per la **prosa** (tooltip, banner, messaggi, stati vuoti). Il perimetro è l'etichetta, non la frase: il title case su una frase la rende illeggibile. Nelle altre lingue la regola la fissa il canone; se il canone tace, vale la forma prevalente misurata;
- punto finale nelle frasi compiute, non nelle etichette; nessun esclamativo.

Registro `cordiale`: seconda persona e frasi brevi, un esclamativo raro ammesso; le altre regole restano.

Il canone si applica, non si reinventa (*Regole*). Trappola misurata su un prodotto reale: il conteggio grezzo dava molte etichette «non in title case», ma il rilevatore non conosceva le parole che restano minuscole (preposizioni, congiunzioni); i difetti veri erano poche incoerenze in due direzioni, la più cara lo stesso concetto scritto con due maiuscole diverse in due entità. E una conversione cieca avrebbe riscritto un termine che il canone aveva deciso: una riscrittura che non conosce le decisioni prese le rompe. Un termine mai giusto si vieta ovunque; uno spesso giusto in altri sensi si vieta solo dove l'ambito lo dice (il codice tecnico della riga, il contesto nominato nella riga), o il gate avrà più deroghe che riscontri e sarà allentato entro una settimana.

**Debito dichiarabile.** Un intervento di stile su una grande parte delle etichette è legittimo solo in blocco, da uno script con un gate, oppure lasciato consapevolmente e registrato. Correggerne una parte a caso è peggio di entrambe, e sulle etichette che sono nomi accessibili è un rischio reale: un'etichetta riscritta deve lasciare intatto il legame `labelFor` o `ariaLabelledBy`, e se il legame manca è un finding di accessibilità, non di stile.

Esempi prima/dopo:

```diff
# messaggio del backend (CAP): una chiave, non un testo; nei bundle del servizio l'apostrofo è letterale
- req.reject(409, 'Stato non valido per questa azione')
+ req.reject(409, 'ACTION_NOT_IN_STATUS', [statoLeggibile])   // l'etichetta dello stato dalla CodeList, non il codice
+ ACTION_NOT_IN_STATUS=L'operazione non è disponibile nello stato {0}. Verifica lo stato del documento e riprova.
# toast (UI5)
- MessageToast.show("Ok!")
+ MessageToast.show(oBundle.getText("actionDone"))            // actionDone=Operazione completata.
# conferma (UI5): getText con argomenti passa da formatMessage, quindi l'apostrofo si raddoppia
- MessageBox.confirm("Sei sicuro? Vuoi davvero eliminare?")
+ MessageBox.confirm(oBundle.getText("deleteConfirm", [aSelezionati.length]), { title: oBundle.getText("deleteTitle") })
+ deleteConfirm=Eliminare {0} elementi? L''eliminazione non è reversibile.
# bundle
- errInvalidInput=Errore: input invalido!!!
+ errInvalidInput=Il valore inserito non è valido. Controlla il formato e riprova.
# dettaglio tecnico e dato personale
- req.reject(502, err.message)
+ LOG.error('chiamata al sistema remoto fallita', err); req.reject(502, 'REMOTE_UNAVAILABLE')
+ REMOTE_UNAVAILABLE=Il sistema collegato non risponde. Riprova tra qualche minuto.
- LOG.warn(`Notifica non inviata a ${user.email}`)
+ LOG.warn(`Notifica non inviata a ${maschera(user.email)}`)  // l'helper di mascheramento del progetto
# behavior (ABAP): una classe di messaggi, non un testo letterale
- new_message_with_text( severity = if_abap_behv_message=>severity-error text = 'Stato non valido' )
+ new_message( id = '<classe>' number = '001' severity = if_abap_behv_message=>severity-error v1 = <stato leggibile> )
```

## Correzioni (`fix`)

- Mai sul ramo di default: un ramo dedicato, con la convenzione del profilo (`BRANCH_CONVENTION`).
- Mai file già modificati da altri, salvo richiesta esplicita.
- Solo quick win: impatto locale e reversibile, pochi file, nessuna migrazione di dati, nessun contratto di servizio nuovo, nessuna decisione di prodotto (ruoli, separazione dei compiti, stati del processo), nessuna credenziale reale.
- Correzioni in parallelo solo su file disgiunti: si raggruppa per proprietario del file, non per tema.
- Ogni finding chiuso porta il test o il gate che lo tiene chiuso, con la prova di sensibilità.
- Test e compilazione mirati, commit con il trailer del profilo, push e pull request. Niente `[skip ci]`.

Per i testi, in più:

- **Si correggono**: refusi, accenti e punteggiatura; il segnaposto al posto della concatenazione, testo e chiamata insieme; la chiave mancante, in tutte le lingue del bundle; il testo letterale portato nel bundle; il messaggio del backend portato in `messages*.properties`; il dato personale mascherato con l'helper del progetto. Solo aggiornamenti di stringhe: nessuna chiave rinominata né rimossa, al più 50 righe di diff per file.
- **Restano nel rapporto**: i testi legali; il rinomino di una chiave già usata da annotazioni, manifest o codice; la traduzione completa di un bundle; le CodeList nei seed (i dati già caricati devono restare coerenti); l'intervento di stile in blocco (*Debito dichiarabile*); ogni cambio del canone; un helper di mascheramento che non esiste ancora (che cosa è dato personale è una decisione).
- abap: le scritture sul sistema solo se il playbook ha abilitato quelle di Nova ARC-1; altrimenti la correzione resta proposta nel rapporto.
- Verifiche: gli script del progetto per nome (`lint*`, `test*`, `typecheck*`, `build*`) pertinenti ai file toccati, dicendo quali sono girati; la compilazione del modello se cambiano annotazioni o bundle del servizio; i controlli della Fase 2 rieseguiti, che ora devono tacere su ciò che hai chiuso.
- Commit `fix(text-polish): <ambito> — <N> testi` con `COMMIT_TRAILER`.
- Mai in parallelo con `/nova-app-audit` né con `/nova-ux-quality` in `fix`: toccano gli stessi file (bundle, etichette, annotazioni) e si sovrascrivono.

## Esito

```markdown
# Testi · <PROJECT_NAME> · <ambito> · <aaaa-mm-gg>
Registro e canone applicati · lingue misurate · sorgenti scansionate, e quelle non scansionate con il motivo

## Sintesi
- testi analizzati per sorgente · OK · POLISH · REWRITE · CHIAVE · PII_RISK · TECH_LEAK · CONTENUTO · LEGAL_REVIEW_REQUIRED
## Dati personali e dettagli tecnici (urgenti)
| file:riga | Testo | Problema | Correzione proposta |
## REWRITE
| file:riga | Prima | Dopo | Chiave | Note |
## POLISH
| file:riga | Prima | Dopo | Tipo |
## Lacune dei bundle
| Chiave | <una colonna per lingua> | Usata in |
## Contenuto, decisioni e proposte respinte dal canone
## Statistiche
- file con più interventi · coerenza del registro: quota di OK e POLISH sul totale · segnaposto: chiavi con segnaposto chiamate con gli argomenti giusti, N su M
```

Stampa la sintesi anche nella risposta. I testi citati restano nella loro lingua; il commento è in `REPORT_LANG`. Poi, sempre:

- **Rapporto** in `AUDIT_DIR/<aaaa-mm-gg>-<nome-del-comando>.md`, nella lingua `REPORT_LANG`, con `file:riga` come link. Ogni finding ha cinque parti: dove (`file:riga` o il comando che l'ha prodotto), impatto su un utente o su un dato, evidenza (l'output, il numero, la riga), azione, quick win sì/no.
- **Registro dei pendenti** (`PENDING_REGISTER`): i finding già registrati cambiano stato (`Chiuso`, `Ancora aperto`, `Parzialmente corretto`, `Superato`, `Rinviato`) con l'evidenza; i nuovi si aggiungono. Non si cancella niente.
- **Costo**: tempo per fase, cosa non è stato eseguito e perché.
- **Playbook**: se il comando gira per un passo del playbook NOVA, chiudilo solo se l'esito lo consente, con `node .claude/nova/install.mjs done <PASSO> --evidence "<rapporto>: <esito in una riga>"`. Con finding bloccanti aperti il passo resta aperto.

## Regole

1. **Solo la forma, mai la semantica.** Se il testo descrive un comportamento sbagliato, è `CONTENUTO`, per una revisione umana.
2. **Un testo legale non si tocca senza firma**: `LEGAL_REVIEW_REQUIRED`.
3. **Il canone è una decisione, non una preferenza di chi scrive**: una proposta che lo contraddice si respinge e resta registrata come respinta, non dimenticata.
4. **Un dato personale si maschera prima** di arrivare a un log o a una notifica.
5. **Chiavi nuove con la convenzione del bundle** (misurala dai prefissi prevalenti), mai una tua; mai rinominare una chiave usata.
6. **Riscrivi con le regole del registro**, non con un servizio esterno: i testi del prodotto non escono dal repository.
7. **In `report` nessuna modifica**, anche se la correzione è evidente.
