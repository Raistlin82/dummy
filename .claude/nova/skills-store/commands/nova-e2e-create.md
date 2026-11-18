---
description: Crea o integra test end-to-end sull'interfaccia delle app dello sviluppo (Playwright, o OPA5 dove il progetto usa quello) — percorsi della richiesta, errori, guard — con doppia verifica UI e servizio, e li porta a zero fallimenti.
argument-hint: "<app | entità | scenario in parole>"
---

Crea o integra i test end-to-end delle app: percorsi dell'utente dall'interfaccia, con la verifica sia di quello che
l'interfaccia mostra sia di quello che il servizio ha registrato.

Comando generico del toolkit NOVA, derivato da `test-kyma-create` di un prodotto CAP + Fiori elements: l'ambiente, le
app e gli helper non sono scritti qui, si leggono o si misurano a ogni esecuzione.

## Argomento: $ARGUMENTS

- il nome di un'app (la sua cartella, o la parte finale) o di un'entità → test nuovi o integrati per quell'app;
- uno scenario in parole → il file più adatto, con i casi nuovi.

## Contesto — Fase 0, sempre

1. **Il dominio**: i percorsi utente e i criteri di accettazione in `.claude/nova/REQUEST.md` e in
   `docs/specification.md`. Ogni test cita il criterio che verifica.
2. **Le app**, scoperte da git e mai da `ls`:
   ```bash
   git ls-files | grep -E '(^|/)webapp/manifest\.json$' | sed -E 's#/webapp/manifest\.json$##' | sort -u
   ```
   Dal `manifest.json` di ciascuna: Fiori elements o freestyle, le route e i target (list report, object page), il
   servizio.
3. **L'ambiente** in cui girano i test, dal target dello sviluppo NOVA e dai file:
   - locale: il servizio avviato dal progetto (`cds watch`, `ui5 serve`, lo script `dev`/`start`);
   - Kyma: il cluster di sviluppo o un cluster locale (k3d, kind) con il chart del progetto;
   - Cloud Foundry: lo spazio di sviluppo dopo il deploy del playbook;
   - S/4HANA o BTP ABAP: il launchpad del sistema di sviluppo. Le credenziali vengono solo da variabili d'ambiente.
4. **Il framework e gli helper esistenti**, misurati:
   ```bash
   git ls-files | grep -E 'playwright\.config\.|wdio\.conf|opaTests|/integration/.*Journey|/e2e' | head -20
   git ls-files | grep -iE '(e2e|integration).*(helper|fixture|page)' | head -20
   ```
   Si usano quelli. Se non c'è un framework end-to-end, proponi Playwright con `@playwright/test` e
   `@axe-core/playwright`, oppure OPA5 per le sole app UI5 (skill `sap-fiori-opa5-test-development`,
   `ui5-best-practices-opa5`), e fatti confermare la scelta prima di aggiungere dipendenze, con AskUserQuestion e i framework come opzioni.

## Procedura

1. **Analizza l'app**: `manifest.json`, annotazioni o viste, azioni e handler del servizio dietro.
2. **Elenca gli scenari**: happy path dei percorsi della richiesta, errori, guard (ruolo, stato), casi limite.
3. **Scrivi i test**:
   - navigazione per URL con le route dell'app (per Fiori elements, l'hash della route: `#/<EntitySet>(...)`), non
     per click lunghi;
   - selettori semantici: ruolo, nome accessibile, `aria-label`, testo visibile; mai id generati;
   - **doppia verifica**: quello che mostra l'interfaccia e quello che risponde il servizio (OData o API);
   - **pulizia** dopo ogni test dei dati che ha creato;
   - misura anche la **pagina di dettaglio**, non solo l'elenco: su un prodotto reale uno scan di accessibilità che
     apriva solo il list report non ha mai misurato l'object page, dove vivevano i frammenti custom.
4. **Esegui solo i file nuovi**, con il runner misurato.
5. **Indaga ogni rosso**: nel test o nell'app? Correggi dove sta l'errore e dillo.
6. **Correggi fino a zero fallimenti**, poi riporta: test aggiunti per scenario, difetti trovati con `file:riga`.

## Regole

- **Mai assumere che l'app sia corretta.**
- Niente attese fisse (`waitForTimeout`) al posto delle attese su uno stato: una pagina Fiori si aspetta finché non è
  finita l'attività (indicatori di caricamento spariti, rete ferma).
- L'accessibilità si misura con axe (WCAG 2.2 AA) nei test che la toccano; il giudizio completo è di `/nova-ux-quality`.
- Nel playbook NOVA questi test servono al passo `E2E_A11Y` e, per una modifica, a `REGRESSION_TESTS`.
