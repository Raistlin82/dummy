# Configurazione per l'amministratore di Identity Provisioning

Sistemi, proprietà e trasformazioni si configurano nella console di SAP Cloud Identity Services (*Identity Provisioning > Source Systems / Target Systems*): per questa parte non c'è un'API documentata. Tu prepari la configurazione esatta, l'amministratore la inserisce. Le tabelle vengono dalle pagine SAP in `api-sources.md`: per un target che qui non c'è, leggi la sua pagina con il server MCP SAP Docs (*Identity Provisioning, Target Systems*) prima di scrivere le proprietà.

Nella consegna non scrivi mai password, client secret o certificati: al loro posto `<da inserire dall'amministratore>`. Il valore lo conosce solo chi lo crea.

## 1. Sorgente: Identity Authentication (Identity Directory)

Utente tecnico: amministratore di tipo *System* con *Manage Users* (o almeno *Read Users*) e *Manage Groups*. SAP raccomanda il certificato.

| Proprietà | Valore |
|---|---|
| `Type` | `HTTP` |
| `URL` | `https://<tenant>.accounts.ondemand.com` |
| `ProxyType` | `Internet` |
| `Authentication` | `ClientCertificateAuthentication` (consigliato) oppure `BasicAuthentication` |
| `User` / `Password` | solo con Basic: client ID e secret dell'utente tecnico, `<da inserire dall'amministratore>` |
| `ias.api.version` | `2` (la versione 1 viene dismessa il 30 novembre 2026) |
| `ias.group.filter` | i gruppi dello sviluppo, per esempio `displayName sw "BTP_SALESORDER_"` se il prefisso è quello della matrice; senza filtro si leggono tutti i gruppi |
| `ias.user.filter` | facoltativo: gli utenti da leggere |

Controlla che la sintassi del filtro (operatori come `eq`, `sw`) sia accettata dalla *Identity Directory SCIM API: Group Search* sul SAP Business Accelerator Hub; nel dubbio usa `eq` su un gruppo per volta.

## 2. Target: SAP BTP XS Advanced UAA (subaccount)

Un target per ogni subaccount. Credenziali: API credential del servizio SAP Authorization and Trust Management a livello di subaccount (`btp create security/api-credential`), create dall'amministratore del subaccount.

| Proprietà | Valore |
|---|---|
| `Type` | `HTTP` |
| `URL` | `https://api.authentication.<region>.hana.ondemand.com` |
| `ProxyType` | `Internet` |
| `Authentication` | `BasicAuthentication` |
| `OAuth2TokenServiceURL` | `https://<subaccount_subdomain>.authentication.<region>.hana.ondemand.com/oauth/token` |
| `User` / `Password` | client ID e secret dell'API credential, `<da inserire dall'amministratore>` |
| `xsuaa.origin` | Origin Key della trust configuration del subaccount per gli utenti business (per esempio `sap.custom`, oppure quello del tenant IAS) |
| `xsuaa.group.prefix` | facoltativo: solo i gruppi con questo prefisso arrivano al subaccount, senza il prefisso nel nome |
| `ips.delete.threshold.groups`, `ips.delete.threshold.users` | consigliati: una soglia bassa evita cancellazioni di massa per un filtro sbagliato |

I gruppi arrivano come role collection con lo stesso nome (senza prefisso). Le role collection con i loro ruoli le crea il deploy dell'app o l'amministratore del subaccount: IPS assegna gli utenti, non crea i ruoli dell'app.

## 3. Target: SAP S/4HANA Cloud Public Edition

Nel tenant: communication user, communication system e communication arrangement. Versione del connettore secondo lo scenario:

| `s4hana.cloud.api.version` | Scenario | Gruppi |
|---|---|---|
| `1` (default) | `SAP_COM_0193` (SOAP Business User) | gruppo = business role; si assegnano solo gli utenti ai ruoli |
| `3` | `SAP_COM_0465` (SCIM) | gruppi utente e role; `s4hana.cloud.group.unique.attribute` = `externalId,['urn:ietf:params:scim:schemas:extension:sap:2.0:Group']['type']` |

| Proprietà | Valore |
|---|---|
| `Type` | `HTTP` |
| `URL` | l'API-URL del communication arrangement, per esempio `https://my123456-api.s4hana.ondemand.com` |
| `ProxyType` | `Internet` |
| `Authentication` | `ClientCertificateAuthentication` (consigliato) oppure `BasicAuthentication` |
| `User` / `Password` | solo con Basic: il communication user, `<da inserire dall'amministratore>` (niente virgole) |
| `s4hana.cloud.hr.switch.active` | `true` se l'integrazione HR è attiva (default), versione 1 |
| `s4hana.cloud.user.roles.overwrite` | `false` per non togliere ruoli assegnati fuori da IPS (versione 1) |
| `s4hana.cloud.roles.prefix` (v1) o `s4hana.cloud.group.prefix` (v3) | il prefisso dei gruppi che arrivano al tenant |
| `ips.delete.threshold.roles`, `ips.delete.threshold.users` | consigliati |

I business role devono già esistere nel tenant (passo `S4_BACKEND_ROLES`): IPS non li crea né li cancella.

## 4. Altri target

Per SAP BTP ABAP environment, SAP Application Server ABAP (Private Edition e on-premise, via Cloud Connector), SAP Build Work Zone, SAP Analytics Cloud e SAP Datasphere segui la pagina del target in *Identity Provisioning > Target Systems* della documentazione SAP: proprietà, prerequisiti del sistema e trasformazione di default. Scrivi nella consegna la fonte e la data della pagina letta.

## 5. Trasformazioni

Parti sempre dalla trasformazione di default che la console mostra dopo il primo salvataggio, e cambia solo quello che lo sviluppo chiede. Le modifiche tipiche:

- **Prefisso dei gruppi.** Preferisci la proprietà del target (`xsuaa.group.prefix`, `s4hana.cloud.group.prefix`): la trasformazione di default la legge già nella sua `condition` e toglie il prefisso dal nome.
- **Gruppi di un'applicazione IAS.** Tra IAS e Local Identity Directory i gruppi specifici di un'applicazione si risolvono per `displayName`, `applicationId` e `type`: serve un `valueMapping` di `applicationId`, come nella pagina SAP della sorgente IAS.
- **Utenti di test.** Se nel sistema di sviluppo arrivano solo gli utenti di test, filtra alla sorgente (`ias.user.filter`) invece di cambiare la `condition` della trasformazione.

Nella consegna metti la trasformazione intera come JSON, con un commento prima del blocco che dice cosa cambia rispetto al default.

## 6. Esecuzione e verifica

1. L'amministratore salva sorgente e target, e sulla sorgente esegue *Jobs > Simulate Job > Run Now* (solo dalla console).
2. Controlla il log in *Provisioning Logs*: entità lette, create, aggiornate, saltate, fallite.
3. Poi *Read Job* (la prima volta) o *Resync Job*: dalla console, oppure con `scripts/ips.mjs start-job` e l'utente tecnico dell'API dei job, dopo la conferma.
4. Di nuovo *Provisioning Logs*; per il dettaglio delle entità servono le proprietà `ips.trace.created.entity.content` / `ips.trace.updated.entity.content`, da togliere dopo la verifica perché scrivono dati personali nei log.
5. Pianificazione: *Schedule* nella console, dall'amministratore. I job di IPS si possono seguire in SAP Cloud ALM (Job & Automation Monitoring, passo `CALM_OPERATIONS`).
