# Consegna all'amministratore di SAP Cloud ALM (Operations)

Registrazione in Landscape Management, attivazione dei casi d'uso di monitoraggio, allarmi e notifiche non hanno un'API pubblica: li fa a mano l'amministratore di Cloud ALM, e la configurazione dei sistemi (`/SDF/ALM_SETUP`, communication arrangement, agenti) l'amministratore di quel sistema. Tu prepari la lista e dopo verifichi in lettura con il server MCP `calm`.

Scrivi la lista in `docs/technical.md`, sezione *Monitoraggio*, con questa struttura, una riga per caso d'uso:

| Servizio o sistema | Registrato in Landscape Management | Caso d'uso | Prerequisito nel sistema, e chi lo fa | Filtri | Eventi e soglie | Destinatari degli allarmi | Stato |
|---|---|---|---|---|---|---|---|
| `<SID / subaccount / tenant>` | sì / no (letto con `calm_list`, resource `landscape_objects`) | Health / Integration & Exception / Job & Automation / Real User Monitoring / ... | per esempio `SAP_COM_0527`, `/SDF/ALM_SETUP` (Basis), destination `CALM_datacollector` | servizio OData, BSP, iFlow, topic, oggetto di application log, job | ... | gruppo o persona | da fare / fatto il <data> da <chi> |

Le voci per target e servizio sono quelle del passo `CALM_OPERATIONS` del playbook: segui solo quelle dello sviluppo.

**Allarmi.** Per ogni caso d'uso la colonna *Destinatari degli allarmi* dice anche l'azione dell'evento: e-mail (i destinatari vanno prima nell'app *Notification Management*), ticket verso lo strumento ITSM del cliente (*External API Management*), operation flow di *Operations Automation*. Le situazioni passano dall'*Intelligent Event Processing*. Fonte: [Setting up Different Event Actions](https://help.sap.com/docs/CloudALM/877c96cf971648b09ee0d0a64f7f4fef/5b5b26a4d08e47c4be90378751b02545.html), letta il 2026-11-12.

**Sistemi non SAP o non strumentati.** Metriche, log e tracce si possono spingere con le *Raw Data Inbound* API (formato OpenTelemetry) di Health Monitoring e di Integration & Exception Monitoring; è una scelta dell'architettura dello sviluppo, non una scrittura di questa skill. Fonte: [APIs in SAP Cloud ALM](https://help.sap.com/docs/CloudALM/877c96cf971648b09ee0d0a64f7f4fef/f5d9f9e662b74dabacb5d281d2846a74.html), letta il 2026-11-12.

## Verifica dopo la configurazione (in lettura)

Con il server MCP `calm` (voce `mcp-calmcp`):

- `calm_resources` per i provider e le loro dimensioni;
- `calm_list` con resource `landscape_objects` per il servizio registrato;
- `calm_analytics` sui provider di Operations (`Exceptions`, `Jobs`, `Messages`, `Metrics`, `MonitoringEvents`, `Requests`, `ScenarioExecutions`, `ServiceLevels`, `StatusEvents`) filtrati sul servizio: dati presenti, l'eccezione o il messaggio di prova arrivato, il primo job.

Se un provider non restituisce dati, l'istanza di lettura di calmcp può non avere lo scope del provider (per esempio `calm-api.exm.read`, `calm-api.jobs.read`, `calm-api.hm.read`): dillo all'amministratore, non allargare gli scope dell'istanza di scrittura.

Registra in `docs/alm/calm-log.md` solo le scritture fatte con lo script; le attività dell'amministratore vanno nella colonna *Stato* della tabella, con data e nome.
