---
description: Scrive o aggiorna il profilo d'audit del progetto (docs/audit/AUDIT_PROFILE.md) — le decisioni che il codice non dice e che i comandi /nova-* leggono. Misura prima di chiedere, chiede a scelta con i candidati misurati, non inventa.
argument-hint: "[aggiorna|verifica] [chiave=valore ...]"
---

Scrive il **profilo d'audit** del repository: le poche decisioni che nessun comando può misurare dal codice, e che
i comandi d'audit NOVA (`/nova-audit-all`, `/nova-security-matrix`, `/nova-app-audit` e gli altri) leggono a ogni
esecuzione. Tutto il resto quei comandi lo misurano da soli, ogni volta: per questo il profilo è corto.

Comando generico del toolkit NOVA. Prende il posto della generazione dei comandi d'audit per progetto: i comandi
restano uguali per tutti, cambia solo questo file.

## Argomento: $ARGUMENTS

- vuoto → crea il profilo se manca; se c'è, chiede solo le chiavi che mancano;
- `aggiorna` → rimisura le chiavi misurabili e propone le differenze;
- `verifica` → confronta il profilo con il repository e con lo sviluppo NOVA, senza scrivere: ogni valore smentito è un finding;
- `chiave=valore` → imposta direttamente quelle chiavi (per esempio `TENANT_SCOPE_FIELD=nessuno`).

## Contesto — Fase 0, sempre

1. **Lo sviluppo NOVA**, se il repository ha `.claude/nova/skills.manifest.json`: il titolo e la richiesta
   (`.claude/nova/REQUEST.md`) danno nome e dominio; tipologia, target e release danno lo stack e le edizioni da
   verificare; per una modifica, `change.cleanCoreTarget` dà il livello Clean Core obiettivo. Le risposte in codici,
   `development.answers`, decidono due chiavi: `PROCESS` (processo a fasi) e `SAP_STORE` (pubblicazione sul SAP Store).
2. **Il profilo esistente**, `docs/audit/AUDIT_PROFILE.md`, se c'è: non si riscrive una chiave che l'utente ha deciso
   (origine `chiesto`) senza dirlo.
3. **Il repository**, misurato adesso:
   ```bash
   git rev-parse --show-toplevel && git branch --show-current
   git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@.*/@@'
   git ls-files | grep -E '(^|/)webapp/manifest\.json$' | sed -E 's#/webapp/manifest\.json$##' | sort -u
   ls srv db 2>/dev/null | head -3; ls xs-security.json mta.yaml 2>/dev/null
   git ls-files | grep -E '\.dcl$|/i18n[^/]*\.properties$|a11y.*baseline.*\.json$' | head -20
   git log -20 --format='%s%n%b' | grep -E '^[A-Z][A-Za-z-]+: ' | sort | uniq -c | sort -rn | head -5
   ```

## Le chiavi

| Chiave | Che cos'è | Da dove viene |
|---|---|---|
| `PROJECT_NAME` | nome leggibile, nei titoli dei rapporti | titolo dello sviluppo NOVA; altrimenti il nome del repository |
| `DOMAIN` | il dominio in una frase: che cosa fa il prodotto e per chi | la richiesta (`REQUEST.md`), riassunta; altrimenti **chiesta** |
| `REPORT_LANG` | lingua dei rapporti | `it`, se nessuno chiede altro |
| `AUDIT_DIR` | dove si salvano i rapporti | `docs/audit/` |
| `PENDING_REGISTER` | il registro degli stati dei finding, che sopravvive fra i run | `docs/audit/PENDING.md` |
| `TENANT_SCOPE_FIELD` | il campo che segrega i dati (società, organizzazione commerciale, tenant…) o `nessuno` | **chiesto**, con i candidati misurati: campi presenti in molte entità e nei filtri dei ruoli |
| `SOD_PAIRS` | coppie di ruoli in conflitto (separazione dei compiti), o `nessuna` | **chiesto**, con i ruoli misurati dal descrittore e dal codice |
| `COMPLIANCE_FRAMEWORKS` | riferimenti normativi dei finding di sicurezza | `OWASP Top 10, OWASP ASVS 4.0.3 L2, OWASP API Security Top 10, NIST SP 800-53, CIS, SAP Secure Operations Map`, più quelli di settore che l'utente aggiunge |
| `BRANCH_CONVENTION` | come si chiamano i rami delle correzioni | `nova/<comando>-<aaaa-mm-gg>`, o la convenzione misurata sui rami del repository |
| `COMMIT_TRAILER` | righe finali dei commit | misurate sugli ultimi commit; altrimenti nessuna |
| `PROCESS_PHASES` | le fasi del processo di dominio, in ordine, o `nessuno` | `nessuno` se `answers.PROCESS` è `NO`; con `YES`, **chiesto**, con le fasi che la richiesta descrive. Senza manifest, chiesto solo se servirà `/nova-check-matrix` |
| `STATUS_MACHINE` | dove vivono le transizioni di stato | misurato (enum di stato, handler di transizione, behavior RAP), poi confermato |
| `CONFIG_ENTITY` · `CONFIG_SEED` | l'entità dei parametri configurabili e i file che la popolano | misurati (entità di configurazione e i loro CSV, tabelle di customizing), poi confermati |
| `REMOTE_API_CATALOG` | il catalogo delle API esterne consumate, se il progetto ne tiene uno | misurato; se manca, `nessuno` |
| `CLEAN_CORE_EDITIONS` | le edizioni su cui verificare il rilascio delle API | dal target dello sviluppo NOVA (Public, Private, on-premise con la release; BTP ABAP) |
| `TONE_PROFILE` | registro e canone terminologico dei testi | `formale`; il canone lo propone `/nova-text-polish` al primo run |
| `A11Y_BASELINE` | la baseline di accessibilità, se esiste | misurata (file di baseline degli scan axe); altrimenti `nessuna` |
| `STORE_CHANNEL` | il canale di pubblicazione | `SAP Store` se `answers.SAP_STORE` è `YES`, `nessuno` se è `NO`. Senza manifest, `nessuno` salvo che l'utente dica SAP Store |

## Procedura

1. **Misura** tutte le chiavi misurabili, e conserva il comando che ha dato ogni valore.
2. **Chiedi** solo quelle che restano, con lo strumento AskUserQuestion: una domanda per chiave, i candidati misurati come opzioni (il più probabile per primo, con «(consigliato)»), fino a 4 domande per chiamata, di seguito finché non ne restano. Senza lo strumento, un elenco numerato in un solo messaggio.
   Due risposte cambiano il comportamento dei comandi, e vanno chieste con cura:
   - `TENANT_SCOPE_FIELD`: se il prodotto non segrega i dati, la risposta è `nessuno`, e i controlli di scope dei
     comandi si dichiarano non applicabili invece di cercare a vuoto e riportare zero;
   - `DOMAIN`: serve a distinguere un difetto di dominio da uno di stile. Se la richiesta NOVA esiste, proponi la
     sintesi come opzione e fattela confermare.

   `PROCESS_PHASES` e `STORE_CHANNEL` non si decidono qui quando c'è lo sviluppo NOVA: seguono le sue risposte, che
   hanno deciso il piano (la matrice delle fasi, i controlli del SAP Store e il passo `STORE_READINESS` ci sono solo
   con `YES`). Se l'utente vuole altro, la risposta si cambia nel configuratore e il piano si ricalcola; un profilo
   d'audit che la contraddice è un finding di `verifica`.
3. **Scrivi** `docs/audit/AUDIT_PROFILE.md`:

   ```markdown
   # Profilo d'audit · <PROJECT_NAME>

   Letto dai comandi /nova-*. Le chiavi misurabili si rimisurano con `/nova-audit-profile aggiorna`.

   | Chiave | Valore | Origine |
   |---|---|---|
   | PROJECT_NAME | … | sviluppo NOVA |
   | TENANT_SCOPE_FIELD | … | chiesto, <data> |
   | STATUS_MACHINE | … | misurato: `<comando>` |
   ```

   L'origine non è decorativa: dice quale valore si rimisura e quale no.
4. **Non committare** da solo: proponi il commit all'utente (`git add docs/audit/AUDIT_PROFILE.md`).

## Regole

- **Misura prima di chiedere.** Chiedere un valore che il repository conosce produce un profilo che mente al primo refactor.
- **Una misura vuota si dichiara.** Se un comando di misura non dà nulla, la chiave resta vuota con la nota `non misurabile: <perché>`, non con un valore plausibile.
- **In `verifica`, il delta è un finding.** Una chiave smentita dal repository (un campo di scope che non esiste più, una baseline cancellata) va nel rapporto dell'audit che la usa.
- Il profilo contiene decisioni, non segreti: niente credenziali, niente URL con token.
