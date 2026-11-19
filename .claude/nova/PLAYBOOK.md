# Playbook · Sample

The standard procedure of this development, from the NOVA configurator: follow the steps in order.
Written by the NOVA installer from the manifest and `progress.json`; do not edit it, use
`node .claude/nova/install.mjs next`, `done <step>`, `skip <step>`.

The parallel checks only read: `node .claude/nova/install.mjs ready` gives the round to run now, up to 6 checks, each in the read-only subagent nova-checker. Then `ready --check`: the round must leave the tree as it found it, and it lists the reports the checkers wrote in .claude/nova/checks. A check done by hand comes before the round, alone. The fixes come after, in series.

Ask the user every question with the AskUserQuestion tool, with choices: 2 to 4 options drawn from the configurator, the repository or the request, the recommended one first, up to 4 questions a call; confirmations and approvals are choices too. Never ask for a secret. Without the tool, a numbered list of the same options.

- Modalità: Nuovo sviluppo
- Tipologia: App SAP Fiori elements
- Target di deployment: SAP BTP Cloud Foundry
- Interfaccia utente: SAP Fiori elements
- Versione SAPUI5: SAPUI5 1.148
- Floorplan: List report e object page
- Estensioni custom della UI: No
- Versione OData: OData V4
- Crea o modifica dati: Sì
- Bozza (draft): Sì
- Backend: Nessun backend
- Linguaggio: TypeScript
- Funzionalità AI: No
- Processo a fasi: No
- Pubblicazione sul SAP Store: No
- Pubblicazione dell'app su SAP BTP: Site di SAP Build Work Zone, standard edition
- App di SAP S/4HANA nello stesso site: No
- Vista del site di SAP Build Work Zone: Spaces e pages
- SAP Cloud ALM: Sì
- Configurazione di SAP BTP: Guidata
- Consegna dello sviluppo: Progetto del cliente
- Brand dei documenti per il cliente: Dell'azienda che sviluppa
- Proprietario del repository: Dell'azienda che sviluppa

## SAP BTP landscape

- **Development**: SAP BTP sviluppo (subaccount di NOVA) (BTP_DEV): subaccount dev-emykt6ie (ID 83bccc77-527a-45c4-a09c-f28c31abc152); global account keytobusinesssrl; region eu10; Cloud Foundry https://api.cf.eu10-005.hana.ondemand.com, org nova-dev-org, space nova-dev-space; IAS https://aww4s9pgx.accounts.ondemand.com; SAP Cloud ALM https://key-to-business-srl-cloudalm.eu20.alm.cloud.sap; btp-administration with Direct Connection (IAS tenant aww4s9pgx).

Before any check or change in SAP BTP, make sure you are on the development subaccount above: with btp-administration the subaccount 83bccc77-527a-45c4-a09c-f28c31abc152, with the cf CLI `cf login -a https://api.cf.eu10-005.hana.ondemand.com --sso` and `cf target -o "nova-dev-org" -s "nova-dev-space"`. Test and production are only read, and changed by who administers them.

Missing landscapes (test, production, transports) are asked to the developer before UAT_TEST and the release.

What the application must do: [REQUEST.md](REQUEST.md).

Playbook: 3/76 steps closed, 1 deviation. Next: TOOLKIT_VERIFY · Verifica degli strumenti del piano (gate, skill nova-wolf). Run: node .claude/nova/install.mjs next

## A · Fondamenta

- [ ] **TOOLKIT_VERIFY** · Verifica degli strumenti del piano · _gate_ · `nova-wolf`
- [ ] **SKILLS_DISCOVERY** · Skill per le funzioni ancora da coprire · _action_ · `find-skills`
- [x] **BTP_ENVIRONMENT** · Ambiente SAP BTP pronto · _gate_ · `mcp-btp-admin` — done 2026-11-19, decided by gabriele@key2.it: btp CLI (gabriele.rendina@lutech.it) + cf (session of c.ferraro@key2.it, read only). Subaccount dev-emykt6ie 83bccc77 eu10 OK; org nova-dev-org/space nova-dev-space exist; entitlements assigned: destination lite, html5-apps-repo app-host+app-runtime, build-workzone-standard foundation, SAPLaunchpad, application-frontend free, identity application. Decision: no Work Zone site, project approuter (profile to change in the configurator); Cloud Logging not assigned by choice (test). Nothing added. NOT VERIFIED (403, missing Subaccount Viewer): subaccount trust with IAS aww4s9pgx, subscriptions, role collections: open request to admins before DEPLOY_PREREQS. Forced: TOOLKIT_VERIFY, SKILLS_DISCOVERY still open. Report in docs/handoff.md (deviation: closed before TOOLKIT_VERIFY, SKILLS_DISCOVERY)
- [ ] **PROJECT_CONVENTIONS** · Convenzioni del progetto in CLAUDE.md · _action_ · `init`
- [ ] **BRANCH_AND_PR** · Branch di sviluppo e pull request · _action_ · `cli-git`
- [ ] **SOURCES_CHECK** · Fonti SAP raggiungibili · _gate_ · `mcp-sap-docs`
- [ ] **SCENARIO_RESEARCH** · Ricerca dello scenario sulla documentazione SAP · _action_ · `mcp-sap-docs` · challenge required
## B · Discovery & Design

- [ ] **CALM_PROJECT** · Lo sviluppo nel progetto SAP Cloud ALM · _action_ · `nova-calm-write`
- [ ] **REQUIREMENTS_SPEC** · Specifica dei requisiti · _action_ · `doc-coauthoring`
- [ ] **SPEC_APPROVAL** · Approvazione della specifica · _approval_ · decided by A-03
- [ ] **CALM_BACKLOG** · Il backlog nel progetto SAP Cloud ALM · _action_ · `nova-calm-write`
- [ ] **SOLUTION_DESIGN** · Architettura e solution design · _action_ · `btp-diagram-generator` · challenge required
- [ ] **DIAGRAM_CHECK** · Diagrammi di architettura validati e rivisti · _gate_ · `btp-diagram-generator`
- [ ] **DESIGN_APPROVAL** · Approvazione dell'architettura · _approval_ · decided by A-02
- [ ] **AUDIT_PROFILE** · Profilo d'audit · _action_ · `/nova-audit-profile`
- [ ] **UX_DESIGN** · Disegno UX secondo SAP Fiori · _action_ · `sap-fiori-guidelines`
- [ ] **UI5_VERSION_SELECT** · Scelta della versione SAPUI5 · _action_ · `sapui5`
## C · Build

- [ ] **FE_GENERATE** · Generazione dell'app Fiori elements · _action_ · `sap-fiori-app-development`
- [ ] **FE_ANNOTATIONS** · Annotazioni e pagine · _action_ · `sap-fiori-app-development`
- [ ] **FE_RUN_CHECK** · L'app parte e mostra i dati · _gate_ · `run`
- [ ] **UI5_TYPESCRIPT** · Setup o conversione TypeScript dell'app UI5 · _action_ · `ui5-typescript-conversion`
- [ ] **LAUNCHPAD_BTP** · Contenuto del launchpad su BTP · _action_ · `sap-fiori-tools`
- [ ] **APPROUTER_BTP** · App su BTP con l'application router del progetto · _action_ · `sap-fiori-tools`
## D · Quality gate

- [ ] **IDENTITY_SETUP** · Identity Authentication, trust e SSO · _gate_ · `mcp-btp-admin`
- [ ] **AUTH_MATRIX** · Matrice di ruoli e autorizzazioni · _action_ · `/nova-security-matrix` · challenge required
- [ ] **IAS_CONFIG_DEV** · Applicazione, gruppi e utenti di test in IAS (sviluppo) · _action_ · `sap-btp-cloud-identity-services` · optional
- [ ] **IDENTITY_PROVISIONING** · Utenti e gruppi con Identity Provisioning · _action_ · `nova-ips-provisioning` · optional
- [ ] **SECURITY_REVIEW** · Revisione di sicurezza · _gate_ · `security-review` · parallel check
- [ ] **SUPPLY_CHAIN** · Dipendenze e SBOM · _gate_ · `cli-supply-chain` · parallel check
- [ ] **LINT** · Lint · _gate_ · `cli-ui5-linter` · parallel check
- [ ] **APP_AUDIT** · Audit di ogni app · _gate_ · `/nova-app-audit` · parallel check
- [ ] **I18N_COMPLETENESS** · Testi traducibili e completi · _gate_ · `/nova-text-polish` · parallel check
- [ ] **CODE_REVIEW** · Revisione del codice · _gate_ · `code-review` · parallel check
- [-] **UI_TESTS** · Test QUnit e OPA5 del codice freestyle · _gate_ · not done — skipped , decided by the rigor of the development (STANDARD): Solo nel livello di rigore Completo: si aggiunge con una scelta sulla funzione
- [ ] **E2E_A11Y** · End-to-end e accessibilità · _gate_ · `/nova-e2e-run`
## E · Release & handover

- [ ] **CI_PIPELINE** · Pipeline CI con i gate · _action_ · `sap-btp-developer-guide`
- [ ] **DEPLOY_PREREQS** · Prerequisiti del deploy nel subaccount di sviluppo · _gate_ · `mcp-btp-admin`
- [ ] **CF_BUILD** · Archivio MTA · _gate_ · `cli-mbt`
- [ ] **CF_DEPLOY_DEV** · Deploy su Cloud Foundry (sviluppo) · _action_ · `cli-cf`
- [ ] **CF_ROLES_DEV** · Ruoli agli utenti di test (Cloud Foundry) · _action_ · `mcp-btp-admin`
- [ ] **CF_DEPLOY_CHECK** · Verifica del deploy su Cloud Foundry · _gate_ · `cli-cf` · parallel check
- [ ] **APP_URL_CHECK** · App aperta dal suo URL, con i dati del backend · _gate_ · `run`
- [ ] **WORKZONE_SITE_DEV** · App nel site di SAP Build Work Zone (sviluppo) · _action_ · `sap-fiori-tools`
- [ ] **WORKZONE_CHECK** · App aperta dal site, con i dati del backend · _gate_ · `run`
- [-] **APP_PERFORMANCE** · Prestazioni dell'app · _gate_ · not done — skipped , decided by the rigor of the development (STANDARD): Solo nel livello di rigore Completo: si aggiunge con una scelta sulla funzione
- [ ] **OBSERVABILITY** · Log, metriche e allarmi · _action_ · `sap-btp-cloud-logging`
- [ ] **CALM_OPERATIONS** · Registrazione e monitoraggio in SAP Cloud ALM · _action_ · `mcp-calmcp`
- [ ] **RELEASE_AUDIT** · Audit di rilascio · _gate_ · `/nova-audit-all`
- [ ] **CTMS_SETUP** · SAP Cloud Transport Management per l'app · _action_ · `sap-btp-cloud-transport-management`
- [ ] **CF_DEPLOY_TEST** · Deploy nel subaccount di test (Cloud Foundry) · _action_ · `sap-btp-cloud-transport-management`
- [ ] **TEST_SYSTEM_CONFIG** · Configurazione del sistema di test · _action_ · `mcp-btp-admin`
- [ ] **CALM_TEST** · Test e qualità nella feature di SAP Cloud ALM · _action_ · `nova-calm-write`
- [ ] **UAT_TEST** · Collaudo nel sistema di test · _gate_ · `/nova-e2e-run`
- [ ] **ALM_FEATURE** · Feature di SAP Cloud ALM pronta al deploy · _action_ · `mcp-calmcp`
- [ ] **ROLLBACK_PLAN** · Piano di ripristino del rilascio · _action_ · `cf-cli`
- [ ] **GO_LIVE_APPROVAL** · Approvazione del rilascio in produzione · _approval_ · a person's
- [ ] **BTP_PROD_ENVIRONMENT** · Ambiente SAP BTP di produzione pronto · _gate_ · `mcp-btp-admin`
- [ ] **PROD_ROLE_ASSIGNMENTS** · Assegnazioni dei ruoli in produzione · _action_ · `mcp-btp-admin`
- [ ] **RELEASE_CF_PROD** · Rilascio in produzione (Cloud Foundry) · _action_ · `sap-btp-cloud-transport-management`
- [ ] **NON_TRANSPORTED_CONFIG** · Configurazione che non si trasporta · _action_ · `mcp-btp-admin`
- [ ] **PROD_ROLES_CHECK** · Ruoli di produzione verificati · _gate_ · `mcp-btp-admin`
- [ ] **SMOKE_PROD** · Verifica in produzione · _gate_ · `cf-cli`
- [ ] **CALM_MONITORING_CHECK** · Monitoraggio attivo in SAP Cloud ALM · _gate_ · `mcp-calmcp`
- [ ] **CALM_DEPLOYED** · Rilascio registrato in SAP Cloud ALM · _action_ · `nova-calm-write`
- [ ] **CODE_GRAPH_HANDOVER** · Grafo dello sviluppo consegnato · _action_ · `cli-graphify`
- [ ] **FUNCTIONAL_DOCS** · Documentazione funzionale · _action_ · `doc-coauthoring`
- [ ] **TECH_DOCS** · Documentazione tecnica · _action_ · `/nova-tech-docs`
- [ ] **DOCS_DELIVERABLES** · Documento funzionale (DF) e tecnico (DT) nel formato del cliente · _action_ · `docx`
- [ ] **CALM_DOCUMENTS** · Documenti nel progetto SAP Cloud ALM · _action_ · `nova-calm-write`
- [ ] **RELEASE_NOTES** · Release notes · _action_ · `docx`
- [ ] **BTP_LANDSCAPE_EXPORT** · Landscape SAP BTP esportato in codice Terraform · _action_ · `cli-btptf`
- [ ] **DOCS_COVERAGE** · Ogni oggetto consegnato è documentato · _gate_ · NOVA toolkit
- [ ] **INSTALL_CONFIG_GUIDE** · Guida di installazione e configurazione per il cliente · _action_ · NOVA toolkit
- [ ] **USER_GUIDE** · Guide d'uso per ruolo · _action_ · NOVA toolkit
- [ ] **GUIDE_CHECK** · Guide per il cliente complete e solo con lo stato finale · _gate_ · NOVA toolkit
- [ ] **HANDOVER_APPROVAL** · Consegna e chiusura dello sviluppo · _approval_ · decided by A-03

## Steps in full

### TOOLKIT_VERIFY · Verifica degli strumenti del piano

gate · category Toolkit & bootstrap · skill `nova-wolf` · applies because: Sempre

Esegui la verifica dell'installazione. Se blocca, risolvi prima di tutto il resto:
- strumenti di sistema mancanti: vanno nello script di setup dell'ambiente (sessione cloud) o sulla macchina;
- il landscape SAP BTP dello sviluppo (PLAYBOOK.md, sezione SAP BTP landscape): se manca il subaccount di sviluppo, chiedilo allo sviluppatore e fallo registrare nel configuratore prima di BTP_ENVIRONMENT;
- le altre variabili dei server MCP che la verifica elenca;
- skill dell'account (docx, xlsx, pptx, pdf): da abilitare su claude.ai;
- plugin: da installare in locale con claude plugin install.
Ripeti finché la verifica esce con 0.

**Check:** node .claude/nova/install.mjs verify esce con 0 (nessuna voce obbligatoria bloccante)

### SKILLS_DISCOVERY · Skill per le funzioni ancora da coprire

action · category Toolkit & bootstrap · skill `find-skills` · applies because: Sempre

Le funzioni del piano Da coprire (nessuna skill del catalogo le fa) sono quelle che .claude/nova/PLAYBOOK.md segna «none: done by hand, no skill covers this function yet», e il configuratore elenca nella sezione Funzioni con la copertura Da coprire. Se non ce ne sono, il passo si chiude subito.
Per ognuna cerca nell'ecosistema aperto con find-skills, come prescrive la skill: prima la classifica di skills.sh, poi npx skills find <dominio della funzione> e npx skills find <dominio> --owner sap per le fonti SAP.
Un candidato vale solo con una fonte ufficiale (SAP, Anthropic, Vercel, il produttore dello strumento) o con almeno cento installazioni e un repository mantenuto: registralo nel gap della funzione per gli amministratori del catalogo, con installazioni, fonte e il comando npx skills add <owner/repo@skill> (node <skill>/scripts/nova-config.mjs gap <ID> --step <PASSO> --text "<candidato>" --source https://skills.sh/<owner>/<repo>/<skill>). Senza candidati, scrivilo nel gap.
Non installarlo tu: una skill entra in uno sviluppo solo dal catalogo, valutata e pinnata dagli amministratori; intanto la funzione si fa a mano, come il piano dice.

**Check:** ogni funzione Da coprire del piano con i candidati trovati, o con la ricerca senza esito, registrata nel suo gap

### BTP_ENVIRONMENT · Ambiente SAP BTP pronto

gate · category Toolkit & bootstrap · skill `mcp-btp-admin` · applies because: Piattaforma: SAP BTP

Il subaccount da controllare è quello di sviluppo del landscape dello sviluppo (PLAYBOOK.md, sezione SAP BTP landscape): global account, subaccount (ID), regione e, su Cloud Foundry, org e space, su Kyma il cluster e il namespace. Non è quello su cui gira NOVA, se non è registrato così, né quello su cui btp-administration o la CLI puntano per caso: prima di ogni controllo verifica di essere su quel subaccount (btp-administration: il subaccount con quell'ID; su Cloud Foundry cf target con org e space dello sviluppo, su Kyma il kubeconfig del cluster e il namespace) e, se lo sviluppo non ne ha uno, fermati e chiedilo allo sviluppatore.
Prima di ogni controllo verifica la coerenza del profilo con il landscape e con le regole di SAP, e un conflitto lo porti subito allo sviluppatore come decisione a scelta, prima di qualunque lavoro:
- SAP Build Work Zone: dal 20 marzo 2025 l'abbonamento chiede la trust del subaccount con un tenant di SAP Cloud Identity Services; un profilo con il solo SAP ID Service e un site è in conflitto (scegli: stabilire la trust con IAS prima dell'abbonamento · nessun site, application router del progetto);
- il tenant IAS del landscape (PLAYBOOK.md, SAP BTP landscape: IAS) è quello che il subaccount ha davvero in Security › Trust Configuration.
Per leggere il subaccount ci sono due strade, e lo sviluppatore ne sceglie una sola volta (chiediglielo, una volta per sviluppo, e scrivi la scelta nel rapporto del passo):
1. il server MCP per l'amministrazione di SAP BTP (btp-administration: /mcp in Claude Code, poi il login SAP nel browser): solo dove il login OAuth si completa, cioè in una sessione locale. In una sessione cloud il server non si autentica (il sistema risponde che richiede autenticazione e che Claude non può avviare il login OAuth) anche se verify lo vede in .mcp.json: lì non lo provare;
2. la btp CLI, che in una sessione cloud è la sola strada. Non c'è, va installata e collegata una volta per sessione:
   a. scarica il client Linux (btp-cli-linux-amd64-latest.tar.gz, o arm64) da https://tools.hana.ondemand.com/additional/, estrailo con tar -xzf e mettilo in un PATH della sessione; il sito chiede di accettare la licenza SAP Developer: la accetta lo sviluppatore, non tu al suo posto (fonte: SAP Help «Download and Start Using the BTP CLI Client», letta il 2026-11-05; l'indirizzo cli.btp.cloud.sap/btpcli-install.sh è l'altra strada documentata, e la rete della sessione può bloccarla);
   b. il login lo lanci da Bash in background (run_in_background), perché resta in attesa: btp login --sso manual --url https://cli.btp.cloud.sap --subdomain <sottodominio del global account> --idp <origin key del tenant IAS>. La CLI stampa un indirizzo (--sso manual non apre il browser): lo sviluppatore lo apre e accede, la CLI si chiude da sola. Nessun comando con ! e nessun codice monouso da incollare: il codice monouso è di cf login --sso, non della btp CLI. L'indirizzo vale circa 5 minuti: un tentativo non completato finisce con «Could not log in to CLI server» e si rilancia (fonte: SAP Help «Log in with Single Sign-On», letta il 2026-11-05);
   c. la sessione della CLI sta in ~/.config/.btp/config.json (cartella nascosta .btp), fuori dal repository: nessun segreto nel repository, e a fine lavoro btp logout;
   d. un utente IAS senza ruoli sul subaccount legge solo il global account (btp get accounts/subaccount, btp list accounts/entitlement --global-account, che riporta anche le assegnazioni per subaccount): trust, abbonamenti e role collection del subaccount rispondono 403 o «not authorized», con le regole sotto;
   e. cf login --sso chiede un passcode monouso: da una sessione cloud lo space di Cloud Foundry non si legge, e il controllo dello space è NON VERIFICATO finché lo sviluppatore non lo legge con il proprio cf login.
Con la btp CLI, se il global account ha un identity provider custom (un tenant IAS) il login è btp login --sso manual --idp <tenant>, non solo --sso: gli origin key validi li dà btp list security/trust --global-account. Le role collection valgono per l'utente di un identity provider: chi entra con l'IAS custom ha bisogno di Global Account Viewer e Subaccount Viewer (o Administrator) assegnate al suo utente di quell'origin, altrimenti trust, abbonamenti e role collection del subaccount rispondono 403. Un controllo che risponde 403 non è verde: è NON VERIFICATO, con la role collection che manca, finché l'amministratore non la assegna:
- l'org di Cloud Foundry del landscape e lo space dell'app: se lo space non c'è ancora, crearlo è la prima modifica da proporre (cf create-space, con il tuo utente come Space Developer);
- gli entitlement e le quote dei piani che lo sviluppo usa:
- destination (lite);
- html5-apps-repo, piano app-host per il deployer;
- SAP Cloud Logging (OBSERVABILITY) e, se il modello ha dati personali, SAP Audit Log;
- l'abbonamento a SAP Build Work Zone nell'edizione del profilo e la role collection Launchpad_Admin per chi configura il site;
- il trust del subaccount con il tenant di SAP Cloud Identity Services del landscape (PLAYBOOK.md, SAP BTP landscape: IAS): un tenant per sviluppo e test, uno per la produzione; se manca, stabilirlo è una modifica da proporre (Security › Trust Configuration › Establish Trust), prima del primo deploy;
- SAP Audit Log se il modello ha dati personali.
Guarda anche, senza modificarli, i subaccount di test e produzione del landscape: se non ci sono, o non hanno gli entitlement dei piani a pagamento che il test e la produzione chiedono (SOLUTION_DESIGN), scrivilo fra le cose da chiedere agli amministratori.
Poi aggiungi solo quello che manca, in quest'ordine: space ed entitlement, la trust con il tenant IAS, gli abbonamenti (SAP Build Work Zone e Application Frontend si appoggiano alla trust già attiva), le role collection. Tutto prima del primo deploy: non si rimanda a dopo un errore del deploy. Ogni modifica la confermi con l'utente prima di farla, e la fa chi ne ha i diritti con il proprio utente: un 403 dice quale role collection serve. Mai nel subaccount di produzione: quello passa dal rilascio.
Con la CLI btp (la strada di una sessione cloud, o di chi non usa il server MCP) fai gli stessi controlli: btp list accounts/entitlement, btp list accounts/subscription, btp list security/role-collection.
Nel rapporto del passo scrivi cosa c'era, cosa hai aggiunto e cosa resta da chiedere agli amministratori.

**Fallback:** cli-btp, when the skill cannot run

**Check:** ambiente o servizio del target attivo; entitlement, abbonamenti e role collection dello sviluppo assegnati
trust del subaccount con il tenant IAS del landscape attiva
SAP Build Work Zone sottoscritto
quello che manca è una richiesta aperta agli amministratori, da chiudere prima del primo deploy (DEPLOY_PREREQS)

**SAP documentation:** https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/2d167cbbcec4417486d4f3fdfffa58e1.html

### PROJECT_CONVENTIONS · Convenzioni del progetto in CLAUDE.md

action · category Toolkit & bootstrap · skill `init` · applies because: Sempre

Crea o aggiorna CLAUDE.md con:
- scopo dello sviluppo, tipologia, target e release (dal profilo);
- struttura del repository, comandi di build, test e lint;
- la regola di lavoro: un passo del playbook per volta (node .claude/nova/install.mjs next), nessun gate chiuso senza evidenza, nessun segreto nel repository;
- la regola delle domande: ogni domanda all'utente con lo strumento AskUserQuestion e risposte a scelta (da 2 a 4 opzioni ricavate da configuratore, repository o richiesta, la consigliata per prima; conferme e approvazioni comprese), mai per segreti.

**Output:** CLAUDE.md

### BRANCH_AND_PR · Branch di sviluppo e pull request

action · category Toolkit & bootstrap · skill `cli-git` · applies because: Sempre

Lavora su un branch dedicato (feature/<nome-sviluppo>) e apri una pull request in bozza al primo commit.
Variante dichiarata: se il proprietario del repository ha deciso rami brevi, uno per passo o per gruppo di passi, con squash in main e senza un ramo feature/* di lunga durata, lo scrivi in PLAYBOOK.md come decisione (chi, quando, perché) e lavori così: un branch per passo (nova/<PASSO>), la sua pull request in bozza al primo commit, squash in main alla chiusura del passo. La storia del playbook sta allora nei commit dei passi e nei rapporti dei gate, non in un'unica pull request.
Il repository è quello dello sviluppo nel configuratore (development.repository del manifest, con il ramo principale): la sessione lavora in un suo clone; se il remote origin della cartella è un altro, fermati e chiedi all'utente se clonare quello registrato o correggere lo sviluppo. Le wave di un programma usano il repository del programma, salvo uno diverso registrato sulla wave.
Ogni passo chiuso è un commit con il riferimento al passo: nova(<PASSO>): <cosa è stato fatto>.
La pull request raccoglie la storia del playbook (PLAYBOOK.md) e le evidenze dei gate.
Con git crea il branch; la pull request (merge request su GitLab) la apri in bozza con gh o glab, autenticati con il loro login nel browser, oppure con il server MCP di GitHub se il piano lo ha. Nessun token nel repository.

**Check:** branch feature/* sul remoto e pull request in bozza aperta; con rami brevi dichiarati nel PLAYBOOK, almeno un ramo di passo e la sua pull request

**Output:** branch feature/*, pull request in bozza

### SOURCES_CHECK · Fonti SAP raggiungibili

gate · category Grounding su fonti SAP · skill `mcp-sap-docs` · applies because: Sempre

Verifica che i server MCP del piano rispondano con una ricerca di prova (sap-docs sempre; ui5, fiori, cap, nova-arc-1 secondo il piano).
Claude Code legge .mcp.json all'avvio della sessione: i server che install o apply hanno appena scritto non sono caricati in quella sessione, e il passo non può passare lì (l'installatore lo dice dopo apply e in next, ready e verify). Il passo si fa da una sessione nuova, non con un altro connettore al posto del server: il connettore SAP Docs di claude.ai è un'altra voce del piano, non il server sap-docs.
Prova solo i server che il piano di questo sviluppo assegna alle sue categorie, non ogni server di .mcp.json: un server di un altro prodotto (le BW Modeling Tools senza SAP BW/4HANA, SAP Cloud ALM senza CLOUD_ALM=YES) non si prova e non blocca; se il piano ne contiene uno che lo sviluppo non usa, segnalalo agli amministratori come condizione mancante.
Da qui in avanti ogni scelta tecnica cita la documentazione SAP della release target, non la memoria.

**Check:** ogni server MCP del piano risponde a una ricerca di prova

### SCENARIO_RESEARCH · Ricerca dello scenario sulla documentazione SAP

action · category Grounding su fonti SAP · skill `mcp-sap-docs` · applies because: Sempre

Prima della specifica, ricostruisci dalla documentazione tutto quello che SAP prescrive per lo scenario del profilo (tipologia, target, backend, integrazioni, launchpad), dall'ambiente al rilascio in produzione e all'esercizio. Consulta ogni fonte, non una sola:
- il server MCP SAP Docs: SAP Help della release target, SAP BTP Developer's Guide, capire, SAPUI5 e Fiori elements, ABAP, missioni e servizi del Discovery Center, SAP Community;
- le pagine fuori da SAP Help, lette con la ricerca web di Claude Code (WebSearch, WebFetch) o con un server di ricerca web dell'utente se ne ha uno: i tutorial e le missioni di SAP Developers (developers.sap.com), le architetture di riferimento dello SAP Architecture Center, i repository SAP-samples;
- i server MCP del piano (cap, fiori, ui5, nova-arc-1) per le API e gli oggetti reali.
Le sfidanti del piano rivedono docs/research.md ciascuna con le sue fonti (Exa per la ricerca web, sap-pce-expert per la Private Edition, i server MCP di CAP, Fiori, UI5 e UI5 Web Components per il loro stack): ogni attività documentata che manca o una fonte superata è un rilievo da verificare.
Scrivi docs/research.md: per fase, ogni attività che SAP documenta, dove si fa (repository, SAP BTP, sistema SAP, SAP Build Work Zone), se si esegue con uno strumento del piano o a mano, e la fonte (URL).
Confronta l'elenco con il playbook (.claude/nova/PLAYBOOK.md): per ogni attività la funzione che la copre, oppure MANCANTE. Per ogni attività MANCANTE cerca prima una skill con find-skills (npx skills find <attività>, anche --owner sap): i candidati con una fonte ufficiale o con almeno cento installazioni li scrivi accanto all'attività, con installazioni, fonte e comando. Le attività mancanti le presenti all'utente prima della specifica e le aggiungi alla specifica e all'architettura come lavoro da fare. Ognuna la registri anche nel configuratore, perché gli amministratori la vedano e ne facciano una funzione della procedura: node <skill>/scripts/nova-config.mjs gap <ID> --step <PASSO o SCENARIO_RESEARCH> --text "<cosa manca e perché>" --source <URL della fonte>.

**Fallback:** find-skills, when the skill cannot run

**Challengers:** mcp-exa, mcp-fiori, mcp-ui5 (challenge required)

**Output:** docs/research.md

### CALM_PROJECT · Lo sviluppo nel progetto SAP Cloud ALM

action · category Requisiti, specifica & accettazione · skill `nova-calm-write` · applies because: SAP Cloud ALM: Sì

Il cliente usa SAP Cloud ALM: lo sviluppo vive in un progetto di implementazione. Con il server MCP di Cloud ALM, in sola lettura (Project API: progetto, timebox, team, deployment plan), trova con l'utente il progetto dello sviluppo e leggi:
- l'approccio: la roadmap (template) del progetto e la fase in corso (Prepare, Explore, Realize, Deploy, Run, o le fasi del cliente);
- lo scope del progetto che contiene il processo dello sviluppo;
- la release del deployment plan con cui lo sviluppo andrà in produzione (la release raccoglie requisiti e feature che vanno in produzione insieme) e lo sprint in cui si lavora;
- chi ha i ruoli nel progetto: project lead, chi approva i requisiti, tester, Change Manager (Ready for Production), Deployment Manager (deploy e sua conferma).
Progetto, roadmap, fasi, sprint, release e ruoli li crea il project lead nell'app Projects and Setup, mai l'agente: se manca qualcosa chiedilo e aspetta. Se il progetto usa la Development Library, l'elemento dello sviluppo lo crei una volta sola con nova-calm-write (create-development, con il riferimento esterno all'ID dello sviluppo nel configuratore), in dry-run e con la conferma del project lead.
Scrivi progetto, scope, release, sprint e ruoli in docs/technical.md (sezione SAP Cloud ALM) e registra il collegamento nel configuratore: node <skill>/scripts/nova-config.mjs alm <ID dello sviluppo> --tenant <URL del tenant> --calm-project <ID del progetto> --release <release>. Le credenziali di scrittura vengono dall'ambiente o da SAP Credential Store (nova-calm-write, §12), mai dal repository.

**Fallback:** mcp-calmcp, when the skill cannot run

**Check:** progetto, scope, release, sprint e ruoli letti in Cloud ALM; collegamento registrato nel configuratore

**Output:** docs/technical.md, sezione SAP Cloud ALM

**SAP documentation:** https://help.sap.com/docs/CloudALM/fe419bfabbdc46dfbddbfd78b21483d5/18642f564fcf401f883d12e9ddc0f18d.html

### REQUIREMENTS_SPEC · Specifica dei requisiti

action · category Requisiti, specifica & accettazione · skill `doc-coauthoring` · applies because: Sempre

Parti dalla richiesta dello sviluppo in .claude/nova/REQUEST.md, scritta dal configuratore: cosa deve fare l'applicazione, il referente funzionale e i documenti da leggere.
- Leggi i documenti: i file con docx, xlsx e pdf-reading, i link con i connettori della sessione (per esempio SharePoint, Jira, Confluence) o chiedendoli all'utente.
- Se la richiesta è vuota, chiedila all'utente e scrivila nel configuratore (nova-config.mjs set <ID> --request-file), poi ripeti install.
Scrivi docs/specification.md:
- per una modifica, cosa cambia rispetto allo stato di partenza, e perché;
- obiettivo, attori e ruoli;
- user story con criteri di accettazione Given/When/Then;
- dati, regole e messaggi;
- requisiti non funzionali con soglie misurabili: prestazioni, accessibilità (WCAG 2.2 AA), sicurezza, lingue;
- cosa è fuori perimetro;
- il flusso del processo, quando aiuta a leggere la richiesta: un diagramma con la skill drawio (docs/specification/*.drawio, esportato in PNG nel documento).
Se il cliente usa SAP Cloud ALM (CLOUD_ALM), leggi con il server MCP di Cloud ALM, in sola lettura, requirement e user story del progetto (CALM_PROJECT): la specifica riporta i loro ID. I nuovi requisiti e criteri di accettazione hanno nella specifica il loro ID (REQ-…, US-…): diventano requirement e user story del progetto, con la feature dello sviluppo, solo dopo l'approvazione della specifica (CALM_BACKLOG).
Leggi anche i documenti del progetto Cloud ALM che riguardano lo sviluppo (Document API in lettura, nova-calm-write §8): sono fonti della specifica.
Chiedi all'utente solo quello che la richiesta e i documenti non dicono.

**Output:** docs/specification.md

### SPEC_APPROVAL · Approvazione della specifica

approval · category Requisiti, specifica & accettazione · skill none: the agent A-03 Independent Verifier of the team decides it, not a person · applies because: Sempre

Presenta la specifica a chi decide il passo (A-03 per la squadra, che la verifica contro la richiesta; il referente funzionale indicato in .claude/nova/REQUEST.md quando decide una persona) e chiedi l'approvazione esplicita.
Dopo l'approvazione le decisioni di costruzione che cambiano la specifica (una sfida accolta, il disegno UX, una correzione in ABAP_CHANGE) non riaprono questo passo: ognuna si registra con node .claude/nova/install.mjs spec-change <righe> --by <chi> --reason <perché>, con le righe di docs/specification.md cambiate, chi l'ha decisa e il motivo. Prima di HANDOVER_APPROVAL il referente riapprova in una volta sola il blocco delle modifiche registrate. Torna da questo passo (reopen) solo un cambio dei requisiti della richiesta.
Prima di chiedere l'approvazione prepara il pacchetto di evidenze in un solo documento o nella pull request, con i link; l'approvazione la dà chi decide il passo, esplicitamente: l'agente della squadra con l'autorità quando decide la squadra, altrimenti la persona indicata; tu la registri (chi, data, motivazione, riferimento) senza impostare tu stati che la rappresentano. Il pacchetto: la specifica e la matrice di tracciabilità dai requisiti ai criteri di accettazione.

**Check:** approvazione di chi decide il passo (A-03, o il referente funzionale)

### CALM_BACKLOG · Il backlog nel progetto SAP Cloud ALM

action · category Requisiti, specifica & accettazione · skill `nova-calm-write` · applies because: SAP Cloud ALM: Sì

Dopo l'approvazione della specifica porta il backlog nel progetto SAP Cloud ALM dello sviluppo (CALM_PROJECT) con nova-calm-write (§1, §10): prima leggi con il server MCP di Cloud ALM cosa c'è già (nessun duplicato, per titolo o external ID), poi un solo batch in dry-run e la conferma del project lead o del responsabile della feature:
- i requisiti nuovi (CALMREQU) e le user story (CALMUS) dai criteri di accettazione, con l'ID della specifica come external ID, nella release e nello sprint dello sviluppo, le user story con l'assegnatario; per ogni requisito un riferimento alla scheda dello sviluppo nel configuratore (add-task-reference), che lega il requisito allo sviluppo NOVA;
- la feature dello sviluppo, se non c'è, nello scope e nella release, con il responsabile (create-feature): è il veicolo di trasporti, test e deploy; ogni requisito e user story legato alla feature (assign-task-feature);
- i task di progetto (CALMTASK) del lavoro, se il project lead li vuole (costruzione, test, documentazione), ciascuno nello sprint, con l'assegnatario e la relazione alla user story che realizza (relate-tasks);
- lo sviluppo parte: la feature a In Implementation (set-feature-status IN_REALIZATION) e i requisiti al loro stato in realizzazione, con i codici del tenant (set-task-status).
L'approvazione dei requisiti resta di chi ha il ruolo, nell'app Requirements: tu non la imposti. La specifica riporta i display ID; registra nel configuratore: node <skill>/scripts/nova-config.mjs alm <ID dello sviluppo> --requirement <display ID del requisito principale> --feature <display ID della feature> --task <UUID del task principale>.

**Fallback:** mcp-calmcp, when the skill cannot run

**Check:** requisiti e user story della specifica nel progetto, nella release dello sviluppo e legati alla feature; feature In Implementation; ID registrati nel configuratore

**Output:** docs/alm/calm-log.md

**SAP documentation:** https://help.sap.com/docs/CloudALM/fe419bfabbdc46dfbddbfd78b21483d5/8049bdba661c4765a970b1465762e8f0.html

### SOLUTION_DESIGN · Architettura e solution design

action · category Architettura & solution design · skill `btp-diagram-generator` · applies because: Sempre

Scrivi docs/architecture.md:
- per una modifica: stato di partenza, cosa cambia, livello Clean Core obiettivo e perché;
- componenti e servizi SAP e BTP usati;
- flussi e integrazioni;
- sicurezza e ruoli;
- ambienti (sviluppo, test, produzione) e percorso di trasporto;
- i subaccount del landscape per sviluppo, test e produzione (PLAYBOOK.md, SAP BTP landscape): se manca quello di test, il collaudo (UAT_TEST) non ha dove girare, e va chiesto adesso agli amministratori, non al rilascio;
- requisiti non funzionali e piani dei servizi per ambiente: i piani free servono solo allo sviluppo, test e produzione chiedono piani a pagamento e quote nel global account (per esempio PostgreSQL standard o premium, anche in alta disponibilità, SAP Build Work Zone standard edition, SAP Audit Log premium se ci sono dati personali, SAP Cloud Logging standard o large e mai Application Logging, deprecato); verifica i limiti correnti di ogni piano free nel SAP Discovery Center e scrivi il costo previsto;
- decisioni con le alternative scartate;
I diagrammi si fanno con btp-diagram-generator, in draw.io secondo le SAP BTP Solution Diagrams, tutti e tre i livelli, ognuno nel suo file: L0 per il business (docs/architecture/<nome>-L0.drawio), L1 per i servizi e i flussi principali, L2 con i flussi di dati, i protocolli, la legenda e il blocco di descrizione. Si costruiscono con il builder Python della skill (BtpDiagram(level=...), poi save(), che valida), non scrivendo l'XML a mano; mentre li costruisci, validate_diagram.py --quality standard, e alla fine --quality showcase, che deve passare senza errori né warning.
Se il disegno cambia la specifica già approvata, la modifica si registra con node .claude/nova/install.mjs spec-change <righe> --by <chi> --reason <perché>, senza riaprire SPEC_APPROVAL.
Quelli che le Solution Diagrams non coprono (flussi del processo, sequenza delle chiamate, modello dei dati, un sistema on-premise senza SAP BTP) li fai con la skill drawio, in Mermaid convertito in .drawio o in XML, sempre in docs/architecture/.
Con il server mcp-drawio apri i diagrammi nell'editor draw.io per rivederli con l'utente (il diagramma resta nel frammento dell'URL, non va al server) e cerchi le forme con search_shapes, icone SAP comprese; mai l'app server ospitato mcp.draw.io con i diagrammi del cliente.

**Fallback:** drawio, mcp-drawio, when the skill cannot run

**Challengers:** sap-btp-developer-guide, drawio-skill-sap (challenge required)

**Output:** docs/architecture.md, docs/architecture/*.drawio

### DIAGRAM_CHECK · Diagrammi di architettura validati e rivisti

gate · category Architettura & solution design · skill `btp-diagram-generator` · applies because: Sempre

I diagrammi di docs/architecture/*.drawio usano le librerie delle SAP BTP Solution Diagrams (in draw.io dalla 24.7.5) e ci sono tutti e tre i livelli, L0, L1 e L2, anche in una modifica.
1. Validazione: per ogni file python3 .claude/skills/btp-diagram-generator/scripts/validate_diagram.py <file>.drawio --quality showcase --json, con 0 errori e 0 warning; salva la ricevuta JSON accanto al file (<file>.receipt.json). Un errore si corregge solo sull'oggetto indicato, poi si rivalida; se due correzioni di fila non riducono gli errori, fermati e riporta quelli che restano. Un warning di icone sfocate si corregge con upscale_svg_icons.py.
La ricevuta si legge per intero: il numero degli errori e dei warning è quello dell'elenco dei problemi del file (ogni voce con l'id dell'oggetto) al livello di qualità richiesto, non un riassunto parziale né il campo di un solo controllo. Se un conteggio è 0 ma l'elenco non è vuoto, o la ricevuta non dice il livello showcase, rilancia il validatore e cita quello che stampa.
Un diagramma di sequenza o di flusso scritto in Mermaid e convertito in .drawio (skill drawio) va normalizzato prima della validazione: node <skill>/scripts/drawio-normalize.mjs <file.drawio> dà un id a ogni UserObject, toglie i waypoint superflui e riporta i colori alla palette; poi si valida come gli altri. Senza la normalizzazione le ricevute delle sequenze convertite hanno contato 0 errori dove il validatore ne trovava più di cento.
2. Esporta ognuno in PNG con draw.io desktop (voce cli-drawio), con l'XML incorporato (-e) così l'immagine si riapre in draw.io, anche senza schermo: xvfb-run -a drawio --no-sandbox --export --format png --output docs/architecture/ <file>.drawio (senza draw.io desktop, l'immagine Docker rlespinasse/drawio-desktop-headless).
Un file che non si esporta è XML non valido: correggilo.
3. Revisione visiva: apri ogni PNG e guardalo, la validazione non la sostituisce. Controlla: nessuna forma sovrapposta (almeno 20 px di spazio); connettori ortogonali, con al massimo una piega e senza attraversare contenitori estranei; il contenitore SAP BTP racchiude tutti i servizi BTP e i sistemi esterni stanno fuori; L0 senza legenda e con connettori neutri, L2 con la legenda in alto a destra e il blocco di descrizione; le etichette dei connettori come pill, leggibili; nessun componente che la soluzione non ha. Ogni difetto si corregge nel builder, si rivalida (passo 1) e si riesporta.
4. Le immagini vanno in docs/architecture.md, così chi approva e chi sfida vede il disegno vero, con l'esito della revisione visiva scritto a parte da quello della validazione.

**Fallback:** cli-drawio, when the skill cannot run

**Check:** L0, L1 e L2 presenti; ricevuta showcase con 0 errori e 0 warning per ogni file; ogni .drawio esportato in PNG e rivisto a occhio con la lista del passo; le immagini in docs/architecture.md

**Output:** docs/architecture/*.png

**SAP documentation:** https://sap.github.io/btp-solution-diagrams/docs/solution_diagr_intro/intro/

### DESIGN_APPROVAL · Approvazione dell'architettura

approval · category Architettura & solution design · skill none: the agent A-02 SAP Technical Architect Agent of the team decides it, not a person · applies because: Sempre

Presenta architettura e decisioni a chi decide il passo (A-02 per la squadra, il responsabile tecnico quando decide una persona) e chiedi l'approvazione esplicita prima di scrivere codice.
Prima di chiedere l'approvazione prepara il pacchetto di evidenze in un solo documento o nella pull request, con i link; l'approvazione la dà chi decide il passo, esplicitamente: l'agente della squadra con l'autorità quando decide la squadra, altrimenti la persona indicata; tu la registri (chi, data, motivazione, riferimento) senza impostare tu stati che la rappresentano. Il pacchetto: architettura e diagrammi, con le decisioni sulle API e sul Clean Core.

**Check:** approvazione di chi decide il passo (A-02, o il responsabile tecnico)

### AUDIT_PROFILE · Profilo d'audit

action · category Architettura & solution design · command `/nova-audit-profile` · applies because: Interfaccia utente: SAP Fiori elements

Con /nova-audit-profile scrivi docs/audit/AUDIT_PROFILE.md: le decisioni che il codice non dice e che i comandi di audit dei passi successivi leggono.
- il campo che segrega i dati (società, organizzazione, tenant) oppure nessuno;
- le coppie di ruoli in conflitto (separazione dei compiti) oppure nessuna;
- i framework normativi dei finding di sicurezza;
- lingua e cartella dei rapporti, registro dei pendenti, convenzione dei rami.
Il comando misura prima di chiedere e chiede tutto insieme. Dominio, segregazione e separazione dei compiti li conferma il referente funzionale.

**Output:** docs/audit/AUDIT_PROFILE.md

### UX_DESIGN · Disegno UX secondo SAP Fiori

action · category UX, Fiori Design & accessibilità · skill `sap-fiori-guidelines` · applies because: Interfaccia utente: SAP Fiori elements

Secondo le SAP Fiori design guidelines scrivi docs/ux.md:
- floorplan del profilo;
- per ogni pagina campi, azioni, messaggi, stati vuoti e comportamento responsive;
- testi e lingue.
Aggiungi i requisiti di accessibilità: tastiera, etichette, contrasto, lettore di schermo (ui5-best-practices-accessibility per SAPUI5, ui5-wc-accessibility per UI5 Web Components).
Per ogni pagina nuova o che cambia disegna un wireframe con la skill drawio (forme mockup di draw.io, controlli SAP Fiori dove search_shapes di mcp-drawio li trova) in docs/ux/*.drawio, esportato in PNG in docs/ux.md; aprilo all'utente nell'editor con mcp-drawio e fallo approvare prima di generare o cambiare l'app.
Se il disegno UX cambia la specifica già approvata, registra la modifica con node .claude/nova/install.mjs spec-change <righe> --by <chi> --reason <perché>, senza riaprire SPEC_APPROVAL.

**Fallback:** mcp-drawio, when the skill cannot run

**Challengers:** fiori-elements-floorplans, ui-theme-designer-help, ui-theme-designer-design-tokens (challenge optional)

**Output:** docs/ux.md, docs/ux/*.drawio

**SAP documentation:** https://experience.sap.com/fiori-design-web/

### UI5_VERSION_SELECT · Scelta della versione SAPUI5

action · category UX, Fiori Design & accessibilità · skill `sapui5` · applies because: Interfaccia utente: SAP Fiori elements

Per un'app SAP Fiori elements o SAPUI5 usa la versione scelta nel profilo. Verifica il suo stato nella pagina ufficiale
SAPUI5 Versions Maintenance Status e che non superi la linea offerta dal target. Il configuratore propone per prima la
versione compatibile con la fine manutenzione più lontana; lo sviluppatore può sceglierne un'altra e ne registra il
motivo in docs/architecture.md. Fissa la stessa linea nel bootstrap, nei tipi @sapui5/types e negli strumenti di build.

**Output:** docs/architecture.md, versione SAPUI5 del progetto

**SAP documentation:** https://ui5.sap.com/versionoverview.html

### FE_GENERATE · Generazione dell'app Fiori elements

action · category Frontend Fiori Elements · skill `sap-fiori-app-development` · applies because: Modalità: Nuovo sviluppo

Genera l'app con il server MCP di SAP Fiori tools sul servizio OData del backend (V4 da CAP o RAP; su ECC V2 da SAP Gateway, sul front-end server hub), con il floorplan del profilo e la linea SAPUI5 del target.
Subito dopo la generazione, prima di FE_ANNOTATIONS, sistema il progetto npm dell'app, perché LINT e SUPPLY_CHAIN non lo rifiutino a fine sviluppo:
- ESLint: il generatore può scrivere ESLint 8 con .eslintrc; passa a ESLint 9 o 10 con la configurazione flat (eslint.config.mjs) e @sap-ux/eslint-plugin-fiori-tools (config recommended-for-s4hana), le versioni esatte nelle devDependencies, come in LINT (skill sap-fiori-eslint-plugin), e togli .eslintrc e le dipendenze di ESLint 8;
- workspace: niente workspace npm annidati (un package.json con workspaces dentro l'app o dentro un'altra cartella che non è la radice), che npm non installa. O l'app è un workspace del package.json della radice ("workspaces": ["app/<id>"], un solo package-lock.json nella radice, npm ci dalla radice), o è un progetto a sé con il suo package-lock.json e nessun workspace; scegli una delle due e scrivila in docs/technical.md;
- verifica: npm ci, poi npm ls --all (dalla radice, o nella cartella dell'app se ha il suo lockfile) senza errori (missing, invalid, extraneous) e npm exec --no -- eslint . nella cartella dell'app che parte con la configurazione nuova.
Ogni app nasce anche con quello che serve al run check senza sistema, sempre, che il generatore lo crei o no:
- ui5-mock.yaml con il mockserver di Fiori elements (sap-fe-mockserver) e lo script start-mock nel package.json;
- webapp/localService/ con il metadata.xml del servizio (dal $metadata o dal modello del backend) e i dati di prova in data/*.json;
- il sandbox del launchpad (webapp/test/flp.html o flpSandbox.html) con la tile dell'app sull'intent del manifest (semanticObject e action): npm run start-mock lo apre.
Il run check di ogni unità con UI (FE_RUN_CHECK) gira su questo mock.

**Fallback:** mcp-fiori, sap-fiori-create-cli, when the skill cannot run

**Challengers:** fiori-elements-floorplans (challenge optional)

**Output:** app/<id>/ (webapp, manifest.json, annotazioni)

### FE_ANNOTATIONS · Annotazioni e pagine

action · category Frontend Fiori Elements · skill `sap-fiori-app-development` · applies because: Interfaccia utente: SAP Fiori elements

Completa le annotazioni secondo docs/ux.md: HeaderInfo, SelectionFields, LineItem, Facets e FieldGroup, value help, SideEffects, criticality.
Mettile nel backend (CDS) quando è possibile, e ogni testo nei file i18n.

**Challengers:** sap-fiori-tools, fiori-annotations, mcp-fiori, sap-fiori-tree-table (challenge optional)

### FE_RUN_CHECK · L'app parte e mostra i dati

gate · category Frontend Fiori Elements · skill `run` · applies because: Interfaccia utente: SAP Fiori elements

Avvia l'app in locale (anteprima di Fiori tools, o cds watch con un servizio CAP) e controlla list report e object page con dati reali o simulati. Nella console del browser non ci devono essere errori.
Il controllo non aspetta la fine dello sviluppo: nel mock (npm run start-mock, ui5-mock.yaml e localService di FE_GENERATE) si esegue anche prima dell'approvazione del diff di ogni unità che tocca l'app (annotazioni, CDS e behavior del servizio, controller extension), con l'esito nel pacchetto del diff. Controlla anche l'intestazione dell'object page (HeaderInfo: un @UI.hidden sul campo del titolo la nasconde) e che ogni azione, standard e custom, risponda.

**Check:** anteprima senza errori in console; list report e object page caricano i dati; intestazione e azioni funzionano

### UI5_TYPESCRIPT · Setup o conversione TypeScript dell'app UI5

action · category Frontend SAPUI5 & Web Components · skill `ui5-typescript-conversion` · applies because: Linguaggio: TypeScript · Interfaccia utente: SAP Fiori elements

Applica ui5-typescript-conversion dopo che il progetto esiste, sia per SAP Fiori elements sia per SAPUI5 freestyle:
- aggiungi TypeScript, i tipi @sapui5/types della stessa linea SAPUI5 e ui5-tooling-transpile;
- converti prima Component e i file centrali, poi controller, controlli e test, preservando commenti e JSDoc;
- usa classi ES, import espliciti e tipi UI5 specifici, senza any o cast unknown;
- mantieni allowJs durante una migrazione incrementale e chiudi il passo solo con tsc --noEmit e build UI5 verdi.

**Check:** tsc --noEmit e build UI5 senza errori

**Output:** tsconfig.json, sorgenti .ts, ui5.yaml

**SAP documentation:** https://ui5.github.io/typescript/

### LAUNCHPAD_BTP · Contenuto del launchpad su BTP

action · category Launchpad, Work Zone & navigazione · skill `sap-fiori-tools` · applies because: Modalità: Nuovo sviluppo · Stack: Cloud Foundry · Pubblicazione dell'app su SAP BTP: Site di SAP Build Work Zone, standard edition

Ospita l'app nell'HTML5 application repository con il managed approuter: npm exec --no -- fiori add deploy-config (Cloud Foundry), oppure cds add workzone in un progetto CAP.
Nel manifest servono:
- un sap.cloud.service univoco;
- "public": true;
- crossNavigation.inbounds.
- dataSources con URI relativo (odata/v4/<servizio>/, senza la / iniziale): un URI assoluto non passa dal managed approuter del site e l'app resta in caricamento; un test di contratto fra manifest e servizio lo verifica (UNIT_TESTS_CAP).
La destination dell'HTML5 application repository sta a livello di subaccount, non di istanza, con HTML5Runtime_enabled: altrimenti Channel Manager non vede l'app.
Il contenuto del site si porta in due modi, che non si mescolano: il provider HTML5 Apps (aggiornato a mano dopo ogni deploy) o una HTML5 business solution con workzone/cdm.json (nell'MTA su Cloud Foundry; su Kyma in app/html5-deployer/resources/, accanto agli ZIP delle app, nell'immagine del deployer costruita con l'Application Content Deployer Buildpack), che si aggiorna a ogni deploy. In workzone/cdm.json dichiara sempre un catalogo esplicito con le app e i ruoli della matrice (AUTH_MATRIX); con WORKZONE_VIEW=GROUPS i gruppi, con SPACES_PAGES (il default) lo space e le pages del ruolo, con le app nella sezione prevista dalla specifica.
Serve anche l'abbonamento a SAP Build Work Zone, nell'edizione del profilo, nello stesso subaccount:
- la role collection Launchpad_Admin per chi configura il site;
Il contenuto del site si configura dopo il deploy (WORKZONE_SITE_DEV).

**Challengers:** btp-workzone, fiori-navigation (challenge optional)

**SAP documentation:** https://help.sap.com/docs/SAP_FIORI_tools/17d50220bcd848aa854c9c182d65b699/41e63bde991a485ea362fc5ba35cf5bc.html

### APPROUTER_BTP · App su BTP con l'application router del progetto

action · category Launchpad, Work Zone & navigazione · skill `sap-fiori-tools` · applies because: Modalità: Nuovo sviluppo · Stack: Cloud Foundry · Interfaccia utente: SAP Fiori elements · Pubblicazione dell'app su SAP BTP: Site di SAP Build Work Zone, standard edition

Con un site il router standalone si genera comunque, dal primo deploy: è la via per aprire l'app che non dipende da SAP Build Work Zone. Se il managed approuter o il site non rispondono (un 500, un'app che resta in caricamento), l'app si verifica dal suo URL (APP_URL_CHECK) e il problema si isola nel site. Il site resta il passo successivo (WORKZONE_SITE_DEV), non un prerequisito per vedere l'app.
Il router e i suoi file:
- Per un'app sola, senza servizio CAP: npm exec --no -- fiori add deploy-config, target Cloud Foundry, con l'application router standalone.
- Un esempio: il configuratore NOVA fa così (configurator/mta.yaml, .deploy/app-router), con le app servite dalle resources del router: una strada solo per UI piccole, perché ogni modifica della UI riavvia il router.
- SAPUI5: senza launchpad nessuno lo fornisce, lo carica l'app. Dichiara la destination ui5 (su Cloud Foundry nell'MTA, nelle destinations del modulo del router o nell'init_data dell'istanza destination; su Kyma nel values.yaml, fra le backendDestinations del router con external: true) verso https://ui5.sap.com/<versione completa>, con la patch della release SAPUI5 del profilo letta da ui5.sap.com/versionoverview.html (per esempio 1.136.x): l'indirizzo senza versione serve sempre l'ultima release, non quella del profilo. La stessa versione va nel bootstrap dell'index.html.
- xs-app.json del router: welcomeFile verso l'index.html dell'app (l'ID di sap.app senza punti), authenticationMethod route, le route /resources e /test-resources verso la destination ui5, le route del servizio (/odata verso la destination srv-api con csrfProtection: con XSUAA forwardAuthToken, con IAS l'URL cert.* del servizio con forwardAuthToken e forwardAuthCertificates, come in CAP_MODEL) e infine ^(.*)$ verso html5-apps-repo-rt, con authenticationType xsuaa o ias secondo AUTH_SERVICE.
- L'app ha un suo index.html standalone (per SAP Fiori elements con sap/fe/core/AppComponent in un ComponentContainer): non ci sono la shell del launchpad, la navigazione per intent verso altre app e la personalizzazione del launchpad; se la specifica le chiede, serve un site.
- xs-app.json è JSON stretto per il router: nessuna chiave di commento (_comment o simili), che lo fa fallire all'avvio.
- Un client tecnico con un token XSUAA passa dal router solo con l'header x-approuter-authorization: un Authorization: Bearer il router lo ignora, e la richiesta finisce al login.
- Moduli: il router (approuter.nodejs, almeno 256M di memoria e 512M di disco, con i timeout di INCOMING_REQUEST_TIMEOUT per le chiamate lunghe) legato al servizio di autenticazione, alla destination, all'html5-apps-repo app-runtime e, per i sistemi on-premise attraverso il SAP Cloud Connector, al servizio connectivity; il deployer com.sap.application.content con content-target sull'app-host.
- Sicurezza del router, già nel primo xs-app.json: responseHeaders con Content-Security-Policy (default-src 'self', script e stili da ui5.sap.com o dalla destination ui5, frame-ancestors del site o 'self'), Strict-Transport-Security, X-Content-Type-Options nosniff e Referrer-Policy; il redirect URI del client OAuth (oauth2-configuration.redirect-uris in xs-security.json, o nella configurazione dell'istanza identity) limitato all'host del router e a /login/callback, mai un wildcard su cfapps.
- Nel mta.yaml NODE_ENV: production fra le properties del router e del servizio: senza, in Cloud Foundry può attivarsi l'autenticazione mocked.
- @sap/approuter è una dipendenza del team: aggiornala come le altre (Dependabot o Renovate), perché porta le correzioni di sicurezza. Il router ha il suo package-lock.json: entra nel controllo delle dipendenze (SUPPLY_CHAIN) dal momento in cui nasce.

**Output:** router nell'MTA con xs-app.json, UI nell'HTML5 application repository

**SAP documentation:** https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/01c5f9ba7d6847aaaf069d153b981b51.html

### IDENTITY_SETUP · Identity Authentication, trust e SSO

gate · category Sicurezza, identità & supply chain · skill `mcp-btp-admin` · applies because: Piattaforma: SAP BTP

Verifica in sola lettura, per ogni landscape (sviluppo e test, produzione), il tenant di SAP Cloud Identity Services e la catena di fiducia; segui solo i rami dello sviluppo:
- Cloud Foundry e Kyma: la trust del subaccount di ogni landscape (PLAYBOOK.md, SAP BTP landscape) con il suo tenant IAS, una per subaccount, stabilita prima del primo deploy (BTP_ENVIRONMENT); gli utenti dell'app sono utenti applicativi di quell'identity provider, non utenti di piattaforma;
- con SAP Build Work Zone una sola trust IAS attiva nel subaccount;
Annota in docs/technical.md tenant, trust, autenticazione a due fattori o risk-based per i ruoli amministrativi e la scadenza dei certificati di firma. Gli utenti di comunicazione e tecnici restano fuori da IAS: vanno in AUTH_MATRIX. Quello che manca lo fa l'amministratore di SAP Cloud Identity Services.

**Check:** tenant IAS e trust documentati per ogni landscape e sistema dello sviluppo, oppure richiesta aperta agli amministratori

**Output:** docs/technical.md, sezione Identità

**SAP documentation:** https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/550251abaf49432bbaa65147b65a1f39.html

### AUTH_MATRIX · Matrice di ruoli e autorizzazioni

action · category Sicurezza, identità & supply chain · command `/nova-security-matrix` · applies because: Interfaccia utente: SAP Fiori elements

Con /nova-security-matrix auth scrivi la matrice ruoli × operazioni, con i ruoli di test, e verificala contro il codice nei due versi: @restrict in CAP, autorizzazioni RAP, IAM app, role collection.
La logica del servizio (CAP_LOGIC, RAP_LOGIC) viene prima e porta già i primi @restrict: qui la matrice li verifica e li completa, e da qui in avanti ogni ruolo nuovo passa prima dalla matrice.
La matrice è la fonte di tutti gli oggetti di ruolo dello sviluppo, i gruppi IAS che li ricevono compresi:
- i ruoli del site di SAP Build Work Zone;
Per ogni ruolo scrivi come arriva agli utenti in ogni ambiente: a mano (Maintain Business Users, SU01 e PFCG, role collection, policy AMS in IAS) oppure gruppo IAS portato da Identity Provisioning.
Su SAP BTP leggi con btp-administration (o la btp CLI, come in BTP_ENVIRONMENT) le role collection e il trust del subaccount (identity provider): la matrice parte da quello che il subaccount ha.
Per ogni controllo dichiarato conforme il rapporto dice dove è applicato a runtime; la separazione dei compiti e la segregazione dei dati seguono il profilo d'audit.

**Challengers:** sap-btp-cloud-identity-services (challenge required)

**Output:** docs/audit/<data>-nova-security-matrix.md

### IAS_CONFIG_DEV · Applicazione, gruppi e utenti di test in IAS (sviluppo)

action, optional · category Sicurezza, identità & supply chain · skill `sap-btp-cloud-identity-services` · applies because: Piattaforma: SAP BTP

Nel tenant IAS di sviluppo del landscape (PLAYBOOK.md, SAP BTP landscape: IAS) porta quello che la matrice dei ruoli chiede: i gruppi IAS dei ruoli, gli utenti di test della matrice e i loro gruppi.
Due strade, a scelta del team:
- a mano, nell'Administration Console di IAS (Users & Authorizations › Groups e User Management), con la lista della matrice;
- come codice, con il provider Terraform di SAP Cloud Identity Services (versione fissata in required_providers, credenziali SCI_CLIENT_ID e SCI_CLIENT_SECRET o certificato p12 solo in variabili d'ambiente, mai nel repository): terraform plan, fai approvare il piano all'utente, poi terraform apply; il codice va in infra/ias/. Solo se il team usa già Terraform: la CLI terraform serve sulla macchina.
Due fattori, risk-based authentication e impostazioni del tenant le fa a mano l'amministratore di IAS. Mai nel tenant di produzione: lì passa da PROD_ROLE_ASSIGNMENTS.

**Check:** gruppi e utenti di test della matrice presenti nel tenant IAS di sviluppo (a mano o con terraform apply approvato)

**Output:** infra/ias/*.tf

**SAP documentation:** https://cap.cloud.sap/docs/guides/security/authentication

### IDENTITY_PROVISIONING · Utenti e gruppi con Identity Provisioning

action, optional · category Sicurezza, identità & supply chain · skill `nova-ips-provisioning` · applies because: Piattaforma: SAP BTP

Dalla matrice dei ruoli ricava gruppi e ruoli e documenta in docs/technical.md, per ogni landscape, i job di Identity Provisioning che li portano nei sistemi: sorgente (IdP aziendale, Identity Directory o SAP S/4HANA Cloud Public come sistema principale), target, trasformazioni, pianificazione.
Serve quando il cliente porta utenti e gruppi dal suo IdP aziendale con Identity Provisioning; per un'app che usa solo gruppi IAS assegnati a mano la salti, e lo scrivi nel rapporto.
Target dello sviluppo, solo quelli che servono:
- subaccount SAP BTP (gruppi nelle role collection);
- SAP Build Work Zone (con la content federation anche dal sistema S/4 come sorgente);
Con nova-ips-provisioning prepari per l'amministratore di IPS la configurazione esatta di sistemi, proprietà e trasformazioni (la console non ha API), crei nel tenant di sviluppo utenti e gruppi di test con Identity Directory (/scim/Users, /scim/Groups) e avvii i job Read o Resync con l'API del tenant, sempre prima in dry-run e poi con la conferma dell'utente. Il job Simulate e i Provisioning Logs restano nella console. Gli utenti tecnici e di comunicazione non passano da IPS. In produzione la skill non scrive: prepara il piano per chi amministra il tenant.

**Output:** docs/technical.md, sezione Provisioning

**SAP documentation:** https://help.sap.com/doc/c30747989e33466e8e4f789dd9c3c81c/Cloud/en-US/Provisioning_Service.pdf

### SECURITY_REVIEW · Revisione di sicurezza

gate · category Sicurezza, identità & supply chain · skill `security-review` · applies because: Sempre

Esegui la revisione di sicurezza delle modifiche: autorizzazioni, input non validati, segreti, CSP, dati personali. Correggi, o fai approvare, ogni finding alto o critico.
Prima di lanciare la skill security-review controlla che il clone sappia qual è il ramo predefinito: la skill confronta con git diff origin/HEAD..., e in un clone senza origin/HEAD non parte. Se git rev-parse --verify origin/HEAD fallisce, esegui git remote set-head origin --auto (cambia solo un riferimento locale, non il repository).
- Dati personali: ogni entità CAP o CDS con dati personali ha @PersonalData (EntitySemantics, IsPotentiallyPersonal, IsPotentiallySensitive), con il servizio SAP Audit Log per CAP; su ABAP, se la specifica lo chiede, Read Access Logging (BTP ABAP: configurazione trasportabile; on-premise e Private Edition: SRALMANAGER) e conservazione con ILM. Le estensioni key user non trattano dati personali soggetti a normativa.
- UI: nell'xs-app.json nessuna route senza autenticazione oltre alle risorse statiche di SAPUI5; Content Security Policy e intestazioni di sicurezza (del router, con l'application router del progetto).
- Nessun segreto in mta.yaml, nel chart, in default-env.json o nel repository.

**Check:** nessun finding alto o critico aperto

### SUPPLY_CHAIN · Dipendenze e SBOM

gate · category Sicurezza, identità & supply chain · skill `cli-supply-chain` · applies because: Interfaccia utente: SAP Fiori elements

Verifica le dipendenze npm di ogni lockfile dello sviluppo (root, router, app e ogni modulo dell'MTA o del chart), non solo della root. Sono i lockfile che lo sviluppo gestisce: git ls-files '*package-lock.json' ':!:.claude/**' ':!:**/node_modules/**'. Restano fuori quelli delle skill e dei plugin installati sotto .claude/, che lo sviluppatore non gestisce e che ogni installazione riscrive: li verificano i manutentori del catalogo quando fissano la versione della skill (catalogo NOVA), non questo passo; se un loro rilievo ti sembra grave, segnalalo agli amministratori.
- il lockfile punta solo al registry ufficiale;
- nessuna vulnerabilità alta o critica;
- SBOM generato;
- aggiornamento continuo delle dipendenze con Dependabot o Renovate nel repository (@sap/cds, @sap/approuter, @sap/xssec e le librerie SAPUI5 comprese), con le pull request che passano dalla pipeline (CI_PIPELINE).
Quando cambia un lockfile dello sviluppo o nasce un modulo nell'MTA o nel chart dopo la chiusura del passo, il passo si riapre (install.mjs reopen SUPPLY_CHAIN) e si ripete su tutti i lockfile dello sviluppo; un'installazione o un aggiornamento delle skill non lo riapre.
lockfile-lint e CycloneDX non sono dipendenze del progetto: si chiamano con npx e la versione esatta (npx lockfile-lint@<x.y.z>, npx @cyclonedx/cyclonedx-npm@<x.y.z>), che l'hook di sap-dependency-security accetta.

**Check:** per ogni package-lock.json dello sviluppo (fuori da .claude/ e node_modules/): npx lockfile-lint@<versione> --path <lockfile> --allowed-hosts npm --validate-https; npm audit --audit-level=high nella sua cartella; npx @cyclonedx/cyclonedx-npm@<versione> --output-file sbom.json

**Output:** sbom.json

### LINT · Lint

gate · category Qualità, lint & modernizzazione · skill `cli-ui5-linter` · applies because: Interfaccia utente: SAP Fiori elements

Esegui UI5 linter ed ESLint con la configurazione di SAP Fiori tools; per un'app UI5 Web Components l'ESLint del framework. Correggi con le skill fix-* del piano.
Gli strumenti del progetto si chiamano dal binario locale fissato dal lockfile: npm exec --no -- eslint . (o ./node_modules/.bin/eslint, o lo script lint del package.json), mai npx eslint senza versione, che l'hook di sap-dependency-security blocca e che potrebbe scaricare un'altra versione. Lo stesso per ui5lint, cds e gli strumenti dei test e delle build.
ESLint 9 o 10 con il plugin di SAP Fiori tools (@sap-ux/eslint-plugin-fiori-tools, config recommended-for-s4hana, che controlla anche manifest e annotazioni): se l'app non lo ha, configuralo con la skill sap-fiori-eslint-plugin.

**Check:** npm exec --no -- eslint . senza errori
npm exec --no -- ui5lint senza errori

### APP_AUDIT · Audit di ogni app

gate · category Qualità, lint & modernizzazione · command `/nova-app-audit` · applies because: Interfaccia utente: SAP Fiori elements

Per ogni app dello sviluppo esegui /nova-app-audit <app> report:
- prima i finding pendenti del registro;
- poi il percorso utente e il contratto fra interfaccia e servizio: azioni visibili e davvero autorizzate, disponibilità calcolate, side effect, errori, stati vuoti, testi.
Correggi i P1; i quick win si correggono con la modalità fix, su un ramo dedicato.
Dopo l'audit il perimetro si congela: ora si correggono solo i difetti bloccanti (errori 500, login, dati sbagliati, sicurezza alta o critica); gli altri rilievi vanno in un backlog con priorità (docs/backlog.md, o le issue del repository), deciso con lo sviluppatore a scelta. I collaudi reali portano difetti a cascata: un perimetro che si allarga a ogni rilievo non si chiude più.

**Check:** per ogni app, nessun finding P1 aperto nel rapporto di /nova-app-audit

**Output:** docs/audit/<data>-nova-app-audit.md

### I18N_COMPLETENESS · Testi traducibili e completi

gate · category Qualità, lint & modernizzazione · command `/nova-text-polish` · applies because: Interfaccia utente: SAP Fiori elements

Controlla che ogni testo visibile sia in un bundle: i18n.properties dell'app e del manifest, _i18n di CAP, i file di traduzione del framework o i18n dei metadati MDK.
Un controllo del prodotto (gate, script, test) che legge etichette, titoli o annotazioni del modello CDS le trova come chiavi {i18n>…}, non come testo: lavora sul modello compilato con i bundle i18n risolti, non sul sorgente. Ogni controllo di questo tipo ha almeno una prova di sensibilità sul modello vero del progetto (introduci l'errore, il controllo diventa rosso, annulla), perché una prova su un modello costruito con etichette letterali non dice nulla su quello reale. Nessuna chiave mancante per le lingue della specifica, nessun testo cablato in viste, controller, annotazioni o handler.
Per le lingue da tradurre prepara i file per il traduttore e registra chi li consegna.

**Check:** zero chiavi mancanti e zero testi cablati per le lingue della specifica

**SAP documentation:** https://cap.cloud.sap/docs/guides/uis/i18n

### CODE_REVIEW · Revisione del codice

gate · category Qualità, lint & modernizzazione · skill `code-review` · applies because: Sempre

Esegui la revisione del codice sul diff dello sviluppo: correttezza, semplicità, convenzioni del progetto. Chiudi ogni finding bloccante; gli altri vanno nel backlog con priorità, decisi con lo sviluppatore: la revisione non allarga il perimetro dello sviluppo.

**Check:** nessun finding bloccante aperto

### UI_TESTS · Test QUnit e OPA5 del codice freestyle

gate · category Testing · skill none: left out by the rigor of the development (STANDARD) (Solo nel livello di rigore Completo: si aggiunge con una scelta sulla funzione) · applies because: Interfaccia utente: SAP Fiori elements

Scrivi i QUnit della logica del frontend (controller, formatter, modelli) e gli OPA5 solo delle viste e delle interazioni che il codice dell'app costruisce; i percorsi utente della specifica sono dell'end-to-end (E2E_A11Y), non si scrivono due volte. Eseguili headless, nello stesso npm test.

**Check:** test QUnit e OPA5 verdi in modalità headless

### E2E_A11Y · End-to-end e accessibilità

gate · category Testing · command `/nova-e2e-run` · applies because: Interfaccia utente: SAP Fiori elements

È l'unico livello di test dei percorsi utente: un percorso si scrive una volta, qui.
Per Fiori elements non si scrivono OPA5 delle pagine generate, che provano il framework; il codice custom (controller extension, building block, formatter) ha i suoi QUnit nello stesso npm test.
Se l'app ha già una suite OPA5 o QUnit, la esegui nella stessa esecuzione, non la riscrivi.
Con il rigore Standard basta un end-to-end di fumo: il percorso principale della richiesta (aprire l'elenco, aprire un dettaglio, la modifica o l'azione principale, salvare), e l'accessibilità con axe sulla pagina iniziale e su un dettaglio. Tutti i percorsi e la misura completa dell'accessibilità sono del rigore Completo, o di una richiesta esplicita.
Con /nova-e2e-create scrivi i percorsi principali della richiesta, poi eseguili con /nova-e2e-run in locale: con cds watch e i dati di prova, o con il mock server di SAP Fiori tools (per un'app UI5 Web Components il dev server del framework). Il deploy viene dopo: sull'app deployata li ripeti nella verifica dall'URL o dal site (APP_URL_CHECK, WORKZONE_CHECK).
Il runner si sceglie una volta per progetto e si scrive in docs/technical.md: Playwright con playwright-praman (selettori sul registro dei controlli UI5, helper per List Report e Object Page, regressione visiva sui temi Horizon; con /praman-plan, /praman-generate e /praman-heal) oppure wdi5 su WebdriverIO, con i selettori di OPA5 e del Test Recorder di UI5. Se l'app ha già una suite wdi5, si resta su wdi5.

**Check:** flussi end-to-end verdi; nessuna violazione axe seria o critica

### CI_PIPELINE · Pipeline CI con i gate

action · category Build, deploy, CI/CD & operations · skill `sap-btp-developer-guide` · applies because: Stack: Cloud Foundry

Configura la pipeline, con cds add github-actions oppure SAP Continuous Integration and Delivery. I passi sono:
1. npm ci;
2. lint:
- UI5 linter ed ESLint;
3. test (npm test, la stessa suite dei passi di test, senza una seconda suite della pipeline);
4. controlli di sicurezza;
6. mbt build e deploy nello space di sviluppo del landscape (PLAYBOOK.md, SAP BTP landscape), attivo solo dopo che il primo deploy a mano (CF_DEPLOY_DEV) è riuscito;
8. con SAP Cloud Transport Management, upload dello stesso archivio sul nodo di sviluppo, che lo porta in coda al nodo di test: si attiva quando CTMS_SETUP ha creato i nodi.
Un gate che fallisce blocca il merge e il deploy. Le credenziali di deploy vanno solo nei segreti della pipeline, mai un utente personale:
- un utente tecnico di piattaforma con il ruolo Space Developer nello space e la service key dell'istanza di cTMS per l'upload;
Se il cliente ha una pipeline Jenkins o GitHub Actions con Project Piper, usa i suoi step invece di scriverne di nuovi: tmsUpload e tmsExport per SAP Cloud Transport Management; per BTP ABAP environment abapEnvironmentRunATCCheck, abapEnvironmentRunAUnitTest e abapEnvironmentPullGitRepo verso il sistema di test; con gCTS on-premise gctsExecuteABAPQualityChecks e gctsExecuteABAPUnitTests. La pipeline la esegue il cliente con le sue credenziali; l'import in produzione resta a chi la amministra, dopo GO_LIVE_APPROVAL.

**Output:** .github/workflows/*.yml

**SAP documentation:** https://cap.cloud.sap/docs/guides/deploy/cicd

### DEPLOY_PREREQS · Prerequisiti del deploy nel subaccount di sviluppo

gate · category Build, deploy, CI/CD & operations · skill `mcp-btp-admin` · applies because: Stack: Cloud Foundry

Prima del primo deploy, e di ogni deploy che aggiunge un servizio, ricontrolla sul subaccount di sviluppo del landscape (PLAYBOOK.md, SAP BTP landscape) quello che il deploy usa, in sola lettura con btp-administration (o la btp CLI, come in BTP_ENVIRONMENT) o con la CLI btp. Il deploy non si lancia per scoprire cosa manca: un errore del deploy su un prerequisito vuol dire che questo controllo è stato saltato.
- ogni risorsa del mta.yaml (o del chart): servizio e piano hanno l'entitlement e la quota liberi nel subaccount (btp list accounts/entitlement); un'istanza che esiste già ha lo stesso piano;
- la trust del subaccount con il tenant IAS del landscape, attiva (Security › Trust Configuration): gli utenti dell'app e quelli di test vengono da lì;
- l'abbonamento a SAP Build Work Zone nell'edizione del profilo, in stato Subscribed (btp list accounts/subscription), una sola trust IAS attiva nel subaccount e la role collection di amministrazione del site (Launchpad_Admin, o quelle dell'advanced edition) assegnata a chi configura il site;
- la destination dell'HTML5 application repository a livello di subaccount, con HTML5Runtime_enabled (LAUNCHPAD_BTP), se il contenuto non arriva da workzone/cdm.json;
- lo space di sviluppo esiste e il tuo utente è Space Developer;
Se manca qualcosa fermati prima del deploy: con la conferma dell'utente lo aggiunge chi ne ha i diritti, come in BTP_ENVIRONMENT (trust e abbonamenti li fa l'amministratore del subaccount), poi ripeti il controllo. Nel rapporto del passo scrivi ogni voce con il suo esito.

**Fallback:** cli-btp, when the skill cannot run

**Check:** ogni servizio e piano del mta.yaml o del chart ha entitlement e quota; trust IAS del subaccount attiva
SAP Build Work Zone sottoscritto, una sola trust IAS attiva, role collection di amministrazione assegnata

**SAP documentation:** https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/2d167cbbcec4417486d4f3fdfffa58e1.html

### CF_BUILD · Archivio MTA

gate · category Build, deploy, CI/CD & operations · skill `cli-mbt` · applies because: Stack: Cloud Foundry

Congela le dipendenze (npm install --package-lock-only) e committa il lockfile.
Costruisci l'archivio con mbt build -t gen --mtar mta.tar: lo stesso archivio va poi in test e in produzione.
Quello che cambia fra gli ambienti va in un descrittore di estensione per ambiente (dev.mtaext, test.mtaext, prod.mtaext): piani dei servizi (per esempio PostgreSQL free in sviluppo, standard o premium in test e produzione), memoria e istanze, URL e nomi delle destination; si passa con cf deploy mta.tar -e <ambiente>.mtaext, o sul nodo di SAP Cloud Transport Management (CTMS_SETUP). Nessun segreto nei .mtaext: le credenziali restano nei servizi e nelle destination.
Nel mta.yaml:
- un modulo che è un workspace npm della root (per esempio il modulo html5 dell'app) si costruisce solo con npm run build, senza npm ci: npm ci nel workspace cancella il node_modules della root e mbt sparisce (Error 127).
Prima della build, npm audit --omit=dev --audit-level=high in ogni cartella con un package-lock.json (root, router, app, moduli dell'MTA): un modulo nuovo porta un lockfile nuovo, e SUPPLY_CHAIN si riapre (install.mjs reopen SUPPLY_CHAIN).
Errori tipici: package-lock.json mancante (npm ci fallisce dentro mbt), disk-quota troppo bassa nel mta.yaml.

**Check:** mbt build senza errori; gen/mta.tar presente; un .mtaext per ogni ambiente del landscape; npm audit senza vulnerabilità alte o critiche in ogni lockfile

**Output:** gen/mta.tar, *.mtaext

**SAP documentation:** https://cap.cloud.sap/docs/guides/deploy/to-cf

### CF_DEPLOY_DEV · Deploy su Cloud Foundry (sviluppo)

action · category Build, deploy, CI/CD & operations · skill `cli-cf` · applies because: Stack: Cloud Foundry

Accedi allo space di sviluppo del landscape (PLAYBOOK.md, SAP BTP landscape: API endpoint, org, space):
- cf login -a <API endpoint> --sso con il tuo utente, oppure, con un utente tecnico, cf api e cf login --origin;
- poi cf target -o <org> -s <space>; cf target deve mostrare l'org e lo space del landscape, non quelli di un altro progetto (NOVA compreso).
Fai il deploy solo con DEPLOY_PREREQS superato: trust IAS, abbonamenti ed entitlement vengono prima del deploy, mai dopo un suo errore.
Fai il deploy con cf deploy gen/mta.tar (plugin MultiApps). cds up fa build e deploy insieme, ma non conserva l'archivio per il trasporto.
Non fare mai il deploy nello space di produzione: quello passa dal rilascio.

**SAP documentation:** https://cap.cloud.sap/docs/guides/deploy/to-cf

### CF_ROLES_DEV · Ruoli agli utenti di test (Cloud Foundry)

action · category Build, deploy, CI/CD & operations · skill `mcp-btp-admin` · applies because: Stack: Cloud Foundry

Nel subaccount di sviluppo del landscape, dopo il deploy, i ruoli della matrice (AUTH_MATRIX) arrivano agli utenti di test, uno per ruolo, sempre dopo la conferma dell'utente. Gli utenti sono utenti applicativi dell'identity provider del subaccount (il tenant IAS del landscape), non utenti di piattaforma.
Restano da assegnare le role collection del site di SAP Build Work Zone (WORKZONE_SITE_DEV).
Nel subaccount di produzione le assegna chi lo amministra, non il builder.

**Fallback:** cli-btp, when the skill cannot run

**SAP documentation:** https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/2d167cbbcec4417486d4f3fdfffa58e1.html

### CF_DEPLOY_CHECK · Verifica del deploy su Cloud Foundry

gate · category Build, deploy, CI/CD & operations · skill `cli-cf` · applies because: Stack: Cloud Foundry

Controlla l'MTA con cf mta <id> e cf apps:
- il router avviato;
- il deployer HTML5 è terminato e l'app è nell'HTML5 application repository (cf html5-list); la prova dal site è WORKZONE_CHECK;
Poi verifica gli endpoint:
I log dell'app arrivano in SAP Cloud Logging (OpenSearch Dashboards dell'istanza cloud-logging) e nessuna app è legata al servizio deprecato application-logs (cf services).
Con @PersonalData: modifica un dato personale con l'utente di test e trova la voce nell'Audit Log Viewer.
Davanti a un errore prima raccogli l'evidenza (cf logs --recent, cf dmol, l'x-request-id o il correlation id della risposta, una chiamata diretta all'endpoint), poi fai una sola ipotesi alla volta e la verifichi prima della successiva.
Il deploy di sviluppo è un controllo di correttezza, non solo un passo operativo: trova difetti che nessun audit della configurazione vede. Ogni wave di modifiche successive che tocca modello, sicurezza, router, MTA o configurazione (le correzioni di un audit, una revisione, una funzione nuova) si chiude con un nuovo deploy di sviluppo e questo controllo: riapri CF_DEPLOY_DEV e CF_DEPLOY_CHECK (install.mjs reopen).

**Check:** cf mta: app avviate

**SAP documentation:** https://cap.cloud.sap/docs/guides/deploy/health-checks

### APP_URL_CHECK · App aperta dal suo URL, con i dati del backend

gate · category Build, deploy, CI/CD & operations · skill `run` · applies because: Modalità: Nuovo sviluppo · Stack: Cloud Foundry · Interfaccia utente: SAP Fiori elements · Pubblicazione dell'app su SAP BTP: Site di SAP Build Work Zone, standard edition

Con un utente di test apri l'URL dell'app (con un site, prima di metterla nel site: è la verifica che non dipende da SAP Build Work Zone): quello dell'application router (su Cloud Foundry cf app <router>, su Kyma l'host dell'APIRule) o quello di Application Frontend (cockpit, HTML5 › Application Frontend):
- senza sessione il browser va al login dell'identity provider delle applicazioni, poi torna sull'app;
- l'app parte dal welcomeFile, con la versione SAPUI5 prevista, e legge i dati del backend con l'identità dell'utente (con SAP S/4HANA, principal propagation);
- un utente senza la role collection o il gruppo dell'app riceve 403 dal servizio;
- nella console del browser non ci sono errori, e le chiamate di scrittura passano il token CSRF.

**Check:** dall'URL: login, app avviata, dati letti con l'utente di test, 403 senza ruolo; console senza errori

**SAP documentation:** https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/01c5f9ba7d6847aaaf069d153b981b51.html

### WORKZONE_SITE_DEV · App nel site di SAP Build Work Zone (sviluppo)

action · category Build, deploy, CI/CD & operations · skill `sap-fiori-tools` · applies because: Modalità: Nuovo sviluppo · Stack: Cloud Foundry · Interfaccia utente: SAP Fiori elements · Pubblicazione dell'app su SAP BTP: Site di SAP Build Work Zone, standard edition

Dopo il deploy, nel site di sviluppo di SAP Build Work Zone:
Con workzone/cdm.json il content provider si crea una volta in Channel Manager e poi si aggiorna da solo; con il provider HTML5 Apps, a ogni deploy:
1. in Channel Manager aggiorna il provider HTML5 Apps, che legge l'HTML5 application repository;
2. dal Content Explorer aggiungi l'app al contenuto del site;
3. aggiungila al catalogo e al ruolo del site; con WORKZONE_VIEW=GROUPS anche al gruppo, con SPACES_PAGES allo space e alla page del ruolo (dal cdm.json, o nell'editor di spaces e pages del site con il provider HTML5 Apps), e attiva la vista a spaces e pages nelle impostazioni del site;
4. il ruolo del site genera una role collection nel subaccount: assegnala agli utenti di test con btp-administration (o la btp CLI, come in BTP_ENVIRONMENT), dopo la conferma dell'utente, come quelle dell'app (CF_ROLES_DEV o KYMA_ROLES_DEV).

**Output:** site di sviluppo con app, catalogo, ruolo e gruppo o page

**SAP documentation:** https://help.sap.com/docs/SAP_FIORI_tools/17d50220bcd848aa854c9c182d65b699/41e63bde991a485ea362fc5ba35cf5bc.html

### WORKZONE_CHECK · App aperta dal site, con i dati del backend

gate · category Build, deploy, CI/CD & operations · skill `run` · applies because: Modalità: Nuovo sviluppo · Stack: Cloud Foundry · Interfaccia utente: SAP Fiori elements · Pubblicazione dell'app su SAP BTP: Site di SAP Build Work Zone, standard edition

Con un utente di test, apri il site di sviluppo di SAP Build Work Zone:
- il tile dell'app c'è, nel catalogo e con il ruolo previsti, e nel gruppo o, con spaces e pages, sulla page prevista dello space del ruolo;
- l'app parte dal tile e legge i dati del backend con l'identità dell'utente (con SAP S/4HANA, principal propagation: i dati sono quelli che l'utente vede nel sistema);
- con la content federation, nello stesso site compaiono anche le app di SAP S/4HANA dei suoi ruoli.
Nella console del browser non ci sono errori.

**Check:** dal site: tile presente, app avviata, dati letti con l'utente di test; console senza errori

**SAP documentation:** https://help.sap.com/docs/SAP_FIORI_tools/17d50220bcd848aa854c9c182d65b699/41e63bde991a485ea362fc5ba35cf5bc.html

### APP_PERFORMANCE · Prestazioni dell'app

gate · category Build, deploy, CI/CD & operations · skill none: left out by the rigor of the development (STANDARD) (Solo nel livello di rigore Completo: si aggiunge con una scelta sulla funzione) · applies because: Interfaccia utente: SAP Fiori elements

Misura le prestazioni sull'app deployata nello sviluppo, dal suo URL o dal site (APP_URL_CHECK, WORKZONE_CHECK), non sull'anteprima locale: in locale mancano rete, autenticazione e build di produzione, e le misure non dicono nulla sulle soglie.
Misura i flussi principali della specifica, con i dati di prova realistici: tempo al primo contenuto utile della pagina iniziale e dell'object page, numero e dimensione delle richieste, richieste OData in $batch, $select ed $expand senza campi inutili, growing o paginazione sulle tabelle.
Verifica la checklist SAPUI5: bootstrap asincrono, Component-preload generato dalla build, librerie del manifest solo quelle usate, viste caricate in modo lazy.
Registra le misure e le soglie del catalogo NFR (REQUIREMENTS_SPEC) in docs/technical.md.

**Check:** misure registrate; ogni soglia NFR rispettata o scostamento approvato

**Output:** docs/technical.md

**SAP documentation:** https://ui5.sap.com/#/topic/9c6400e

### OBSERVABILITY · Log, metriche e allarmi

action · category Build, deploy, CI/CD & operations · skill `sap-btp-cloud-logging` · applies because: Stack: Cloud Foundry

Collega l'applicazione a SAP Cloud Logging (servizio cloud-logging): log strutturati, metriche e allarmi sugli errori. Prevedi il controllo di salute.
Mai SAP Application Logging Service (servizio application-logs): è uscito dagli Eligible Cloud Services il 31/07/2025 (SAP Note 3557260) e non si rinnova; il suo successore è SAP Cloud Logging. Le skill che lo propongono ancora (per esempio le guide di piattaforma, con cf create-service application-logs) vanno seguite su SAP Cloud Logging. Se il progetto ha già un'istanza o un binding application-logs, migralo a cloud-logging e scrivilo nel rapporto del passo.
Piani di cloud-logging: dev solo per lo sviluppo; standard o large per test e produzione, dimensionati sul volume dei log e sulla conservazione (7 giorni di default).
Cloud Foundry: istanza cloud-logging con ingest_otlp abilitato nel mta.yaml, legata al servizio, al sidecar MTX e all'application router.
Con SAP Cloud ALM (CLOUD_ALM) strumenta il servizio con OpenTelemetry di SAP: dipendenza @sap/xotel-agent-ext-js dal registry SAP (credenziali in .npmrc fuori dal repository), NODE_ARGS=-r @sap/xotel-agent-ext-js nello start, SAP_CALM_SERVICE_NAME e SAP_CALM_SERVICE_TYPE nel mta.yaml o nel values.yaml, binding alla destination CALM_datacollector del subaccount (creata dopo la conferma dell'utente), e, con l'application router del progetto, FESR dal router per il Real User Monitoring. La 2.x dell'agente non convive con @cap-js/telemetry 1.x.
Per un job, il run log di SAP Job Scheduling service. Credenziali e certificati da rinnovare vanno nella tabella di docs/technical.md (TECH_DOCS).

### CALM_OPERATIONS · Registrazione e monitoraggio in SAP Cloud ALM

action · category Build, deploy, CI/CD & operations · skill `mcp-calmcp` · applies because: SAP Cloud ALM: Sì · Piattaforma: SAP BTP

Verifica che il sistema o il servizio di produzione sia registrato in Landscape Management di SAP Cloud ALM, e prepara per l'amministratore di Cloud ALM i casi d'uso da attivare; segui solo le voci dello sviluppo:
- Cloud Foundry e Kyma: l'app strumentata con OpenTelemetry (OBSERVABILITY), Health e Integration & Exception Monitoring del subaccount, e il Real User Monitoring per un'app con UI;
Per ogni caso d'uso definisci filtri (servizio OData, BSP, iFlow, topic, oggetto di application log, job), eventi, soglie e destinatari degli allarmi, e l'azione dell'evento: e-mail ai destinatari registrati in Notification Management, un ticket verso lo strumento ITSM del cliente (External API Management) o un operation flow; le situazioni passano dall'Intelligent Event Processing. Un servizio non SAP o non strumentato può mandare metriche, log e tracce con le Raw Data Inbound API (OpenTelemetry): è una scelta dell'architettura, scritta in docs/architecture.md. Scrivi in docs/technical.md cosa si monitora e chi riceve gli allarmi. Il server MCP di Cloud ALM legge soltanto, e per registrazione, attivazione e allarmi non esistono API pubbliche: li fa a mano l'amministratore di Cloud ALM, dopo la conferma dell'utente, dalla lista di consegna di nova-calm-write (references/operations-handover.md).

**Output:** docs/technical.md, sezione Monitoraggio

**SAP documentation:** https://support.sap.com/en/alm/sap-cloud-alm/operations/expert-portal/integration-monitoring/int-mon-content.html

### RELEASE_AUDIT · Audit di rilascio

gate · category Audit & release readiness · command `/nova-audit-all` · applies because: Interfaccia utente: SAP Fiori elements

Prima dell'audit riesegui i controlli scaduti: `install.mjs status` (come `ready` e `next`) elenca come stale i gate di lint, audit, test, sicurezza e dipendenze chiusi prima di commit che hanno cambiato file del progetto fuori da .claude/ (per esempio uno script aggiunto dopo LINT, che rompe npm run lint). Rieseguili sul codice di adesso e registra il nuovo esito con `install.mjs amend <passo> --evidence`; se falliscono correggi e rieseguili. L'audit parte solo senza gate stale, e un gate stale non si cita come evidenza.
Con ogni rigore, Completo compreso, l'audit di rilascio non rifà gli audit dei passi già chiusi sullo stesso codice (SECURITY_REVIEW, APP_AUDIT, CODE_REVIEW, I18N_COMPLETENESS, /nova-ux-quality di E2E_A11Y, i controlli del giro): ne cita i rapporti con il loro commit e ricontrolla solo il diff da quel commit (git diff <commit> HEAD -- <percorsi che l'audit misura>) e il registro dei rilievi pendenti. Se il diff è vuoto (git diff --quiet) il rapporto del passo vale com'è; se non lo è, l'audit rivede solo i file cambiati.
Lo stesso per i controlli: `install.mjs ready` elenca quelli passati sullo stesso identico codice (lint, ATC, sicurezza, dipendenze), con la loro evidenza. Quell'esito vale: citalo nel rapporto, non rieseguirlo.
Con il rigore Rapido o Standard esegui solo gli audit che nessun passo ha fatto, ciascuno con il suo comando.
Il rapporto riporta, per ogni audit, se è citato (passo, rapporto, commit, esito del diff) o eseguito, gli audit non eseguiti con il motivo, e i requisiti della richiesta coperti dai test. Si chiude solo senza finding bloccanti aperti, nel registro come nel diff.

**Check:** nessun finding bloccante aperto nel report di audit

**Output:** docs/audit/<data>-nova-audit-all.md

### CTMS_SETUP · SAP Cloud Transport Management per l'app

action · category Audit & release readiness · skill `sap-btp-cloud-transport-management` · applies because: Stack: Cloud Foundry · Piattaforma: SAP BTP

Una volta per landscape, prima del primo trasporto, e poi per ogni app i suoi nodi. Il subaccount di cTMS è quello dei trasporti del landscape (PLAYBOOK.md, SAP BTP landscape: Transports): SAP chiede un subaccount amministrativo centrale, mai il global account o il subaccount di SAP Cloud ALM. Se lo sviluppo non ne ha uno, chiedilo allo sviluppatore e fallo registrare. Tutto quello che segue lo fa, dopo la conferma dell'utente, chi amministra quel subaccount con il proprio utente; tu prepari la lista esatta e poi verifichi in sola lettura con btp-administration (o la btp CLI, come in BTP_ENVIRONMENT).
Nel subaccount dei trasporti, una volta:
- l'abbonamento a Cloud Transport Management e un'istanza del servizio (piano standard) con la sua service key, per l'upload della pipeline e, con SAP Cloud ALM, per la sua destination;
- le role collection di cTMS (Administrator, Landscape Operator, Import Operator, Export Operator, Viewer) a chi disegna il landscape e a chi importa: import in produzione solo a chi la amministra.
Per l'app, nel subaccount dei trasporti:
- una destination per ogni nodo di destinazione, verso il SAP Cloud Deployment service dello space di test e di produzione: URL https://deploy-service.cf.<dominio>/slprot/<org>/<space>/slp (dominio dall'API endpoint del subaccount di destinazione, org e space del landscape, con la codifica URL dei caratteri speciali), autenticazione OAuth2Password con Client ID cf, Token Service URL https://login.cf.<dominio>, un utente tecnico di piattaforma con Space Developer nello space di destinazione; la password la inserisce l'amministratore nel cockpit, mai nel repository o nella chat;
- i nodi: <APP>_DEV con Allow Upload to Node (sorgente, niente destination), <APP>_TEST e <APP>_PROD con content type Multitarget Application e la loro destination; la rotta DEV → TEST → PROD;
- una prova con un archivio di prova: upload sul nodo di sviluppo, import in test, stato Succeeded.
L'upload lo fa la pipeline (CI_PIPELINE) con la service key dell'istanza, nei segreti della pipeline, o a mano dal nodo di sviluppo.
Con SAP Cloud ALM (il tenant del landscape), nel subaccount in cui è sottoscritto SAP Cloud ALM chi lo amministra crea la destination CALM_FTR_CTMS_<suffisso> (tipo HTTP, Internet, OAuth2ClientCredentials, URL uri, client ID e secret e Token Service URL con /oauth/token dalla service key dell'istanza di cTMS): il nome non si cambia più, e mai due destination verso la stessa istanza. Entro qualche minuto i trasporti compaiono nell'app Features con il nome della destination come prefisso, e il deploy in test e produzione si fa dalla feature (ALM_FEATURE). Un'istanza di cTMS di produzione si collega solo al tenant di SAP Cloud ALM di produzione.

**Fallback:** mcp-btp-admin, cli-btp, when the skill cannot run

**Check:** nodi DEV, TEST e PROD con la rotta e le destination verso gli space; upload di prova importato in test
i trasporti visibili nell'app Features di SAP Cloud ALM

**Output:** docs/technical.md, sezione Trasporti

**SAP documentation:** https://help.sap.com/docs/TRANSPORT_MANAGEMENT_SERVICE/7f7160ec0d8546c6b3eab72fb5ad6fd8/d2005d5d2fc346b98eff7146107243fc.html

### CF_DEPLOY_TEST · Deploy nel subaccount di test (Cloud Foundry)

action · category Audit & release readiness · skill `sap-btp-cloud-transport-management` · applies because: Stack: Cloud Foundry · Piattaforma: SAP BTP

Porta nel subaccount di test del landscape (PLAYBOOK.md, SAP BTP landscape: Test) lo stesso archivio provato in sviluppo, senza un nuovo build. Se lo sviluppo non ha il subaccount di test, chiedilo allo sviluppatore e fallo registrare prima.
- Prima, in sola lettura con btp-administration (o la btp CLI, come in BTP_ENVIRONMENT), sul subaccount di test gli stessi controlli di BTP_ENVIRONMENT: space dell'app, entitlement e quote dei piani, trust con il tenant IAS di test (uno per sviluppo e test, o il suo); quello che manca lo fa chi amministra il test.
- Con SAP Cloud ALM l'import in test parte dalla feature (ALM_FEATURE).
- Il deploy: con SAP Cloud Transport Management l'archivio caricato sul nodo di sviluppo è in coda al nodo di test, e si importa da lì; senza cTMS la pipeline fa cf deploy nello space di test con il suo utente tecnico.
- Dopo il deploy le stesse verifiche di CF_DEPLOY_CHECK sull'URL di test, e i ruoli della matrice agli utenti del collaudo, dati da chi amministra il test (gruppi IAS o role collection).

**Fallback:** cf-cli, when the skill cannot run

**Check:** app avviata nel subaccount di test dallo stesso archivio; /health 200; utenti del collaudo con i loro ruoli

**SAP documentation:** https://help.sap.com/docs/TRANSPORT_MANAGEMENT_SERVICE/7f7160ec0d8546c6b3eab72fb5ad6fd8/d2005d5d2fc346b98eff7146107243fc.html

### TEST_SYSTEM_CONFIG · Configurazione del sistema di test

action · category Audit & release readiness · skill `mcp-btp-admin` · applies because: Piattaforma: SAP BTP

Il trasporto porta gli oggetti, non la configurazione dei sistemi, e il collaudo ne ha bisogno: prima di UAT_TEST prepara per il sistema o il tenant di test la lista di quello che va ricreato, con i valori del test e senza segreti, e consegnala a chi lo amministra; tu poi verifichi in sola lettura. Solo le voci dello sviluppo:
- app su SAP BTP: la trust del subaccount con il tenant IAS del landscape e l'identity provider degli utenti applicativi; le destination create a mano nel subaccount (quelle dell'MTA o del chart arrivano con il deploy); i gruppi IAS del test e le loro assegnazioni alle policy AMS o alle role collection;
- la destination CALM_datacollector del subaccount di test per il monitoraggio (OBSERVABILITY);
Scrivi in docs/technical.md la lista con l'esito della verifica.

**Fallback:** cli-btp, when the skill cannot run

**Check:** ogni configurazione della lista presente nel sistema di test, verificata in sola lettura

**Output:** docs/technical.md, sezione Configurazione per ambiente

**SAP documentation:** https://help.sap.com/doc/92f2c1b209a243639a63769070b0dd58/s4hana_cloud/en-US/6e28a25c7dcd4aa395328b1784736547.pdf

### CALM_TEST · Test e qualità nella feature di SAP Cloud ALM

action · category Audit & release readiness · skill `nova-calm-write` · applies because: SAP Cloud ALM: Sì · Piattaforma: SAP BTP · Consegna dello sviluppo: Progetto del cliente

Quando lo sviluppo è nel sistema o nel subaccount di test, con nova-calm-write (§2, §4, §10), in dry-run e con la conferma di chi ha il ruolo nel progetto:
- la feature a In Testing (set-feature-status IN_TESTING: la consegna al test, ruolo Developer o project lead);
- i test case manuali del collaudo, uno per user story del flusso principale, con attività e azioni dai criteri Given/When/Then e il riferimento alla specifica, legati alla user story (TaskAssignments della Test Cases API, con il corpo della specifica CALM_TM, o nell'app); il test plan e la sua esecuzione li prepara e li conduce il test manager nelle app Test Preparation e Test Execution: tu gli dai l'elenco dei test case e delle user story che coprono;
- le evidenze della qualità nella feature: gli esiti della CI (ci-evidence, con il report JUnit e il link all'esecuzione) e il risultato ATC dello sviluppo con i finding per priorità (add-feature-reference); Cloud ALM non riceve risultati di test via API;
- un test fallito che non si corregge nella stessa sessione diventa un difetto (create-defect, legato alla feature con assign-task-feature), e la feature torna a In Implementation finché il difetto non è chiuso.
Le scritture vanno nel registro docs/alm/calm-log.md.

**Fallback:** mcp-calmcp, when the skill cannot run

**Check:** feature In Testing con i test case del collaudo legati alle user story, le evidenze della CI e dell'ATC; ogni difetto aperto legato alla feature

**Output:** docs/alm/calm-log.md

**SAP documentation:** https://help.sap.com/docs/CloudALM/cc59d0e81b41459dacc138c99c0eba76/f5a18b8e81d0492c82eba16fb7dfac62.html

### UAT_TEST · Collaudo nel sistema di test

gate · category Audit & release readiness · command `/nova-e2e-run` · applies because: Piattaforma: SAP BTP

Prima dell'approvazione del rilascio il referente funzionale esegue nel sistema o nel tenant di test i test di accettazione della specifica, sullo stesso contenuto che andrà in produzione; tu prepari gli script di test dalla specifica e registri l'esito che ti dà, a scelta (superato, superato con rilievi, non superato):
- Cloud Foundry: il subaccount di test con lo stesso archivio di CF_DEPLOY_TEST;
Con SAP Cloud ALM il referente esegue i test case del collaudo preparati in CALM_TEST nell'app Test Execution, dove il loro esito resta; un test non superato è un difetto legato alla feature.
Tu prepari gli script dai criteri di accettazione, esegui solo lo smoke end-to-end di supporto sull'ambiente di test e raccogli le evidenze; l'esito del collaudo lo dà il referente.
Via governata per lo smoke end-to-end di supporto sull'ambiente di test: non ha un endpoint configurato per questo sistema, quindi se ne occupa una persona con l'utente di test (le chiamate e le transazioni di prova) e tu alleghi l'evidenza in docs/evidence/ con chi e quando; non usare Nova ARC-1 e non cercare un'altra strada.

**Check:** sviluppo nel sistema di test; test di accettazione superati, con l'esito registrato dal referente funzionale; con SAP S/4HANA, collegamento al sistema di test verificato

**SAP documentation:** https://help.sap.com/docs/TRANSPORT_MANAGEMENT_SERVICE/7f7160ec0d8546c6b3eab72fb5ad6fd8/d2005d5d2fc346b98eff7146107243fc.html

### ALM_FEATURE · Feature di SAP Cloud ALM pronta al deploy

action · category Audit & release readiness · skill `mcp-calmcp` · applies because: SAP Cloud ALM: Sì · Piattaforma: SAP BTP · Consegna dello sviluppo: Progetto del cliente

Dopo il collaudo e prima dell'approvazione del rilascio, con il server MCP di Cloud ALM in sola lettura verifica che la feature dello sviluppo abbia requisito, user story, test del flusso principale con l'esito in Test Execution, nessun difetto aperto e tutti i veicoli di trasporto, secondo il target:
- SAP BTP (MTA, SAP Integration Suite, SAP Build, SAP HANA Cloud, SAP Analytics Cloud e SAP Datasphere, BTP ABAP con Export Commit): le richieste di SAP Cloud Transport Management, che vede con la destination CALM_FTR_CTMS_<suffisso> creata nel subaccount di SAP Cloud ALM verso l'istanza di cTMS del subaccount dei trasporti (CTMS_SETUP); assegna alla feature ogni richiesta dell'app.
Con nova-calm-write, prima in dry-run e poi con la conferma di chi ha il ruolo Tester nel progetto, aggiungi le evidenze che mancano (ci-evidence) e porti la feature a Successfully Tested (set-feature-status SUCCESSFULLY_TESTED) e le user story collaudate al loro stato chiuso. La feature Successfully Tested, con il pacchetto delle evidenze, va a GO_LIVE_APPROVAL; dopo l'approvazione il Change Manager la porta a Ready for Production nell'app Features (l'API non lo consente), e il Deployment Manager fa il deploy dalla feature e lo conferma (Deployed): sono passi di persone, mai dell'agente. La configurazione dei sistemi (/SDF/ALM_SETUP, TMS) la fa il loro amministratore (Basis).

**Check:** feature con requisito, test ed esito, nessun difetto aperto, ogni trasporto o richiesta di cTMS assegnato; stato Successfully Tested

**SAP documentation:** https://help.sap.com/docs/CloudALM/877c96cf971648b09ee0d0a64f7f4fef/6e55eba7e9d04547ad8118b500cee2a2.html

### ROLLBACK_PLAN · Piano di ripristino del rilascio

action · category Audit & release readiness · skill `cf-cli` · applies because: Stack: Cloud Foundry

Prima di GO_LIVE_APPROVAL scrivi in docs/technical.md come si torna indietro:
- rilascio con cf deploy --strategy blue-green e --backup-previous-version (rollback-mta è sperimentale), ricordando che servizi legati e contenuto dell'HTML5 application repository non tornano indietro;
La versione a cui si torna ha il suo tag git. Dalla sessione cloud il push del tag può essere rifiutato (403): prepara per l'utente le istruzioni (GitHub, Releases › Draft a new release, nome del tag, Target sul commit rilasciato, con l'hash) invece di provarci, e scrivi in docs/technical.md il tag quando esiste.
Prova il ripristino una volta nel subaccount di test.

**Challengers:** sap-btp-cloud-transport-management (challenge optional)

**Check:** piano di ripristino in docs/technical.md, provato in test

**Output:** docs/technical.md

**SAP documentation:** https://github.com/SAP-docs/btp-cloud-platform/blob/main/docs/50-administration-and-ops/multitarget-application-commands-for-the-cloud-foundry-environment-65ddb1b.md

### GO_LIVE_APPROVAL · Approvazione del rilascio in produzione

approval · category Audit & release readiness · skill none: a person's, prepare the evidence and ask them with choices · applies because: Piattaforma: SAP BTP · Consegna dello sviluppo: Progetto del cliente

Presenta al responsabile del rilascio le evidenze dei gate (il report di audit, se il piano ha l'audit di rilascio), gli esiti dei test, la lista delle modifiche e chiedi l'approvazione esplicita della data e della finestra di rilascio.
Prima di chiedere l'approvazione prepara il pacchetto di evidenze in un solo documento o nella pull request, con i link; l'approvazione la dà chi decide il passo, esplicitamente: l'agente della squadra con l'autorità quando decide la squadra, altrimenti la persona indicata; tu la registri (chi, data, motivazione, riferimento) senza impostare tu stati che la rappresentano. Il pacchetto: il report di /nova-audit-all (RELEASE_AUDIT), l'esito di UAT_TEST, le richieste di trasporto o la feature, le modifiche della pull request e il piano di rientro.
Con SAP Cloud ALM, dopo l'approvazione la persona imposta la feature a Ready for Production nell'app Features: non si imposta via API.

**Check:** approvazione del responsabile del rilascio

### BTP_PROD_ENVIRONMENT · Ambiente SAP BTP di produzione pronto

gate · category Audit & release readiness · skill `mcp-btp-admin` · applies because: Piattaforma: SAP BTP

Prima del rilascio confronta con btp-administration (o la btp CLI, come in BTP_ENVIRONMENT), in sola lettura, il subaccount di produzione del landscape con quello di test (PLAYBOOK.md, SAP BTP landscape: Production e Test); se lo sviluppo non ha il subaccount di produzione, chiedilo allo sviluppatore e fallo registrare:
- ambiente o abbonamento del target, entitlement e quote dei piani dello sviluppo;
- destination e trust verso i sistemi di produzione;
- role collection per gli utenti di produzione, mappate a gruppi del tenant IAS di produzione (PROD_ROLE_ASSIGNMENTS);
- trust con il tenant IAS di produzione e, solo per la tipologia, il broker degli eventi, le capability e le role collection di SAP Integration Suite, SAP Job Scheduling service, Forms service by Adobe, SAP Audit Log; per Joule la formation di produzione (Joule, SAP Build build-default, IAS e il tenant SAP S/4HANA di produzione) in stato Ready: una sottoscrizione di Joule si integra con un solo tenant per prodotto.
Quello che manca lo fa chi amministra la produzione, con il proprio utente, dopo l'approvazione del rilascio: il builder prepara la lista.

**Fallback:** cli-btp, when the skill cannot run

**Check:** il subaccount di produzione ha ambiente, entitlement, destination e role collection dello sviluppo

**SAP documentation:** https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/2d167cbbcec4417486d4f3fdfffa58e1.html

### PROD_ROLE_ASSIGNMENTS · Assegnazioni dei ruoli in produzione

action · category Audit & release readiness · skill `mcp-btp-admin` · applies because: Piattaforma: SAP BTP · Consegna dello sviluppo: Progetto del cliente

Da AUTH_MATRIX prepara la lista delle assegnazioni di produzione e consegnala all'amministratore:
- gruppi IAS di produzione ↔ role collection del subaccount (app e servizi);
- gruppi IAS di produzione ↔ role collection del site di SAP Build Work Zone;
- job di Identity Provisioning che li portano nei sistemi (nova-ips-provisioning, in produzione, stampa soltanto il piano).
Le assegnazioni le esegue l'amministratore di produzione con il proprio utente, dopo che i ruoli sono arrivati in produzione con il rilascio; la verifica in sola lettura è PROD_ROLES_CHECK, dopo il rilascio.

**Fallback:** cli-btp, nova-ips-provisioning, when the skill cannot run

**Check:** lista delle assegnazioni di produzione consegnata all'amministratore, per ogni ruolo della matrice

**Output:** docs/technical.md, sezione Produzione

**SAP documentation:** https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/2d167cbbcec4417486d4f3fdfffa58e1.html

### RELEASE_CF_PROD · Rilascio in produzione (Cloud Foundry)

action · category Audit & release readiness · skill `sap-btp-cloud-transport-management` · applies because: Stack: Cloud Foundry

Porta nel subaccount di produzione del landscape (PLAYBOOK.md, SAP BTP landscape: Production) lo stesso archivio MTA già provato in test, senza un nuovo build.
Con SAP Cloud Transport Management (CTMS_SETUP: nodi DEV → TEST → PROD, destination verso il deploy service di ogni space):
1. l'archivio è quello caricato dalla pipeline sul nodo di sviluppo e importato in test (CF_DEPLOY_TEST);
2. import in PROD dello stesso archivio già collaudato in test (UAT_TEST), fatto da chi ha l'Import Operator su quel nodo;
3. lo stato della richiesta deve essere Succeeded o Warning.
Con SAP Cloud ALM la richiesta di cTMS è nella feature e il deploy in produzione si fa dalla feature (ALM_FEATURE), non dall'import queue.
In alternativa, senza cTMS, deploy sullo space di produzione dalla pipeline, per esempio su una GitHub Release, con l'utente tecnico della produzione.
Un'app in SAP Build Work Zone entra nel site di produzione come in sviluppo (WORKZONE_SITE_DEV): lo fa chi amministra il subaccount di produzione, che assegna anche le role collection. Con workzone/cdm.json il contenuto del site viaggia nell'MTA; con il provider HTML5 Apps il contenuto (ruoli, gruppi, cataloghi) si trasporta con Cloud Transport Management; le app HTML5 viaggiano sempre nell'MTA.
Quello che non viaggia nell'MTA è in NON_TRANSPORTED_CONFIG.

**Check:** MTA importato in produzione; applicazioni avviate

**SAP documentation:** https://help.sap.com/docs/TRANSPORT_MANAGEMENT_SERVICE/7f7160ec0d8546c6b3eab72fb5ad6fd8/d2005d5d2fc346b98eff7146107243fc.html

### NON_TRANSPORTED_CONFIG · Configurazione che non si trasporta

action · category Audit & release readiness · skill `mcp-btp-admin` · applies because: Piattaforma: SAP BTP · Consegna dello sviluppo: Progetto del cliente

Il trasporto porta gli oggetti, non la configurazione dei sistemi. Per la produzione, dopo GO_LIVE_APPROVAL, prepara la lista di quello che va ricreato (la stessa del sistema di test, TEST_SYSTEM_CONFIG), con i valori di produzione e senza segreti, e consegnala a chi la amministra; tu poi verifichi in sola lettura. Solo le voci dello sviluppo:
- app su SAP BTP: la trust del subaccount con il tenant IAS del landscape e l'identity provider degli utenti applicativi; le destination create a mano nel subaccount (quelle dell'MTA o del chart arrivano con il deploy); i gruppi IAS e le loro assegnazioni alle policy AMS o alle role collection (PROD_ROLE_ASSIGNMENTS);
- la destination CALM_datacollector del subaccount di produzione per il monitoraggio (OBSERVABILITY);
Scrivi in docs/technical.md la lista con l'esito della verifica.

**Fallback:** cli-btp, when the skill cannot run

**Check:** ogni configurazione della lista presente nel sistema di produzione, verificata in sola lettura

**Output:** docs/technical.md, sezione Configurazione per ambiente

**SAP documentation:** https://help.sap.com/doc/92f2c1b209a243639a63769070b0dd58/s4hana_cloud/en-US/6e28a25c7dcd4aa395328b1784736547.pdf

### PROD_ROLES_CHECK · Ruoli di produzione verificati

gate · category Audit & release readiness · skill `mcp-btp-admin` · applies because: Piattaforma: SAP BTP · Consegna dello sviluppo: Progetto del cliente

Dopo il rilascio in produzione verifica in sola lettura che le assegnazioni di PROD_ROLE_ASSIGNMENTS siano state fatte:
- con btp-administration (o la btp CLI, come in BTP_ENVIRONMENT): role collection del subaccount di produzione mappate ai gruppi IAS previsti;
Registra l'esito in docs/technical.md, sezione Produzione.

**Fallback:** cli-btp, when the skill cannot run

**Check:** ogni ruolo della matrice assegnato in produzione al gruppo previsto, verificato in sola lettura

**SAP documentation:** https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/2d167cbbcec4417486d4f3fdfffa58e1.html

### SMOKE_PROD · Verifica in produzione

gate · category Audit & release readiness · skill `cf-cli` · applies because: Piattaforma: SAP BTP · Consegna dello sviluppo: Progetto del cliente

Con un utente di test autorizzato percorri il flusso principale in produzione, in sola lettura dove si può, e controlla log ed errori della prima ora; segui il ramo dello sviluppo:
- app: dal launchpad o dal site di SAP Build Work Zone, tile sulla page prevista; app avviata, dati caricati, console senza errori;
Via governata per il flusso principale e la chiamata reale in produzione: non ha un endpoint configurato per questo sistema, quindi se ne occupa una persona con l'utente di test (le chiamate e le transazioni di prova) e tu alleghi l'evidenza in docs/evidence/ con chi e quando; non usare Nova ARC-1 e non cercare un'altra strada.

**Fallback:** run, mcp-calmcp, when the skill cannot run

**Check:** flusso principale riuscito in produzione; nessun errore nei log e nei monitor della prima ora

### CALM_MONITORING_CHECK · Monitoraggio attivo in SAP Cloud ALM

gate · category Audit & release readiness · skill `mcp-calmcp` · applies because: SAP Cloud ALM: Sì · Piattaforma: SAP BTP · Consegna dello sviluppo: Progetto del cliente

Dopo la verifica in produzione leggi con il server MCP di Cloud ALM i dati del servizio di produzione: il servizio in Landscape Management, Health Monitoring con dati, l'eccezione o il messaggio di prova arrivati in Integration & Exception Monitoring, gli allarmi configurati con i destinatari e l'azione dell'evento di docs/technical.md, e l'allarme di prova arrivato a chi deve riceverlo.
Per un'app su SAP BTP con UI anche le richieste del Real User Monitoring dall'URL di produzione.

**Check:** servizio di produzione visibile in Cloud ALM con dati; eccezione di prova ricevuta; allarmi con destinatari

**SAP documentation:** https://support.sap.com/en/alm/sap-cloud-alm/operations/expert-portal/data-collection-infrastructure.html

### CALM_DEPLOYED · Rilascio registrato in SAP Cloud ALM

action · category Audit & release readiness · skill `nova-calm-write` · applies because: SAP Cloud ALM: Sì · Piattaforma: SAP BTP · Consegna dello sviluppo: Progetto del cliente

Dopo il rilascio in produzione, in lettura con il server MCP di Cloud ALM: la feature è Deployed, cioè il Deployment Manager ha fatto il deploy dalla feature e lo ha confermato, e i trasporti o le richieste di cTMS sono nel sistema di produzione. Se non lo è, il passo aspetta chi ha il ruolo: l'agente non conferma il deploy. Poi con nova-calm-write (§10), un batch in dry-run e la conferma del project lead:
- i task di progetto e le user story dello sviluppo chiusi, con i codici di stato del tenant (set-task-status), e sul task principale un commento con versione, data e riferimento del rilascio (add-task-comment);
- i requisiti realizzati al loro stato finale nel tenant, se il project lead li chiude da NOVA; altrimenti nella sua lista;
- un difetto ancora aperto resta aperto, con il motivo nel rapporto del passo.
Scrivi l'esito in docs/alm/calm-log.md.

**Fallback:** mcp-calmcp, when the skill cannot run

**Check:** feature Deployed confermata dal Deployment Manager; task e user story chiusi; requisiti allo stato finale o nella lista del project lead

**Output:** docs/alm/calm-log.md

**SAP documentation:** https://help.sap.com/docs/CloudALM/877c96cf971648b09ee0d0a64f7f4fef/6e55eba7e9d04547ad8118b500cee2a2.html

### CODE_GRAPH_HANDOVER · Grafo dello sviluppo consegnato

action · category Documentazione & deliverable · skill `cli-graphify` · applies because: Modalità: Nuovo sviluppo · Interfaccia utente: SAP Fiori elements

A sviluppo finito costruisci il grafo del repository con graphify (PyPI graphifyy 0.9.73), in locale e senza rete, con gli stessi comandi di CODE_GRAPH:
1. uv tool install graphifyy==0.9.73, poi graphify install --project (rivedi il blocco che aggiunge a .claude/CLAUDE.md prima di committarlo);
2. .graphifyignore nella radice con .claude/, node_modules/, .mcp.json, graphify-out/: senza, il grafo è fatto delle skill installate e non dello sviluppo;
3. graphify extract . --code-only, poi graphify cluster-only . --no-label.
Il grafo serve alla documentazione di questa fase (FUNCTIONAL_DOCS, TECH_DOCS: architettura, flussi e dipendenze letti dal grafo e verificati sul codice) e resta a chi farà le modifiche future, che lo aggiornano con graphify update . invece di ricostruire la mappa da capo.
I documenti del cliente (docs/input, PDF, capitolati) entrano nel grafo solo con la conferma dell'utente, con /graphify . nella sessione, e passano solo dal modello della sessione: mai un backend esterno con una API key (--backend gemini, kimi, deepseek, openai, claude). graphify-out/ va in .gitignore quando contiene documenti del cliente; altrimenti si committa, con GRAPH_REPORT.md e .graphifyignore.
Il grafo ha la struttura di JavaScript, TypeScript e Java (servizi CAP, handler, controller, moduli UI5 e plug-in del launchpad); i file .cds e il codice ABAP restano testo: per il modello CDS vale il compilatore (cds compile), per ABAP Nova ARC-1. Se il repository non ha codice JavaScript, TypeScript o Java, salta il passo scrivendo il motivo: la struttura ABAP la documenta ABAP_OBJECT_DOCS con Nova ARC-1.

**Output:** graphify-out/GRAPH_REPORT.md, .graphifyignore

### FUNCTIONAL_DOCS · Documentazione funzionale

action · category Documentazione & deliverable · skill `doc-coauthoring` · applies because: Sempre

Scrivi docs/functional.md, il documento funzionale di quello che lo sviluppo fa davvero, al rilascio (non quello che la specifica chiedeva): dalla specifica, dal codice e dall'app o dal sistema provati. Per ogni tipologia:
- scopo, utenti e ruoli, con quello che ogni ruolo può fare;
- schermate e navigazione: per ogni pagina campi, filtri, azioni e messaggi, con le schermate reali; i ruoli che vedono ogni app (tile, catalogo, role collection);
- la tracciabilità: ogni requisito o user story (con l'ID di docs/specification.md, e di SAP Cloud ALM se c'è) → funzione o oggetto che lo realizza → test che lo prova (con l'esito);
- le differenze dalla specifica approvata, con il motivo e chi le ha decise.
I diagrammi (flusso del processo, navigazione tra le app, flussi di integrazione) li fai con la skill drawio in docs/diagrams/*.drawio, esportati in PNG con l'XML incorporato, così chi riceve il documento li riapre e li modifica in draw.io.

**Check:** ogni requisito della specifica ha la sua funzione e il suo test, o una differenza motivata

**Output:** docs/functional.md, docs/diagrams/*.drawio

### TECH_DOCS · Documentazione tecnica

action · category Documentazione & deliverable · command `/nova-tech-docs` · applies because: Sempre

Genera la documentazione tecnica dal codice e dai modelli:
- oggetti e dipendenze; il codice ABAP lo documenta, oggetto per oggetto, ABAP_OBJECT_DOCS quando il piano lo ha (altrimenti qui, con sap-object-documenter se il piano la installa): qui lo colleghi;
- servizi e API ($metadata, OpenAPI);
- configurazione degli ambienti, con la tabella delle credenziali: ogni binding, service key, utente di comunicazione e certificato (XSUAA o IAS X.509, destination, trust dell'istanza api-access che scade dopo due anni, SAP Cloud Connector, STRUST o trust store del tenant, Security Material, broker degli eventi, pull secret del registry), la scadenza, chi lo rinnova e come ruota senza fermo (Cloud Foundry: nuovo binding e restage; Kyma: credRotationPolicy della ServiceBinding); nella Private Edition quali passano da una service request a SAP ECS; nessuna service key di test resta attiva dopo il rilascio;
- procedura di rilascio;
- i diagrammi del modello dei dati (dal CDS o dal DDIC), delle chiamate tra i componenti e del deploy, con la skill drawio in docs/diagrams/*.drawio ed esportati in PNG con l'XML incorporato.
Le API si generano dal modello compilato (per CAP cds compile srv --service all --to openapi e --to edmx), i ruoli si leggono dal codice, gli ambienti si descrivono senza credenziali, ogni sezione con la sua fonte: esegui /nova-tech-docs, che scrive docs/technical.md con questo metodo.

**Check:** ogni servizio con il suo OpenAPI o EDMX generato; ogni ruolo documentato; nessun segreto

**Output:** docs/technical.md, docs/api/

### DOCS_DELIVERABLES · Documento funzionale (DF) e tecnico (DT) nel formato del cliente

action · category Documentazione & deliverable · skill `docx` · applies because: Sempre

Produci i due documenti di consegna in Word, nel template del cliente: il documento della richiesta di tipo Template documentale (REQUEST.md, Documenti); senza template, la struttura standard NOVA (copertina, tabella delle versioni, indice, capitoli) con il brand del profilo: logo e pattern in copertina, logo e ragione sociale in intestazione e piede, da docs/brand/brand.json come le guide (con BRAND neutro, senza logo).
- DF, documento funzionale: da docs/specification.md e docs/functional.md, con la tracciabilità requisito → funzione → test;
- DT, documento tecnico: da docs/architecture.md, docs/technical.md e docs/api/ o docs/api.md, con i diagrammi esportati come immagini;
- in entrambi: tabella delle versioni (versione, data, autore, modifiche, approvato da), riferimento al commit o al tag del repository, nessun segreto.
Salva in docs/deliverables/DF_<sviluppo>_v<versione>.docx e DT_<sviluppo>_v<versione>.docx; i Markdown di docs/ restano la fonte: un documento si rigenera da loro, non si corregge a mano.
I documenti vanno anche nel progetto SAP Cloud ALM: CALM_DOCUMENTS.

**Check:** DF e DT generati da docs/, con la tabella delle versioni e il riferimento al commit

**Output:** docs/deliverables/DF_*.docx, docs/deliverables/DT_*.docx

### CALM_DOCUMENTS · Documenti nel progetto SAP Cloud ALM

action · category Documentazione & deliverable · skill `nova-calm-write` · applies because: SAP Cloud ALM: Sì

Con nova-calm-write (§8, Document API) porta specifica, DF e DT nel progetto SAP Cloud ALM dello sviluppo:
- un documento per file, con il tipo di documento del tenant scelto con l'utente e l'external reference uguale al percorso nel repository: un documento già creato non si crea di nuovo;
- il file docx o pdf caricato nel documento, e ricaricato a ogni nuova versione (Cloud ALM ne aumenta la versione);
- il documento legato ai requisiti e alle user story che descrive, e al repository o alla pull request;
- le evidenze di qualità alla consegna: il rapporto del collaudo (UAT_TEST), il risultato ATC e gli esiti della CI, come documenti legati ai requisiti che provano;
- ogni scrittura con dry-run, conferma di chi ha il ruolo nel progetto e registro in docs/alm/calm-log.md; lo stato del documento lo cambia chi ha il ruolo, nell'app Documents.
Riporta i display ID dei documenti nella tabella delle versioni di DF e DT.

**Check:** specifica, DF e DT nel progetto Cloud ALM, con l'ultima versione del file e i task che descrivono

**Output:** docs/alm/calm-log.md

**SAP documentation:** https://help.sap.com/docs/CloudALM/fe419bfabbdc46dfbddbfd78b21483d5/d38462195c64439188714ef656935630.html

### RELEASE_NOTES · Release notes

action · category Documentazione & deliverable · skill `docx` · applies because: Sempre

Scrivi le release notes nel formato del cliente (docx), o con il brand del profilo come DF e DT (docs/brand/brand.json), dalla specifica e dal documento funzionale: cosa c'è di nuovo per chi usa l'app e per chi la amministra, cosa cambia nei ruoli e nella configurazione, i limiti noti della versione. Il modo d'uso, passo per passo, sta nelle guide d'uso per ruolo (USER_GUIDE), non qui.

**Output:** docs/release-notes.docx

### BTP_LANDSCAPE_EXPORT · Landscape SAP BTP esportato in codice Terraform

action · category Documentazione & deliverable · skill `cli-btptf` · applies because: Stack: Cloud Foundry

Alla consegna il landscape dello sviluppo diventa codice, così chi lo cambierà dopo può passare a Terraform senza ricostruirlo a mano.
Con btptf (voce cli-btptf) esporta il subaccount di sviluppo, e quelli di test e produzione se chi li amministra lo fa con te:
1. btptf create-json -s <ID del subaccount> -p infra/btp/export/<ambiente>/btpResources.json, e dalla lista togli le istanze create dal deploy (mta.yaml, chart): hanno già il loro proprietario;
2. btptf export-by-json -s <ID del subaccount> -p infra/btp/export/<ambiente>/btpResources.json -c infra/btp/export/<ambiente>;
3. rivedi il codice prima del commit: nessun segreto, nessun file di stato, i provider con la versione fissata; terraform plan sul codice esportato non deve proporre modifiche.
Serve un amministratore del global account (BTP_GLOBALACCOUNT, e le credenziali dall'ambiente o dalla sessione della btp CLI): se non lo sei, prepara i comandi e li lancia lui.
Scrivi in docs/technical.md dove sta il codice del landscape e come si applica.

**Check:** codice Terraform del landscape di sviluppo nel repository, senza stato né credenziali; terraform plan senza modifiche

**Output:** infra/btp/

**SAP documentation:** https://sap.github.io/terraform-exporter-btp/

### DOCS_COVERAGE · Ogni oggetto consegnato è documentato

gate · category Documentazione & deliverable · skill none: the NOVA toolkit does it (node .claude/nova/install.mjs) · applies because: Interfaccia utente: SAP Fiori elements · Piattaforma: SAP BTP

Controlla che ogni oggetto che il cliente vede dopo l'import sia nella documentazione, con lo script della skill nova-wolf:
Per un servizio CAP o un'app su SAP BTP: node <skill>/scripts/coverage-check.mjs --cap . --output docs/audit/<data>-coverage.md, che legge role template e role collection (xs-security.json), app e intent del launchpad (manifest.json), servizi CDS e moduli e risorse dell'MTA.
- oggetti: package, job (catalogo e template), app IAM, oggetti e sottooggetti di log, message class, service binding, oggetti di autorizzazione, oggetti di Business Configuration, descrittori del launchpad, app BSP e gli altri tipi che il cliente incontra in SAINT, PFCG e nelle app di monitoraggio; quello che non sta nei sorgenti abapGit (ruoli PFCG, contenuto del launchpad, app IAM di un sistema on-stack) va elencato in docs/delivered-objects.txt, una riga TIPO NOME (un nome con spazi, come una role collection, tra virgolette: XSRC "ArchiveLink Administrator");
- documentazione: docs/ e README.md, senza docs/archive/, docs/audit/ e i file interni delle guide (open-points.md, capture-sap.md): un oggetto nominato solo lì non è documentato per il cliente;
- un oggetto che non va documentato (un oggetto tecnico interno) si esclude in docs/coverage-exclusions.md, una riga | TIPO NOME | motivo |; un'esclusione senza motivo non vale.
Per ogni oggetto non documentato, e in particolare quando una funzione è uscita dalla documentazione ma è ancora nel codice, chiedi al referente funzionale con le opzioni:
1. documentarla di nuovo (la funzione resta nel prodotto);
2. toglierla dal codice (si riapre ABAP_CHANGE o ABAP_IMPLEMENT per gli oggetti della funzione, e i test che la provano);
3. escluderla con il motivo.
Registra la scelta, con chi l'ha presa e la data, in docs/technical.md (sezione Copertura della documentazione). Il controllo passa senza oggetti mancanti e senza esclusioni di oggetti non più consegnati.

**Check:** coverage-check.mjs senza oggetti mancanti; ogni esclusione con il motivo; le funzioni tolte dalla documentazione decise con il referente

**Output:** docs/audit/<data>-coverage.md, docs/coverage-exclusions.md

### INSTALL_CONFIG_GUIDE · Guida di installazione e configurazione per il cliente

action · category Documentazione & deliverable · skill none: the NOVA toolkit does it (node .claude/nova/install.mjs) · applies because: Interfaccia utente: SAP Fiori elements · Piattaforma: SAP BTP

Scrivi la guida con cui il cliente (Basis, sicurezza, key user) porta lo sviluppo da consegnato a funzionante, in docs/guides/install-config/:
- in un progetto presso il cliente è la guida di configurazione e attivazione: trasporti da importare e in che ordine, servizi da pubblicare, ruoli da copiare e assegnare, launchpad (cataloghi, spazi e pagine), configurazione dell'app e dei suoi job, comunicazione con altri sistemi, controlli finali;
- primo capitolo: cosa si installa, chi fa cosa (ruoli della guida e chi li ricopre di solito), come si legge un passo, checklist prima di iniziare.
Regole comuni a ogni guida (strumento: <skill>/scripts/guide, README.md accanto agli script; una volta npm ci --prefix <skill>/scripts/guide):
- una sola sorgente, docs/guides/<guida>/guide.yaml; Word e PowerPoint si generano con node <skill>/scripts/guide/build.mjs --guide docs/guides/<guida> e non si correggono a mano;
- indice completo e numerato (capitoli e passi), elenco delle figure, numeri di pagina;
- ogni passo ha gli stessi blocchi: obiettivo, chi lo fa, prerequisiti, transazione o app, percorso nel menu, tabella campo → valore da inserire, risultato atteso, come verificarlo, cosa fare se non riesce, e la schermata;
- schermate vere: quelle delle app con node <skill>/scripts/guide/capture.mjs --guide docs/guides/<guida> --base-url <url del mock> --start "npm run start-mock", dal mock e dal sandbox del launchpad con dati dimostrativi fittizi; quelle delle transazioni SAP sul sistema di sviluppo o di test (mai di un cliente), con la tabella di capture-sap.md che il build tiene aggiornata. Finché una schermata manca il build disegna un riquadro numerato, e GUIDE_CHECK non passa;
- solo lo stato finale del prodotto: nessun rischio aperto, nessun «non verificato» o «da verificare», nessun segnaposto, nessuna versione precedente, nessun riferimento interno (decisioni, rilievi, requisiti come NV-…, SR-…); quello che non è ancora certo va in docs/guides/<guida>/open-points.md, che non entra nei documenti e si chiude prima della consegna;
- brand dell'azienda che sviluppa: docs/brand/brand.json con colori, font e loghi PNG (README di scripts/guide); se manca, chiedi all'utente gli asset del brand invece di inventarli;
- lingua: quella dei documenti del cliente (meta.language, it o en), con le etichette dei documenti nella stessa lingua.

**Check:** guida generata da docs/guides/install-config/guide.yaml in Word e PowerPoint con il brand del profilo; ogni passo con tutti i blocchi e la sua schermata

**Output:** docs/guides/install-config/ (guide.yaml, screenshots/, .docx, .pptx)

**SAP documentation:** https://help.sap.com/docs/SAP_ADD-ON_ASSEMBLY_KIT/9043aa5d2f834ad385e1cdfdadc06b6f/a582f55473568c77e10000000a174cb4.html

### USER_GUIDE · Guide d'uso per ruolo

action · category Documentazione & deliverable · skill none: the NOVA toolkit does it (node .claude/nova/install.mjs) · applies because: Interfaccia utente: SAP Fiori elements · Piattaforma: SAP BTP

Scrivi una guida d'uso per ogni ruolo che usa l'app (per esempio amministratore, revisore, utente finale), in docs/guides/user-<ruolo>/, con meta.kind user e meta.role:
- i ruoli sono quelli della matrice delle autorizzazioni (docs/security.md, AUTH_MATRIX) e del disegno UX (docs/ux.md): un capitolo per compito del ruolo, nell'ordine in cui il ruolo lo fa;
- un passo per ogni operazione (aprire l'app dal launchpad, cercare, creare, modificare, approvare, esportare…), con l'app e il percorso, i campi con il valore d'esempio, il messaggio o lo stato che il ruolo vede alla fine, e cosa fare se un'azione è bloccata (autorizzazione, stato, blocco);
- le schermate vengono dall'app avviata nel mock con il ruolo giusto (capture.mjs), tutte nello stesso tema e nella stessa lingua della guida;
Regole comuni a ogni guida (strumento: <skill>/scripts/guide, README.md accanto agli script; una volta npm ci --prefix <skill>/scripts/guide):
- una sola sorgente, docs/guides/<guida>/guide.yaml; Word e PowerPoint si generano con node <skill>/scripts/guide/build.mjs --guide docs/guides/<guida> e non si correggono a mano;
- indice completo e numerato (capitoli e passi), elenco delle figure, numeri di pagina;
- ogni passo ha gli stessi blocchi: obiettivo, chi lo fa, prerequisiti, transazione o app, percorso nel menu, tabella campo → valore da inserire, risultato atteso, come verificarlo, cosa fare se non riesce, e la schermata;
- schermate vere: quelle delle app con node <skill>/scripts/guide/capture.mjs --guide docs/guides/<guida> --base-url <url del mock> --start "npm run start-mock", dal mock e dal sandbox del launchpad con dati dimostrativi fittizi; quelle delle transazioni SAP sul sistema di sviluppo o di test (mai di un cliente), con la tabella di capture-sap.md che il build tiene aggiornata. Finché una schermata manca il build disegna un riquadro numerato, e GUIDE_CHECK non passa;
- solo lo stato finale del prodotto: nessun rischio aperto, nessun «non verificato» o «da verificare», nessun segnaposto, nessuna versione precedente, nessun riferimento interno (decisioni, rilievi, requisiti come NV-…, SR-…); quello che non è ancora certo va in docs/guides/<guida>/open-points.md, che non entra nei documenti e si chiude prima della consegna;
- brand dell'azienda che sviluppa: docs/brand/brand.json con colori, font e loghi PNG (README di scripts/guide); se manca, chiedi all'utente gli asset del brand invece di inventarli;
- lingua: quella dei documenti del cliente (meta.language, it o en), con le etichette dei documenti nella stessa lingua.

**Check:** una guida per ogni ruolo dell'app, generata in Word e PowerPoint con il brand del profilo; ogni operazione con la sua schermata

**Output:** docs/guides/user-<ruolo>/ (guide.yaml, screenshots/, .docx, .pptx)

### GUIDE_CHECK · Guide per il cliente complete e solo con lo stato finale

gate · category Documentazione & deliverable · skill none: the NOVA toolkit does it (node .claude/nova/install.mjs) · applies because: Interfaccia utente: SAP Fiori elements · Piattaforma: SAP BTP

Prima di HANDOVER_APPROVAL controlla tutte le guide con lo script della skill nova-wolf:
node <skill>/scripts/guide/check.mjs docs/guides/* --output docs/audit/<data>-guides.md
Lo script esce con 1 se in una guida:
- un passo non ha tutti i blocchi (obiettivo, chi, prerequisiti, transazione o app, percorso, risultato atteso, verifica, cosa fare se non riesce) o non ha una schermata;
- una schermata manca: nei documenti resterebbe il riquadro «da inserire»;
- Word e PowerPoint non sono stati rigenerati dopo l'ultima modifica di guide.yaml, delle schermate o del brand;
- con un brand (docs/brand/brand.json) la copertina non ha il logo, o il piede non ha la ragione sociale;
- nella sorgente o nei documenti resta un marcatore di sviluppo: «not verified», «non verificato», «da verificare», segnaposto, TODO o TBD, rischi o punti aperti, riferimenti interni (NV-…, SR-…, DEC-…), percorsi della documentazione di sviluppo; i marcatori in più dell'azienda sono in docs/brand/brand.json (markers).
Correggi la sorgente e rigenera; un punto che non si può ancora chiudere resta in open-points.md e blocca la consegna finché non è chiuso o il referente non accetta di consegnare senza quel passo (scritto nel pacchetto di HANDOVER_APPROVAL).

**Check:** check.mjs senza finding su ogni guida; open-points.md di ogni guida chiuso

**Output:** docs/audit/<data>-guides.md

### HANDOVER_APPROVAL · Consegna e chiusura dello sviluppo

approval · category Documentazione & deliverable · skill none: the agent A-03 Independent Verifier of the team decides it, not a person · applies because: Sempre

Consegna a chi decide il passo (A-03 per la squadra, il responsabile funzionale quando decide una persona):
- documentazione: specifica, documento funzionale e tecnico (DF e DT, docs/deliverables/), release notes;
- il report di DOCS_COVERAGE: ogni oggetto consegnato documentato o escluso con il motivo;
- le guide per il cliente (docs/guides/): installazione e configurazione, e una guida d'uso per ruolo, in Word e PowerPoint, con il report di GUIDE_CHECK senza finding;
- report di audit, se il piano li ha;
- esiti dei test;
- stato del playbook con le eventuali deviazioni;
- le modifiche alla specifica registrate dopo la sua approvazione (install.mjs spec-change), che chi decide il passo riapprova qui in un solo blocco;
Prima di chiedere l'approvazione prepara il pacchetto di evidenze in un solo documento o nella pull request, con i link; l'approvazione la dà chi decide il passo, esplicitamente: l'agente della squadra con l'autorità quando decide la squadra, altrimenti la persona indicata; tu la registri (chi, data, motivazione, riferimento) senza impostare tu stati che la rappresentano.
Chiedi l'accettazione esplicita: con questa lo sviluppo è chiuso.

**Check:** accettazione di chi decide il passo (A-03, o il responsabile funzionale)
