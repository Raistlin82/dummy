---
description: Esegue i test end-to-end sull'interfaccia delle app dello sviluppo nell'ambiente giusto (locale, Kyma, Cloud Foundry, launchpad ABAP), indaga ogni fallimento fra test e app e riesegue fino a zero rossi.
argument-hint: "[app | file | filtro]"
---

Esegue i test end-to-end delle app e li porta a zero fallimenti, correggendo l'app o il test secondo dove sta davvero
l'errore.

Comando generico del toolkit NOVA, derivato da `test-kyma-run` di un prodotto CAP + Fiori elements: l'ambiente e i
comandi non sono scritti qui, si misurano.

## Argomento: $ARGUMENTS

Facoltativo: un'app, un file o un filtro. Senza argomento, tutti i test end-to-end.

## Contesto — Fase 0, sempre

1. **Il dominio**: `.claude/nova/REQUEST.md`, per giudicare se un comportamento è giusto.
2. **Il comando e l'ambiente**, misurati:
   ```bash
   node -e "console.log(JSON.stringify(require('./package.json').scripts ?? {}, null, 1))" 2>/dev/null | grep -iE 'e2e|playwright|opa|wdi5|integration'
   git ls-files | grep -E 'playwright\.config\.|wdio\.conf' | head
   ```
   Dal file di configurazione ricava l'URL di base e i progetti. L'ambiente dal target dello sviluppo NOVA: locale,
   cluster Kyma (anche k3d o kind), spazio Cloud Foundry, launchpad del sistema ABAP.
3. **L'ambiente è su?** Prima di eseguire, una richiesta all'URL di base: se non risponde, l'esito è
   `NON VERIFICATO: ambiente non raggiungibile`, non una serie di rossi da indagare.

## Procedura

1. **Esegui** i test con lo script misurato.
2. **Conta** verdi, rossi, saltati e ritentati: un test verde solo al secondo tentativo è instabile, e va detto.
3. **Per ogni rosso**:
   - leggi il test **e** il codice dell'app o del servizio coinvolto (manifest, annotazioni, handler);
   - nel test: correggilo e spiega perché era sbagliato;
   - nell'app: correggila e documenta il difetto.
4. **Riesegui** fino a zero rossi, poi riporta: test / tempo / ambiente, difetti con `file:riga`.

## Regole

- **Mai assumere che l'app sia corretta.**
- Credenziali solo da variabili d'ambiente, mai nel test né nel rapporto.
- Non disattivare né saltare un test per avere il verde.
- Nel playbook NOVA il passo `E2E_A11Y` si chiude con
  `node .claude/nova/install.mjs done E2E_A11Y --evidence "<comando>: <N verdi>, axe: <violazioni serie o critiche>"`.
