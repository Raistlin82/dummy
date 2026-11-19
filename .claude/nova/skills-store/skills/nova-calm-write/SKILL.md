---
name: nova-calm-write
description: "Scritture in SAP Cloud ALM per sviluppi e programmi NOVA con le API pubbliche (Task, Test Cases, Features, Document, Development Library): requisiti e user story dalla specifica approvata, task nello sprint e nella release, difetti, legame requisito → feature, test case, stati della feature consentiti via API, documenti con versioni, evidenze di CI e ATC, sincronizzazione degli stati a ogni punto del lavoro. Sempre dry-run, conferma di chi ha il ruolo nel progetto e registro in docs/alm/calm-log.md; credenziali solo dall'ambiente o da SAP Credential Store; letture dal server MCP calm. Non imposta Ready for Production né Deployed, non approva requisiti né quality gate, non cancella, non configura Operations. Usala nei passi CALM_PROJECT, CALM_BACKLOG, CALM_TEST, ALM_FEATURE, CALM_DEPLOYED, CALM_DOCUMENTS, CALM_OPERATIONS, CC_ALM_PROJECT, CCW_ALM, CCW_ALM_CLOSE, CC_ALM_QGATES, o quando l'utente chiede di scrivere in SAP Cloud ALM."
---

# Scrivere in SAP Cloud ALM

Quando il cliente usa SAP Cloud ALM, lo sviluppo vive anche lì: requisiti e user story del progetto, test case, e una **feature** che raccoglie trasporti, richieste di cTMS e test fino al deploy. Le **letture** le fai con il server MCP `calm` (voce di catalogo `mcp-calmcp`, in sola lettura): `calm_list`, `calm_get`, `calm_analytics`, `calm_resources`. Le **scritture** con lo script `scripts/calm.mjs` di questa skill, sulle API pubbliche verificate (`references/api-sources.md`).

| Cosa | Come |
|---|---|
| Requisiti (`CALMREQU`) e user story (`CALMUS`): creare (con sprint, release, assegnatario, scadenza), aggiornare stato e sottostato, riferimenti | Task API `/api/calm-tasks/v1` |
| Legare requisito, user story, task o difetto alla feature; relazione task ↔ user story; commento di avanzamento su un task | Task API: `POST /tasks/{id}/featureAssignments`, `/relations`, `/comments` |
| Difetti (`CALMDEF`) trovati nel test, poi legati alla feature | Task API `/api/calm-tasks/v1` |
| L'elemento dello sviluppo nella Development Library (con il riferimento esterno all'ID NOVA) | Development Library API `/api/calm-crosslibrarydevelopments/v1` (corpo del POST **da verificare**: il piano lo mostra) |
| Test case manuali con attività, azioni, applicazioni, riferimenti | Test Cases API `/api/calm-testmanagement/v1` |
| Task di progetto (`CALMTASK`): una wave di un programma di codice custom (§9) | Task API `/api/calm-tasks/v1` |
| Feature: creare (con scope, release e responsabile), cambiare stato, riferimenti URL | Features API `/api/calm-features/v1` |
| Documenti (specifica, documento funzionale e tecnico): creare, caricare il file e le sue nuove versioni, legare a requisiti e user story, riferimenti URL | Document API `/api/calm-documents/v1` (§8) |
| Legare test case e requisiti (`/TaskAssignments` della Test Cases API) | Endpoint documentato ma **corpo non verificato**: dalla specifica `CALM_TM` sul SAP Business Accelerator Hub con `request`, oppure nell'app |
| Progetto, roadmap (template), fasi, sprint, team e ruoli, deployment plan e release | **Solo lettura** con `calm` (Project API): li crea il project lead nell'app *Projects and Setup*; NOVA non ha lo scope `calm-api.projects.write` |
| Approvazione di un requisito, quality gate, test plan ed esecuzione dei test | **A mano** nelle app *Requirements*, *Quality Gates*, *Test Preparation* e *Test Execution*, da chi ha il ruolo: nessuna API di scrittura |
| Stato *Ready for Production*, *Deployed*; trasporti e richieste di cTMS nella feature | **A mano** nell'app Features, da chi ha il ruolo (Change Manager approva per la produzione, Deployment Manager fa il deploy e lo conferma); *Deployed* viene dalla conferma del deploy |
| Esiti dei test automatici | **Nessuna API di push**: la Test Automation API la implementa il tool di test, e Cloud ALM legge da lui. Dalla CI lasci l'evidenza come riferimento (§4) |
| Landscape Management, monitoraggio, allarmi | **A mano**, dall'amministratore di Cloud ALM (§6) |
| Cancellazioni | **A mano**: lo script non cancella |

`node scripts/calm.mjs help` mostra i comandi, `node scripts/calm.mjs selftest` controlla lo script senza rete.

## SAP API Policy

Le API di Cloud ALM chiamate da un agente sono il caso delle API SaaS (argomento `SAAS_API`,
[docs/wolf/15](../../docs/wolf/15-sap-api-policy.md)): la policy non lo tratta in modo esplicito; uno script o un server
MCP gestito dal cliente sulle API pubblicate è ammesso sotto la sua responsabilità (FAQ v1.3, Q56). La via è quella che
l'amministratore sceglie nel configuratore: diretta (il default), attraverso l'MCP Gateway di SAP Integration Suite
(le API di Cloud ALM esposte nel gateway) o una persona; il passo del playbook dice quale vale per lo sviluppo.

## Regole

- **Due istanze, scope minimi.** calmcp legge con un'istanza *SAP Cloud ALM API* che ha solo scope `calm-api.*.read` (compreso `calm-api.projects.read` per progetto, fasi, sprint e release). Le scritture usano un'**altra** istanza, con solo quello che lo sviluppo scrive: `calm-api.tasks.read` e `.write`, `calm-api.testcases.read` e `.write`, `calm-api.features.read` e `.write`, per i documenti `calm-api.documents.read` e `.write` e, solo se il progetto usa la Development Library, `calm-api.library.read` e `.write`. Mai `calm-api.projects.write`, mai `calm-api.documents.delete` o `calm-api.library.delete`, mai `calm-api.testcases.delete` o `.force-delete`, mai scope di Operations. La crea chi ha Global Account Administrator nel global account di Cloud ALM (`references/api-sources.md`, *Enabling SAP Cloud ALM API*).
- **Credenziali solo dall'ambiente**: `CALM_TENANT` e `CALM_REGION` (o `CALM_API_BASE`, `endpoints.Api` + `/api`, per un host diverso da `<tenant>.<region>.alm.cloud.sap`) e la service key intera dell'istanza di scrittura in `CALM_WRITE_SERVICE_KEY`, l'unica credenziale: lo script ne ricava client, segreto, URL del token (`uaa.url` + `/oauth/token`) e base dell'API. Un client in variabili separate non si legge più (decisione del product owner, 18/11/2026: non si confrontava con il tenant). Nel runtime Nova WOLF la service key sta in **SAP Credential Store**, una per tenant: password `nova-calm-write-key-<sottodominio>` nel namespace dell'esecutore, e l'esecutore porta quella del tenant del programma in `CALM_WRITE_SERVICE_KEY` (sessione `wolf interactive`) o, in un'esecuzione autonoma, in un file della sola esecuzione indicato da `NOVA_CALM_WRITE_FILE` (§12). Lo script rifiuta una chiave il cui `endpoints.Api` non è il tenant di `CALM_TENANT` e `CALM_REGION` (o di `CALM_API_BASE`), e dice il nome della chiave che manca. Mai nel repository, in chat o nei log; non chiedere all'utente di incollare il binding. Lo script maschera i segreti.
- **Un solo progetto.** `CALM_PROJECT_ID` è il progetto Cloud ALM dello sviluppo. Lo script rifiuta un payload di un altro progetto e, prima di ogni modifica, legge l'oggetto e si ferma se non è del progetto.
- **Ogni scrittura: piano, conferma, esecuzione, registro.**
  1. Esegui il comando senza `--apply`: lo script stampa metodo, percorso, corpo e l'*hash del piano*, senza segreti.
  2. Mostra il piano all'utente e chiedi, con AskUserQuestion (*Confermo la scrittura* · *Non scrivere* · *Correggo il piano*), il sì esplicito di chi ha il ruolo nel progetto Cloud ALM (per esempio il project lead o il responsabile della feature). Cloud ALM registra come autore il client tecnico, non la persona: il sì dice chi ha deciso.
  3. Riesegui lo stesso comando con `--apply --confirm <hash> --confirmed-by "<nome, ruolo>"`. Se il piano è cambiato, lo script si ferma.
  4. Lo script registra ogni richiesta in `docs/alm/calm-log.md` del repository dell'app: ora, progetto, richiesta, esito, id e display ID, chi ha confermato. Riporta i display ID (per esempio `3-12`) dove servono, nella specifica o nel rapporto del passo, e committa.
- **Programma avviato senza persona** (decisione del product owner, 19/11/2026; `docs/wolf/23-programmi-senza-persona.md`): quando il contesto dell'esecuzione dice che il programma è avviato senza persona, nessuno risponde ad AskUserQuestion. Le scritture della **wave** (task, feature, test case, commenti, documenti, stati fino a *In Testing*: `CCW_ALM`, `CCW_ALM_CLOSE`) non aspettano un sì: la conferma è l'avvio del programma. Fai il piano (passo 1), poi `--apply --confirm <hash> --confirmed-by "avvio senza persona di <chi>, <data>"` con chi e la data del contesto; il registro `docs/alm/calm-log.md` resta per ogni scrittura. I quality gate restano di una persona e non fermano la wave: `node .claude/nova/install.mjs ask <PASSO> --for "<chi lo conduce>" --what "<il gate e le evidenze>"`. Il resto di questa sezione (produzione, quality approval, requisiti da approvare) non cambia.
- **Produzione: solo lettura.** Tutto ciò che porta in produzione o riguarda i sistemi di produzione non si scrive: gli stati *Ready for Production* e *Deployed*, i trasporti, il deploy dalla feature, la configurazione di Operations. Lo leggi con `calm` e prepari la lista per chi ha il ruolo. Lo script rifiuta questi stati.
- **Niente duplicati.** Prima di creare, leggi con `calm_list` (resource `tasks` con `project_id` e `task_type`, oppure `features`, `manual_test_cases`) se l'oggetto esiste già, per titolo o `externalId`.
- **Limite**: al massimo 500 richieste ogni 5 secondi; lo script le distanzia e ripete una volta su 429 o 503.

## 0. Preparazione (CALM_PROJECT)

1. Con l'utente, dal server `calm`: `calm_list` resource `projects` per il progetto dello sviluppo, `scopes` per lo scope dei test case, `feature_statuses` per i codici di stato del tenant. Dalla Project API in lettura (`/calm-projects/v1/projects/{id}`, `/timeboxes`, `/teams`, `/deploymentPlans`): la roadmap del progetto, la fase in corso, lo sprint, la release del deployment plan con cui lo sviluppo va in produzione e chi ha i ruoli (§11). Se manca il progetto, la release o lo sprint, li crea il project lead nell'app *Projects and Setup*: tu non li crei. Scrivi in `docs/technical.md` (sezione *SAP Cloud ALM*) progetto, scope, release e sprint.
2. Chiedi all'amministratore l'istanza di scrittura con gli scope minimi, e all'utente di impostare le variabili d'ambiente: tu gli dici i **nomi**, lui i valori.
3. `node <skill>/scripts/calm.mjs create-requirement --title prova` senza `--apply` deve stampare il piano con l'URL del tenant e il progetto giusti.

## 1. Specifica e backlog (REQUIREMENTS_SPEC, CALM_BACKLOG)

1. Nella specifica (REQUIREMENTS_SPEC) leggi con `calm` requisiti e user story del progetto (`calm_list`, resource `tasks`, `task_type` `CALMREQU` e `CALMUS`): la specifica riporta i loro display ID. Non scrivi ancora.
2. Dopo l'approvazione della specifica (CALM_BACKLOG) i nuovi criteri di accettazione diventano user story; un requisito nuovo solo se la richiesta ne porta uno che nel progetto non c'è. Ogni elemento nella release e nello sprint dello sviluppo (`release`, `timebox`), le user story con l'assegnatario; un riferimento (`add-task-reference`) alla scheda dello sviluppo nel configuratore lega il requisito allo sviluppo NOVA. Prepara un batch come `references/batch.example.json`, con `external-id` uguale all'ID della user story nella specifica (per esempio `US-03`):

   ```sh
   node <skill>/scripts/calm.mjs batch --file docs/alm/spec-items.json
   ```

   Dopo il sì, lo stesso comando con `--apply --confirm <hash> --confirmed-by "<nome, ruolo>"`. Poi scrivi i display ID nella specifica.
3. La feature dello sviluppo, se non c'è: `create-feature --title "<titolo dello sviluppo>" --priority 20 --scope <scopeId> --release <uuid> --responsible <utente>`. Lega requisiti e user story alla feature con `assign-task-feature --id <task> --feature <uuid>` (Task API, `POST /tasks/{id}/featureAssignments`), e un task di progetto alla user story che realizza con `relate-tasks`.
4. Un aggiornamento di stato di un requisito (per esempio in approvazione): `update-task --id <id> --file <patch.json>` con `status`, `subStatus`, `approvalState` dai valori di `references/api-sources.md`. L'approvazione vera resta di chi ha il ruolo.

## 2. Test case

Dai criteri Given/When/Then della specifica, un test case manuale per user story del flusso principale, come `references/testcase.example.json` (progetto, scope, attività, azioni con risultato atteso):

```sh
node <skill>/scripts/calm.mjs create-test-case --file docs/alm/testcases/US-03.json
node <skill>/scripts/calm.mjs update-test-case --uuid <uuid> --file <patch.json>     # solo title, isPrepared, priorityCode
node <skill>/scripts/calm.mjs add-test-reference --test-case <uuid> --name "Specifica US-03" --url <https://...>
```

`update-test-case` legge `modifiedAt` e lo manda come `If-Match`: se qualcuno ha modificato il test case nel frattempo, Cloud ALM risponde 412 e rileggi. Attività e azioni esistenti si cambiano sui loro endpoint (`/Activities/{uuid}`, `/Actions/{uuid}`) con `request`. Il legame test case ↔ user story (`POST /TaskAssignments`) ha un corpo che le pagine SAP non mostrano: leggilo dalla specifica `CALM_TM` sul SAP Business Accelerator Hub, oppure fallo nell'app.

## 3. Stato della feature durante lo sviluppo

Stati che lo script imposta, solo nei passaggi che l'API consente e con la conferma di chi ha il ruolo per quel passaggio (§11): *In Specification* → *In Implementation* (`IN_REALIZATION`) quando parte lo sviluppo, → *In Testing* (`IN_TESTING`) quando lo sviluppo è nel sistema o nel subaccount di test, → *Successfully Tested* (`SUCCESSFULLY_TESTED`) dopo il collaudo del referente funzionale; indietro a `IN_REALIZATION` se un test fallisce; `NOT_PLANNED` se la feature esce dal perimetro.

```sh
node <skill>/scripts/calm.mjs set-feature-status --uuid <uuid> --status IN_TESTING
node <skill>/scripts/calm.mjs add-feature-reference --uuid <uuid> --name "Pull request #42" --url <https://...>
```

Lo script legge la feature prima del cambio e ne mostra lo stato attuale; se il passaggio non è consentito, Cloud ALM risponde 400. *Ready for Production* si approva nell'app Features; *Deployed* arriva dal deploy.

## 4. Esiti dei test automatici dalla CI

SAP Cloud ALM non ha un'API per ricevere gli esiti: la *Test Automation API* (`CALM_TEST_AUTOMATION`) è l'interfaccia che un tool di test automation implementa, e Cloud ALM chiama il tool per sincronizzare i test case, avviarli e leggerne gli esiti (endpoint *Test Automation* in Landscape Management). Quindi:

- **evidenza dalla CI**, con l'API verificata: dopo i test, il job di CI (o tu) aggiunge alla feature, e se vuoi al test case, un riferimento URL al run con il conteggio del report JUnit:

  ```sh
  node <skill>/scripts/calm.mjs ci-evidence --feature <uuid> --junit reports/junit.xml --run-url <https://ci/run/123> [--test-case <uuid>]
  ```

  In CI lo script gira senza `--apply`: stampa nel log del job il conteggio e il piano, senza credenziali. L'evidenza la scrivi tu dopo la conferma, con lo stesso report e l'URL del run; se la pipeline deve scriverla da sola, è una scelta del responsabile del progetto Cloud ALM, con le credenziali nei secret della pipeline e scritta nel rapporto del passo.
- **esecuzione in Cloud ALM** (Test Execution, analytics dei test): manuale, oppure con un tool di test automation già integrato con Cloud ALM (per esempio Tricentis, UiPath, Panaya), da configurare dall'amministratore. Costruire un proprio provider della Test Automation API è un servizio da sviluppare, non un passo di questa skill. Il test plan (Test Preparation) e la sua esecuzione li prepara e li conduce il test manager nell'app: tu gli dai l'elenco dei test case e delle user story che coprono.
- **ATC come evidenza di qualità**: il risultato ATC dello sviluppo (o il delta ATC della wave) va alla feature come riferimento con il conteggio dei finding per priorità (`add-feature-reference --name "ATC <data>: <n> prio 1, <n> prio 2" --url <rapporto o run>`) e, alla consegna, come documento (§8). La dashboard di estensibilità di Cloud ALM legge solo l'ATC importato a mano nella System View (CR_GOVERN): sono due cose diverse.
- **Difetti**: un test fallito che non si corregge nella stessa sessione diventa un difetto (`create-defect`, legato alla feature con `assign-task-feature`), e la feature torna a `IN_REALIZATION`.

## 5. Feature pronta al deploy (ALM_FEATURE)

In sola lettura, con `calm`: `calm_get` resource `feature` (anche per display ID), `calm_list` resource `feature_task_assignments` e `feature_url_references`, `manual_test_cases`. Controlla requisito, user story, test del flusso principale con l'esito e ogni veicolo di trasporto, secondo il target del passo.

Quello che manca lo scrivi, con conferma, solo se è una scrittura di §1–§4 (un riferimento, una user story, un test case, lo stato fino a *Successfully Tested*). Il resto — assegnare trasporti o richieste di cTMS, la quality approval, *Ready for Production*, la configurazione dei sistemi (`/SDF/ALM_SETUP`, TMS, `SAP_COM_0690`, destination `CALM_FTR_CTMS_<suffisso>`) — va nella lista per chi ha il ruolo o per l'amministratore del sistema, nel rapporto del passo. Lo stato *Ready for Production* letto con `calm` è l'evidenza per `GO_LIVE_APPROVAL`.

## 6. Monitoraggio (CALM_OPERATIONS)

Registrazione in Landscape Management, casi d'uso di Health, Integration & Exception, Job & Automation e Real User Monitoring, filtri, soglie e destinatari degli allarmi non hanno un'API pubblica. Prepari la lista con `references/operations-handover.md` in `docs/technical.md`, sezione *Monitoraggio*, la consegni all'amministratore di Cloud ALM e, dopo, verifichi in lettura con `calm_list` (`landscape_objects`) e `calm_analytics` sui provider di Operations.

## 7. Quando non funziona

- **401 sul token**: la service key in `CALM_WRITE_SERVICE_KEY` non è più valida (rigenerata o cancellata sull'istanza): serve quella nuova. Una chiave senza `uaa.url` o `endpoints.Api` non chiede il token: non è la service key di un'istanza *SAP Cloud ALM API*.
- **403**: manca lo scope all'istanza di scrittura (`calm-api.tasks.write`, `calm-api.testcases.write`, `calm-api.features.write`); per un progetto privato o protetto servono anche `calm-api.projects.private.read` o `.protected.read`. Gli scope li aggiorna l'amministratore sull'istanza.
- **400 sul cambio di stato della feature**: passaggio non consentito dall'API (vedi §3).
- **412 / 428 sul test case**: `If-Match` vecchio o mancante; lo script lo legge da solo, riprova dopo aver riletto.
- **429**: oltre 500 richieste in 5 secondi; riduci il batch.

## 8. Documenti (CALM_DOCUMENTS)

La documentazione dello sviluppo (specifica, documento funzionale e documento tecnico) vive nel repository e, quando il cliente usa SAP Cloud ALM, anche come **documenti del progetto**, legati ai requisiti e alle user story che descrivono.

1. **Prima leggi.** Con `calm` o con la Document API in lettura: i documenti del progetto (`GET /calm-documents/v1/Documents?$filter=projectId eq <id>`) e i **tipi di documento del tenant** (sono configurabili: chiedi quale tipo usare per specifica funzionale e tecnica, e scrivilo in `docs/technical.md`, sezione *SAP Cloud ALM*). Un documento dello sviluppo che esiste già si riconosce dall'external reference uguale al percorso del file nel repository: non crearne un secondo.
2. **Crea il documento** una volta per file, con un breve contenuto HTML (scopo, versione, link al repository) e l'external reference:

   ```sh
   node <skill>/scripts/calm.mjs create-document --title "DF · <sviluppo>" --type <codice del tenant> \
     --content-file docs/alm/df-summary.html --external-id docs/deliverables/DF.docx --url <repository>
   ```
3. **Carica il file** (docx o pdf) e, a ogni nuova versione del documento, ricaricalo: la Document API non aggiorna un documento, ma ogni sostituzione del file ne aumenta la versione. Serve SAP BTP DMS configurato nel tenant (`GET /calm-documents/v1/DmsConfig`); senza, lascia il link al file nel repository (`add-document-reference`) e dillo all'utente.

   ```sh
   node <skill>/scripts/calm.mjs upload-document-file --uuid <documentUuid> --file docs/deliverables/DF.docx
   ```
4. **Lega** il documento ai requisiti e alle user story che copre (`assign-document-task --uuid <doc> --task <taskUuid>`, una volta per task) e, se serve, alla pull request o alla pagina del repository (`add-document-reference`).
5. Come per ogni scrittura: piano, conferma esplicita di chi ha il ruolo, `--apply --confirm`, registro in `docs/alm/calm-log.md`; riporta il display ID del documento (per esempio `7-49`) nella tabella delle versioni del documento. Lo stato del documento (per esempio approvato) lo cambia chi ha il ruolo, nell'app Documents.

## 9. Trasformazione del codice custom (CC_ALM_PROJECT, CCW_ALM, CCW_ALM_CLOSE)

Un programma di adeguamento o di refactoring è un progetto di conversione: il progetto lo crea il project lead con la roadmap del cliente (per esempio *SAP Cloud ERP Private - System Conversion* o *RISE with SAP Methodology - clean core success plan*, che generano anche i quality gate avanzati), tu lo leggi con `calm_list` e vi scrivi il requisito del programma (`create-requirement`) e i documenti del programma (§8).

**La wave è una release** del deployment plan del progetto: SAP descrive la release come il treno che porta in produzione insieme requisiti e feature. Il project lead apre la release della wave (o un gruppo di wave nella stessa release) e lo sprint in cui la wave si lavora; tu li leggi. Per ogni wave:

1. il task di progetto nella release e nello sprint, assegnato a chi ha preso la wave (`create-task --title "<wave>" --external-id <ID della wave> --release <uuid> --timebox <uuid dello sprint> --assignee <utente>`: prima `calm_list` per non crearne due);
2. la feature della wave nella stessa release (`create-feature --release <uuid> --responsible <utente>`) e il legame requisito del programma → feature (`assign-task-feature`);
3. i test case dei casi di business (§2);
4. il collegamento nel configuratore con `nova-config.mjs alm <wave> --task … --feature … --release …`.

Alla chiusura (`CCW_ALM_CLOSE`) sincronizzi gli stati come nella tabella del §10. Un work item che si chiude non crea oggetti in Cloud ALM (sarebbero centinaia): il suo avanzamento va nel commento del task della wave ai punti di sincronizzazione (`add-task-comment`). Stesse regole: dry-run, conferma, registro.

## 10. Sincronizzare gli stati

Ogni passo che cambia lo stato del lavoro in Nova WOLF aggiorna l'oggetto Cloud ALM corrispondente, con un solo piano per punto (un `batch`), la conferma di chi ha il ruolo e il registro. I codici di stato dei task li leggi dal tenant con `calm` (per esempio `CIPTKOPEN`, `CIPTKINP`); quelli dei requisiti sono in `references/api-sources.md`.

| Punto in Nova WOLF | Oggetto Cloud ALM | Scrittura | Chi conferma |
|---|---|---|---|
| Backlog approvato (`SPEC_APPROVAL` → `CALM_BACKLOG`) | requisiti, user story, task, feature | create-requirement / -user-story / -task, create-feature, assign-task-feature; feature → `IN_REALIZATION` | project lead o responsabile della feature |
| Avvio della wave (`CCW_START` → `CCW_ALM`) | task della wave, feature | task → in lavorazione (`set-task-status`), feature → `IN_REALIZATION` | project lead |
| Sviluppo nel sistema di test (`CALM_TEST`) | feature, test case, difetti | feature → `IN_TESTING`; `ci-evidence`; riferimento al risultato ATC; `create-defect` + `assign-task-feature` per un test fallito, feature → `IN_REALIZATION` | responsabile della feature, test manager |
| Collaudo superato (`UAT_TEST` → `ALM_FEATURE`) | feature, user story | feature → `SUCCESSFULLY_TESTED`; user story chiuse | chi ha il ruolo Tester nel progetto |
| Approvazione del rilascio (`GO_LIVE_APPROVAL`) | feature | **nessuna**: *Ready for Production* lo imposta il Change Manager nell'app | — |
| Deploy in produzione (`IMPORT_PROD`, `RELEASE_*`) | feature | **nessuna**: il Deployment Manager fa il deploy dalla feature e lo conferma (*Deployed*) | — |
| Dopo il rilascio (`CALM_DEPLOYED`) | task, requisiti | task e user story chiusi, requisito al suo stato finale (sottostato del tenant), commento con il riferimento al rilascio | project lead |
| Chiusura della wave (`CCW_ALM_CLOSE`) | task della wave, feature, documenti | commento con i volumi, task chiuso, feature → `IN_TESTING` se la richiesta è rilasciata, documenti caricati | project lead |
| Quality gate (`CC_ALM_QGATES`) | quality gate | **nessuna**: le evidenze sono documenti (§8); stato e risposte li dà chi conduce il gate | — |

## 11. Ruoli in SAP Cloud ALM

Chi conferma un piano deve avere in Cloud ALM il ruolo che quella modifica richiederebbe nell'app (SAP, *Role Collection Recommendations*):

- **Project Lead** (`imp_pjm_ProjectLead`): progetto, roadmap, fasi, sprint, team, deployment plan e release; conferma requisiti, user story, task e feature.
- **Project Member** / **Project Viewer**: lavorano o leggono nel progetto; con il Task Manager (`imp_tkm_TaskManager`) gestiscono task e user story.
- **Developer** (`imp_cdm_DeveloperCore`, `imp_cdm_StartImplementation`, `imp_cdm_HandoverToTest`): trasporti nella feature, stati *In Implementation* e *In Testing*.
- **Tester** (`imp_cdm_Tester`): stato *Successfully Tested*.
- **Change Manager** (`imp_cdm_ChangeManager`): *Ready for Production*.
- **Deployment Manager** (`imp_cdm_DeploymentManagerTest`, `imp_cdm_DeploymentManagerProd`): deploy in test e in produzione, conferma del deploy.

L'utente tecnico dell'istanza di scrittura non ha ruoli di business: per Cloud ALM l'autore è il client; il registro dice chi ha deciso.

## 12. Credenziali nel runtime Nova WOLF

- **Il segreto**: una service key per tenant (decisione del product owner, 18/11/2026: Key2 segue programmi di più clienti, ognuno con il suo SAP Cloud ALM). È la service key dell'istanza *SAP Cloud ALM API* di scrittura del tenant, come JSON, nella password `nova-calm-write-key-<sottodominio>` di SAP Credential Store, nel namespace dell'esecutore (`nova-wolf-executor`). Il sottodominio è la prima parte dell'host del tenant in minuscolo (`https://key2cliente.eu10.alm.cloud.sap` → `nova-calm-write-key-key2cliente`), la stessa regola della chiave del configuratore. La password `nova-calm-write-key` di prima vale ancora per un'installazione con un solo tenant, e solo per il tenant del suo `endpoints.Api`. Chi la crea: l'amministratore del global account di Cloud ALM; chi la mette nel Credential Store: l'amministratore di Nova WOLF.
- **Come arriva allo script**: l'esecutore mappa `CALM_WRITE_SERVICE_KEY` su `nova-calm-write-key` (anche se `WOLF_CREDSTORE_SECRETS` non la nomina), ma non la legge per tutto il processo. A ogni sessione (`wolf interactive`) prende dal configuratore il tenant del programma (suo, del programma o del landscape SAP BTP), legge la chiave di quel tenant e la mette in `CALM_WRITE_SERVICE_KEY`, con `CALM_TENANT` e `CALM_REGION`. Una chiave che manca o di un altro tenant è detta in una riga, con il suo nome, e la sessione parte senza chiave. Lo script ne ricava client, segreto, URL del token e base dell'API. `CALM_PROJECT_ID` viene dal configuratore (scheda dello sviluppo o del programma, sezione *SAP Cloud ALM*).
- **Gli agenti autonomi** (Agent SDK sul gestore delle esecuzioni, Job su Kyma, `wolf run`, `run-item`, `steps`): stessa regola, il tenant del programma e la sua chiave, solo per quell'esecuzione. La chiave non va in una variabile: Claude Code toglie dai comandi di un'esecuzione senza persona le variabili che sembrano credenziali. Il gestore la scrive in un file dell'esecuzione (cartella privata fuori dalla cartella del repository, su Kyma in memoria), lo indica con `NOVA_CALM_WRITE_FILE` e lo cancella alla fine, anche su Stop o errore. Lo script la legge da lì; `CALM_WRITE_SERVICE_KEY`, se c'è, vince. Su Kyma la legge il dispatcher e la passa nel Secret dell'esecuzione, come la chiave Claude. Una chiave che manca o di un altro tenant è detta nel log dell'esecuzione, con il suo nome; l'esecuzione va avanti e lo script rifiuta di scrivere. Un programma senza tenant: nulla cambia. La politica dell'esecuzione rifiuta `Read` e `cat` del file; il codice che la sessione esegue può leggerlo. Limite noto: nelle esecuzioni della procedura (`wolf steps`) la politica rifiuta un comando su un percorso di `.claude/skills`, quindi lo script lì non parte (`docs/wolf/19-percorso-guidato.md`, 24.5); nelle wave parte se il manifest dell'agente ha `Bash(node *)`.
- **Claude Managed Agents**: la chiave non si passa. Andrebbe copiata in un vault del workspace Anthropic (fuori da SAP Credential Store) e arriverebbe nella sandbox come segnaposto opaco, che lo script non può leggere come JSON ([Authenticate with vaults](https://platform.claude.com/docs/en/managed-agents/vaults), letto il 18/11/2026). I passi che scrivono in SAP Cloud ALM vanno sul runtime o in Claude Code; **da verificare** se una forma futura lo permette con una chiave per tenant in SAP Credential Store.
- **Rotazione**: una nuova service key sostituisce la password; l'esecutore la rilegge alla scadenza della cache.
