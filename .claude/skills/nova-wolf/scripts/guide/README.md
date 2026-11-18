# Guide per il cliente: sorgente unica, Word e PowerPoint con il brand

Strumento dei passi INSTALL_CONFIG_GUIDE, USER_GUIDE e GUIDE_CHECK. Una guida è una cartella
`docs/guides/<nome>/` del repository dello sviluppo:

| File | Chi lo scrive | In consegna |
|---|---|---|
| `guide.yaml` | lo sviluppatore, con il builder: l'unica sorgente | no |
| `screenshots/figNN-<id>.png` | `capture.mjs` (app, dal mock) o a mano sul sistema (transazioni SAP) | dentro i documenti |
| `<fileBase>.docx`, `<fileBase>.pptx` | `build.mjs`, mai a mano | **sì** |
| `capture-sap.md` | `build.mjs` (la tabella delle schermate SAP da catturare) | no |
| `build.json` | `build.mjs` (hash di sorgente, schermate e brand) | no |
| `open-points.md` | lo sviluppatore: i punti ancora aperti dietro la guida | **mai**: il build non lo legge |

Guide di uno sviluppo:
- `docs/guides/install-config/`: guida di installazione e configurazione. In un progetto del cliente è la guida di
  configurazione e attivazione; per un add-on comprende installazione, aggiornamento e disinstallazione.
- `docs/guides/user-<ruolo>/`: una guida d'uso per ogni ruolo (admin, revisore, utente finale…).

## Comandi

```sh
npm ci --prefix <skill>/scripts/guide          # una volta: docx, pptxgenjs, js-yaml, jszip alle versioni del lockfile
node <skill>/scripts/guide/capture.mjs --guide docs/guides/user-admin --base-url http://localhost:8080 \
     --start "npm run start-mock"              # schermate delle app dal mock e dal sandbox FLP
node <skill>/scripts/guide/build.mjs --guide docs/guides/user-admin [--brand docs/brand] [--pdf /tmp/review]
node <skill>/scripts/guide/check.mjs docs/guides/* --output docs/audit/<data>-guides.md
```

`check.mjs` esce con 1 se una guida ha una schermata mancante (resta il riquadro «screenshot to be inserted»), se i
documenti non sono stati rigenerati dopo l'ultima modifica di sorgente, schermate o brand, o se nella sorgente o
nei documenti c'è un marcatore di sviluppo: «not verified», «NON VERIFICATO», «da verificare», segnaposto, TODO/TBD,
«open risk», «rischio aperto», riferimenti interni (NV-…, SR-…, DS-…, DEC-…), percorsi di `docs/` dello sviluppo. La
guida descrive solo lo stato finale del prodotto: quello che non è ancora certo va in `open-points.md` e si chiude
prima della consegna.

Ogni schermata è scattata a pagina ferma: caricati i font, finite le transizioni e le animazioni CSS finite (Playwright le porta
allo stato finale, il cursore lampeggiante è nascosto). Due catture della stessa pagina danno così la stessa immagine, anche se un
pulsante ha una transizione in corso. Il browser parte con flag di resa fissi (senza GPU, senza partial raster, senza LCD text,
profilo sRGB, senza hinting dei font) e due fotogrammi disegnati prima dello scatto, perché l'antialiasing degli angoli arrotondati
non dipenda dalla macchina; `--chrome-args="<flag> <flag>"` li sostituisce (con il segno `=`, perché il valore inizia con `-`), `--chrome-args=` non ne passa nessuno.

## guide.yaml

```yaml
meta:
  kind: install-config            # oppure user
  role: Amministratore             # solo per kind user: una guida per ruolo
  language: it                     # it o en: le etichette dei documenti
  product: Gestione ordini
  title: Guida di configurazione e attivazione
  subtitle: "SAP S/4HANA 2023, Private Edition"
  docVersion: "1.0"
  date: "2026-11-03"
  fileBase: Gestione_ordini_Guida_configurazione
  vendor: Key2                     # facoltativo: altrimenti company di brand.json
  vendorLegal: Key2 S.r.l.
  about:                           # righe della tabella del documento
    - [Destinatari, "Basis, amministratore della sicurezza, key user"]
  imagesNote: >-
    Le schermate delle app vengono dalle app stesse, in un launchpad locale con dati dimostrativi fittizi; quelle
    delle transazioni SAP dal sistema di test.
chapters:
  - id: overview
    title: Panoramica e prerequisiti
    intro:                         # blocchi: p, h, list, note, table, checklist
      - p: Testo con `codice` e **grassetto**.
      - table: {columns: [Componente, Nome tecnico], widths: [40, 60], rows: [[App, "`ZORD_MANAGE`"]]}
      - checklist: {columns: [Controllo, Chi], rows: [["Ruoli copiati", Sicurezza]]}
    steps:
      - id: "1.1"
        title: Copia il ruolo modello
        goal: Avere un ruolo del cliente con le autorizzazioni dell'app.
        who: Amministratore della sicurezza
        prereq: ["Utente con `S_USER_AGR`"]
        where: PFCG
        path: ["Ruolo `Z_ORD_ADMIN_T`", "Copia ruolo"]
        fields:
          - [Ruolo di destinazione, "`Z_ORD_ADMIN`"]
        expected: Il ruolo `Z_ORD_ADMIN` esiste con le autorizzazioni del modello.
        verify: ["SUIM: il ruolo ha l'oggetto `Z_ORD_AUTH`"]
        fail: ["Ruolo modello assente: il trasporto dell'app non è stato importato"]
        figure:
          id: sap-pfcg-copy        # minuscole, cifre e trattini; il file sarà screenshots/figNN-sap-pfcg-copy.png
          kind: sap                # sap: catturata a mano sul sistema; app: catturata da capture.mjs
          title: Copia del ruolo modello in PFCG
          tcode: PFCG
          path: Ruolo › Copia ruolo
          shows: Dialogo di copia da Z_ORD_ADMIN_T a Z_ORD_ADMIN
      - id: "1.2"
        # … gli stessi blocchi; una figura già mostrata si richiama con figure_ref: <id>
```

Una figura `app` dice come si cattura:

```yaml
        figure:
          id: app-order-list
          kind: app
          title: Lista degli ordini
          capture:
            url: /test/flpSandbox.html?sap-theme=sap_horizon#SalesOrder-manage
            waitFor: .sapMListTbl
            clip: {x: 0, y: 0, width: 1440, height: 560}    # oppure selector: '.sapMGT'
            click: [{role: button, name: Crea}]               # facoltativo
            user: alice                                       # facoltativo: chi è collegato (il ruolo della guida)
            forbid: ['Mario Rossi']                           # facoltativo: testi che la pagina non deve mostrare
            viewport: {width: 1600, height: 900}              # facoltativo: la finestra della figura (o "1600x900")
            keepFocus: true                                   # facoltativo: non togliere il focus (chiude i popover)
            session: shared                                   # facoltativo: fresh (predefinito) o shared
            timeout: 90000                                    # facoltativo: millisecondi per il caricamento e le attese
            compose: {selectors: ['#tile-a', '#tile-b'], gap: 16, padding: '40x32', background: '#fff'}   # facoltativo: una striscia di elementi
            hideFocus: true                                   # facoltativo: senza il bordo del focus (con keepFocus)
            after: [{selector: '#discard'}]                   # facoltativo: azioni dopo lo scatto (come click)
            reset: /mock/reset                                # facoltativo: URL chiamato (POST) prima della figura; false: nessuno
```

`capture.mjs` nasconde avatar e nome dell'utente nella shell bar e rifiuta una schermata che mostra un indirizzo
e-mail: i dati del mock devono essere fittizi.

Più server nella stessa cattura: `--server "<url>=<comando>"` (ripetibile) ne avvia un altro e ne aspetta la risposta;
una figura lo raggiunge con una `capture.url` assoluta su quell'indirizzo (una seconda licenza dimostrativa sulla
porta 8086, per esempio). `capture.compose` fa un'unica immagine di più elementi affiancati (una striscia di tile): ogni
elemento si fotografa da solo e il risultato è composto su una pagina bianca, senza dipendenze in più. `--names "Mario
Rossi,Anna Bianchi"` (o un file con un nome per riga) e `capture.forbid` rifiutano ogni scatto la cui pagina mostra uno di
quei nomi, come già gli indirizzi e-mail: un nome di persona non va in un documento per il cliente.

**Finestra, azioni, sessione.**
- **Finestra.** È 1440 × 900 per default; `--viewport 1600x900` la cambia per tutta la cattura e `capture.viewport` per
  una figura (le guide d'uso larghe, per esempio, dove una tabella a 1440 nasconde una colonna).
- **Azioni prima dello scatto.** `capture.click` accetta, oltre ai clic per ruolo e nome o per selettore CSS, un clic con
  la sua attesa (`{selector: '#x', wait: 500}`; l'attesa predefinita è 1500 ms), la scrittura in un campo
  (`{fill: '#campo', text: 'abc'}`), un tasto (`{press: 'Enter', on: '#campo'}`, senza `on` va alla pagina) e uno
  script sulla pagina (`{evaluate: "document.querySelector('.x').textContent = ''"}`, per esempio per svuotare
  un'etichetta).
- **Focus.** Prima dello scatto la skill toglie il focus, perché un campo attivo disturba l'immagine; così però si
  chiudono i popover aperti. `capture.keepFocus: true` non lo toglie.
- **Avatar.** Avatar e nome dell'utente si nascondono con un foglio di stile con `!important`, non con uno stile in
  linea: se UI5 ridisegna la barra, restano nascosti.
- **Sessione.** Ogni figura parte da un contesto del browser nuovo (`session: fresh`, predefinito): nessuno stato delle
  figure prima, né di sessione né locale. `session: shared` continua nel contesto dello stesso utente e della stessa
  finestra, per le figure che seguono un flusso. Un'app che tiene lo stato sul server ha bisogno di dati di prova
  separati per figura (un client diverso, un contesto isolato nel mock).
- **Errori e attese.** Un'attesa o un clic che falliscono, un 401 o una pagina rifiutata sono il problema di quella
  figura: le altre si catturano lo stesso, e l'uscita è 1 con l'elenco. `--timeout` (o `capture.timeout`) dà i
  millisecondi per il caricamento e le attese, 60000 per default, utile quando più cattura girano in parallelo.
- **Striscia da più pagine.** `compose.parts` prende gli elementi anche da altre pagine, o da un altro server:
  `compose: {parts: [{url: '/a', selector: '#tile', waitFor: '#tile'}, {url: 'http://localhost:8086/b', selector: '#tile'}]}`;
  una parte accetta `waitFor`, `wait`, `click` e `hide` come una figura e passa gli stessi controlli di e-mail e nomi.
  `compose.background` è il colore di fondo della striscia (bianco per default); `compose.padding` è la cornice attorno
  agli elementi, separata dalla distanza fra loro (`gap`): un numero, `"40x32"` (40 ai lati, 32 sopra e sotto) o
  `{x: 40, y: 32}`; senza, la cornice è larga quanto il `gap`.
- **Bordo del focus.** `keepFocus` tiene aperto un popover ma lascia il bordo del focus sull'elemento che lo ha:
  `hideFocus: true` toglie solo quello (il contorno e i bordi disegnati sui `::before` e `::after`).
- **Dopo lo scatto.** `capture.after` esegue le stesse azioni di `click` dopo lo scatto, che è già scritto: per scartare
  una bozza che la figura ha lasciato sulla pagina o sul server. Un errore dell'azione è il problema di quella figura.
- **Stato del mock.** Un contesto nuovo del browser non isola i dati di un server mock: una figura che preme Modifica
  lascia una bozza, e la figura dopo si apre nella bozza. `--reset <url>` (o `capture.reset` per una figura, `false` per
  nessuno) chiama quell'URL con POST prima di ogni figura, per riportare il mock allo stato iniziale; una risposta che
  non è un successo è il problema di quella figura.

Non serve il mock di SAP Fiori tools: si cattura ogni app che gira sul PC. Un progetto CAP con il suo launchpad
(`cds watch`, `app/launchpad.html` o il sandbox di cds-plugin-ui5) si avvia con `--start "npx cds watch"` e la `url`
della figura è sulla sua porta. Gli utenti fittizi di CAP (autenticazione `mocked`, utenti in `package.json` o
`.cdsrc.json`) entrano con l'autenticazione HTTP: l'utente della figura (`user`) o di `--user`, con la password in
`CAPTURE_PASSWORD` (vuota per gli utenti predefiniti), mai in `guide.yaml`; così ogni guida d'uso ha le schermate del
suo ruolo. I sistemi esterni che l'app chiama (SAP S/4HANA, SharePoint) li simula `cds watch` dai loro modelli quando
non ci sono credenziali, con i dati di prova del progetto: una schermata che dipende da un sistema vero si cattura a
mano, come quelle SAP.

## Brand (`docs/brand/`)

La caratteristica di profilo BRAND dice di chi è il brand; gli asset stanno sempre in `docs/brand/` del repository
dello sviluppo. Senza la cartella i documenti escono neutri. Per il brand Key2 c'è un kit pronto: si copia il contenuto
di `skills/nova-sap-store-materials/assets/key2business/assets/` (con `brand.json`, i loghi per carta bianca e per fondo
scuro, il marchio e il pattern) in `docs/brand/`.

```json
{
  "company": "Key2", "legal": "Key to Business S.r.l.", "font": "Arial", "mono": "Consolas",
  "colors": { "accent": "FFCC39", "accentText": "8F6A00", "tint": "FFF6DA", "ink": "0E0E12", "text": "1A1A21",
              "muted": "5A5A66", "dark": "0E0E12", "darkCard": "26262E", "darkBorder": "333340",
              "darkHeading": "EDECE9", "darkText": "C2C2CB", "darkMuted": "9C9CA6" },
  "logo": "logo.png", "logoOnDark": "logo-white.png", "mark": "mark.png", "pattern": "pattern.png",
  "markers": ["\\bPROGETTO-INTERNO\\b"]
}
```

- `logoOnDark`: PNG per la copertina scura (Word e slide); `mark`: icona dell'intestazione e del piede; `logo`: PNG per la
  carta bianca, usato se manca `logoOnDark`; `pattern`: PNG chiaro con trasparenza, in basso a destra delle copertine
  (in Word sbiadito al 14 %, sulle slide con la trasparenza). Lo stesso `brand.json` lo usa la skill
  nova-sap-store-materials (walkthrough, PDF di marketing, deck), così ogni documento per il cliente e il mercato ha lo
  stesso brand: le due skill accettano le stesse chiavi dei colori e rifiutano gli stessi errori (un colore sconosciuto,
  un logo che non è PNG); lo Store usa i colori scuri per copertine, deck e marketing e quelli chiari (`accentText`,
  `ink`, `muted`, `rule`) per le pagine bianche del walkthrough;
- con un brand, `check.mjs` controlla il logo in copertina (Word e prima slide) e la ragione sociale (`legal`) nel piede;
- colori in esadecimale; quelli assenti restano neutri. `accent` è un riempimento (e il testo sulle slide scure),
  `accentText` il testo in accento sulla carta bianca: con un accento chiaro serve un tono più scuro per leggerlo;
- font installati sui PC del cliente (Arial, Calibri…): i documenti non incorporano font;
- `markers`: espressioni regolari in più che `check.mjs` rifiuta (nomi in codice, sigle interne).

I template Word e PowerPoint dell'azienda (.dotx, .potx) restano in `docs/brand/` per i documenti scritti con la skill
docx (DF e DT): le guide prendono da `brand.json` colori, font e loghi e hanno un'impaginazione propria, uguale per
ogni sviluppo.
