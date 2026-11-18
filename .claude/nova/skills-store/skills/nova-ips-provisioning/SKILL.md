---
name: nova-ips-provisioning
description: Identity Provisioning (IPS) e Identity Directory di SAP Cloud Identity Services per gli sviluppi NOVA — dalla matrice dei ruoli ricava gruppi, sistemi sorgente e target, trasformazioni e job per ogni landscape; prepara per l'amministratore di IPS la configurazione esatta (proprietà e JSON delle trasformazioni) che si fa solo in console; avvia i job READ/RESYNC con l'API del tenant (/ips/service/publicapi/v1/startJob) e crea utenti e gruppi di test con la Identity Directory SCIM API (/scim/Users, /scim/Groups), sempre con dry-run, conferma esplicita e registro in docs/identity/ips-log.md; in produzione solo lettura e la lista per l'amministratore. Usala nel passo IDENTITY_PROVISIONING del playbook, per preparare le assegnazioni di PROD_ROLE_ASSIGNMENTS, quando l'utente chiede di portare utenti e gruppi da IAS a un subaccount SAP BTP, a SAP S/4HANA Cloud o ad altri sistemi, di creare utenti di test in IAS, o di capire perché un job di provisioning non porta utenti o ruoli.
---

# Identity Provisioning e utenti di test

Gli utenti e i gruppi di uno sviluppo arrivano nei sistemi con **Identity Provisioning** (IPS): una sorgente (di solito il tenant IAS, cioè la Identity Directory) e uno o più target (il subaccount SAP BTP con le role collection, il tenant SAP S/4HANA Cloud con i business role, altri sistemi). Tu progetti il provisioning dalla matrice dei ruoli, prepari la configurazione per chi amministra IPS e, nei tenant di sviluppo e test, esegui le poche scritture che SAP espone come API.

Cosa si fa con un'API e cosa a mano, verificato sulla documentazione SAP (`references/api-sources.md`):

| Attività | Come |
|---|---|
| Sistemi sorgente e target, proprietà, trasformazioni, pianificazione | **A mano**, nella console, dall'amministratore di IPS. Tu prepari la configurazione esatta: `references/admin-config.md` |
| Job *Simulate* | **A mano**, dalla console |
| Job *Read* e *Resync* | API del tenant: `POST https://<ias-host>/ips/service/publicapi/v1/startJob/{SourceSystemId}/jobs/{READ\|RESYNC}`, utente tecnico con *Access Identity Provisioning Tenant Admin API* |
| Esito dei job | **A mano**: *Provisioning Logs* nella console |
| Utenti e gruppi di test, membri dei gruppi | Identity Directory SCIM API: `/scim/Users`, `/scim/Groups`. Mai l'API deprecata `/service/scim` |
| Real-time provisioning | Si configura in console (tile *Real-Time Provisioning*); non lo automatizzi |

Lo script `scripts/ips.mjs` di questa skill fa le scritture possibili, sempre in dry-run prima. `node scripts/ips.mjs help` mostra i comandi, `node scripts/ips.mjs selftest` controlla lo script senza rete.

## Regole

- **Credenziali solo dall'ambiente.** Client ID e secret in variabili d'ambiente (`IPS_CLIENT_ID`/`IPS_CLIENT_SECRET` per i job, `IAS_CLIENT_ID`/`IAS_CLIENT_SECRET` per la Identity Directory), oppure un certificato p12 in un percorso **fuori dal repository** (`IPS_CERT_P12`, `IAS_CERT_P12`, con la passphrase in variabile). Mai nel repository, in chat o nei log; non chiedere all'utente di incollarli. Lo script maschera i segreti e rifiuta un certificato dentro il repository.
- **Ogni scrittura: piano, conferma, esecuzione, registro.**
  1. Esegui il comando senza `--apply`, con le variabili d'ambiente già impostate: lo script stampa metodo, URL, corpo senza segreti e l'*hash del piano*.
  2. Mostra il piano all'utente e chiedi un sì esplicito, con AskUserQuestion (*Confermo* · *Non scrivere* · *Correggo il piano*). Per un tenant condiviso, il sì è di chi lo amministra.
  3. Riesegui lo stesso comando con `--apply --confirm <hash> --confirmed-by "<nome, ruolo>"`. Se il piano è cambiato, l'hash non corrisponde e lo script si ferma.
  4. Lo script registra ogni richiesta in `docs/identity/ips-log.md` del repository dell'app (ora, tenant, richiesta, esito, id, chi ha confermato), senza segreti. Committalo con il passo.
- **Produzione: solo lettura.** `IPS_TENANT_ROLE` e `IAS_TENANT_ROLE` dicono `dev`, `test` o `prod`; se non sono impostate lo script considera il tenant di produzione e non scrive. In produzione prepari la lista per l'amministratore (piano del dry-run, configurazione, assegnazioni) e dopo verifichi in lettura (`get-user`, `get-group`, *Provisioning Logs*).
- **Niente password nei file.** Lo script rifiuta un utente con una password: gli utenti di test ricevono la mail di attivazione di IAS (`sendMail` nell'estensione SAP).
- **Un solo posto per gli utenti di test.** Se il piano ha `IAS_CONFIG_DEV` con il provider Terraform (`infra/ias/`), utenti e gruppi di test stanno lì: non crearli anche con lo script. Lo script serve quando Terraform non è nel piano.
- **Fonti.** Proprietà e trasformazioni di un target che `references/admin-config.md` non copre le leggi dalla sua pagina SAP con il server MCP SAP Docs, e nella consegna scrivi la fonte.

## 1. Dalla matrice dei ruoli al disegno del provisioning

Parti dalla matrice dei ruoli (`AUTH_MATRIX`) e dalla specifica. Per ogni landscape (sviluppo, test, produzione) scrivi in `docs/technical.md`, sezione *Provisioning*:

- **Sorgente**: IdP aziendale via IAS, Identity Directory, oppure SAP S/4HANA Cloud Public come sistema principale.
- **Gruppi**: un gruppo IAS per ruolo della matrice, con un prefisso comune dello sviluppo (per esempio `BTP_SALESORDER_`), che serve ai filtri e ai prefissi dei target.
- **Target**, solo quelli che servono:
  - subaccount SAP BTP: gruppi → role collection, un target per subaccount;
  - SAP S/4HANA Cloud Public Edition: business user e business role (`SAP_COM_0193`, o `SAP_COM_0465` con il connettore versione 3); i business role devono esistere prima;
  - SAP BTP ABAP environment, SAP Application Server ABAP (Private Edition e on-premise, via Cloud Connector), SAP Build Work Zone, SAP Analytics Cloud, SAP Datasphere (solo utenti): dalla pagina SAP del target.
- **Trasformazioni**: cosa cambia rispetto al default.
- **Job**: Simulate, poi Read la prima volta e Resync dopo; pianificazione e chi la imposta.
- Gli utenti tecnici e di comunicazione non passano da IPS.

## 2. La configurazione per l'amministratore di IPS

Con `references/admin-config.md` prepara, per ogni sistema, la tabella delle proprietà con i valori dello sviluppo e il JSON completo della trasformazione, partendo da quella di default. Al posto di password, secret e certificati scrivi `<da inserire dall'amministratore>`.

Mettila in `docs/identity/ips-config-<landscape>.md` e consegnala all'amministratore di IPS. Nel tenant di sviluppo la configura lui, dopo la conferma dell'utente; in produzione chi amministra il tenant di produzione. Quando ha salvato i sistemi, fatti dare l'ID del sistema sorgente (la fine dell'URL nella console) e scrivilo nella configurazione: serve ai job.

Controlla con l'amministratore:

- sorgente IAS con `ias.api.version=2`: la versione 1 dell'API viene dismessa il 30 novembre 2026;
- utente tecnico della sorgente con *Manage Users* (o *Read Users*) e *Manage Groups*;
- soglie di cancellazione (`ips.delete.threshold.*`) sui target;
- per SAP BTP, role collection e trust già presenti nel subaccount (con `btp-administration`, in lettura).

## 3. Utenti e gruppi di test (sviluppo e test)

Prepara un file come `references/seed.example.json` con gli utenti di test della matrice, i gruppi e i membri, fuori dal codice dell'app (per esempio `docs/identity/test-users.json`, senza password). Poi:

```sh
export IAS_TENANT_HOST=<tenant>.accounts.ondemand.com IAS_TENANT_ROLE=dev   # e IAS_CLIENT_ID / IAS_CLIENT_SECRET già nell'ambiente
node <skill>/scripts/ips.mjs seed --file docs/identity/test-users.json
```

Dopo il sì, lo stesso comando con `--apply --confirm <hash> --confirmed-by "<nome, ruolo>"`. Lo script crea gli utenti, poi i gruppi, poi aggiunge i membri con gli id appena creati. Se un utente o un gruppo esiste già, la creazione fallisce e lo script si ferma: leggi con `get-user` / `get-group` e aggiungi i membri con `add-members --group <id> --user <id>`.

L'utente tecnico della Identity Directory è un amministratore di tipo *System* con *Manage Users* e *Manage Groups*, creato dall'amministratore di IAS.

## 4. Avvio dei job

Dopo *Simulate* dalla console e il controllo del suo log:

```sh
export IPS_TENANT_HOST=<tenant>.accounts.ondemand.com IPS_TENANT_ROLE=dev   # e IPS_CLIENT_ID / IPS_CLIENT_SECRET
node <skill>/scripts/ips.mjs start-job --source <SourceSystemId> --type READ
```

Con il sì dell'utente, `--apply --confirm <hash> --confirmed-by "..."`. L'utente tecnico è un amministratore di tipo *System* con *Access Identity Provisioning Tenant Admin API*, autenticato con client ID e secret. L'API avvia il job e non ne dà l'esito: controlla *Provisioning Logs* nella console (o chiedilo all'amministratore) e scrivi il risultato nel rapporto del passo.

## 5. Produzione (PROD_ROLE_ASSIGNMENTS)

In produzione non scrivi: né job, né utenti, né gruppi. Prepari per l'amministratore di produzione, in `docs/technical.md` sezione *Produzione*:

- gruppi IAS di produzione e role collection del subaccount, policy AMS dell'applicazione IAS;
- business role (Public, BTP ABAP) o ruoli PFCG (Private Edition, on-premise) per gruppo;
- la configurazione IPS di produzione (§2) e i job da avviare, con l'ordine.

Dopo che l'amministratore ha eseguito, verifichi in lettura: le role collection con `btp-administration`, gruppi e membri con `node <skill>/scripts/ips.mjs get-group --display-name <gruppo>` (con le credenziali di lettura che l'amministratore ti dà, `IAS_TENANT_ROLE=prod`), e registri l'esito nel rapporto del passo.

## 6. Quando non funziona

- **401 sul job**: client ID o secret sbagliati, o l'utente tecnico non è di tipo *System*. **403**: manca *Access Identity Provisioning Tenant Admin API*.
- **Job avviato ma nessun utente nel target**: filtri della sorgente, prefisso dei gruppi o `condition` della trasformazione; `xsuaa.origin` diverso dall'origin della trust del subaccount; business role inesistente in SAP S/4HANA Cloud.
- **Gruppi ignorati dalla sorgente IAS**: sistema con `ias.api.version=1`, dove la mappatura dei gruppi è ignorata di default.
- **400 sulla creazione di un utente con gruppi** ("Error parsing request body", KBA 3259255): la Identity Directory non assegna i gruppi dall'endpoint degli utenti; usa `add-members`.
- **Rete**: lo script chiama solo `https://<host>`; se la rete richiede un proxy, eseguilo da dove il tenant è raggiungibile.
