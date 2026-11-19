# Documentazione tecnica

## SAP Cloud ALM

Tenant: https://key-to-business-srl-cloudalm.eu20.alm.cloud.sap
Sviluppo NOVA: f17d5823-e2b6-4c9e-b2ee-ef2596feeb61

**Stato della lettura (CALM_PROJECT): NON eseguita.** Nel sandbox non sono presenti le credenziali
di accesso alle API di Cloud ALM (CALM_TENANT, CALM_REGION, CALM_CLIENT_ID, CALM_CLIENT_SECRET,
CALM_WRITE_SERVICE_KEY assenti) e il server MCP `calm` non è connesso. Nulla è stato letto né
scritto in Cloud ALM; nessun valore sotto è stato inventato.

| Dato | Stato | Chi lo fornisce |
|---|---|---|
| ID progetto Cloud ALM | non letto | project lead |
| Roadmap (template) e fase in corso | non letto | project lead |
| Scope del progetto | non letto | project lead |
| Release del deployment plan | non letto | project lead (app Projects and Setup) |
| Sprint | non letto | project lead |
| Project lead | non letto | project lead / admin |
| Chi approva i requisiti | non letto | project lead |
| Tester | non letto | project lead |
| Change Manager (Ready for Production) | non letto | project lead |
| Deployment Manager (deploy e conferma) | non letto | project lead |

Da fornire:
- Project lead: ID del progetto, release, sprint, scope e i nomi dei ruoli sopra; se mancano nel
  progetto li crea lui nell'app *Projects and Setup*.
- Amministratore di Cloud ALM: un client dell'istanza *SAP Cloud ALM API* con soli scope di lettura
  (`calm-api.*.read`, compreso `calm-api.projects.read`) per la lettura via MCP `calm`, e, per le
  scritture successive, un'istanza separata con gli scope minimi (tasks, testcases, features,
  documents read/write); le credenziali nell'ambiente o in SAP Credential Store, mai nel repository.
- Collegamento nel configuratore (`nova-config.mjs alm`): non registrato, servono ID progetto e release.

### Decision on SAP Cloud ALM
Decision of c.ferraro@key2.it (run c8561bcd-ec7a-4812-afe8-f5fa655ceff9): this development does not work with SAP Cloud ALM. Nothing is read from or written to it; the items above stay unread on purpose.
