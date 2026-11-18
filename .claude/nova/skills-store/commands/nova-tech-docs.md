---
description: Genera la documentazione tecnica dello sviluppo dal codice, dai modelli e dai sistemi reali — oggetti e dipendenze, servizi e API, ruoli, ambienti, rilascio — e la tiene allineata a ogni rilascio.
argument-hint: "[area | completa]"
---

Genera `docs/technical.md`, la documentazione tecnica dello sviluppo: quella che chi lo mantiene legge prima di
toccarlo. Si scrive dal codice, dai modelli compilati e dai sistemi, mai dalla memoria o dalla specifica soltanto.

Comando generico del toolkit NOVA: stack, servizi e ambienti non sono scritti qui, si leggono a ogni esecuzione.

## Argomento: $ARGUMENTS

- vuoto o `completa` → tutto il documento, rigenerato;
- un'**area** (un servizio, un modulo, l'integrazione con un sistema) → solo le sezioni che la riguardano; il resto
  del documento resta com'è.

## Contesto — Fase 0, sempre

1. Il profilo e il piano: `.claude/nova/skills.manifest.json` (tipologia, target, backend, integrazioni) e
   `.claude/nova/PLAYBOOK.md`.
2. I documenti già prodotti: `docs/specification.md`, `docs/architecture.md` con i diagrammi
   `docs/architecture/*.drawio`, `docs/research.md` (le fonti SAP dello scenario), `docs/api.md`.
3. Lo stack, dai file del repository:
   ```bash
   git ls-files | grep -E '(^|/)(db|srv|app)/.*\.cds$|mta\.yaml$|xs-security\.json$|ui5\.yaml$|manifest\.json$' | head -60
   git ls-files | grep -E '\.(abap|asddls|asbdef|asdcls|asprj)$|\.abapgit\.xml$' | head -40
   ```

## Cosa scrivere

`docs/technical.md`, con queste sezioni, ciascuna solo se lo sviluppo la ha:

1. **Componenti e dipendenze**: moduli dell'MTA o del progetto, oggetti ABAP con package e dipendenze (per il codice
   ABAP la skill `sap-object-documenter`, se il piano la installa, e Nova ARC-1 in sola lettura), librerie con versione.
2. **Servizi e API**, generati dal modello e non riscritti a mano:
   - CAP: `npx cds compile srv --service all --to openapi -o docs/api/` per l'OpenAPI,
     `npx cds compile srv --service all --to edmx -o docs/api/` per il `$metadata`, `--to asyncapi` per gli eventi e
     `--to mermaid` per un diagramma del modello. Questi file documentano l'API; tra due applicazioni CAP l'API si
     scambia con `cds export`, non con l'EDMX o l'OpenAPI;
   - RAP: service definition e binding letti con Nova ARC-1, con il `$metadata` del servizio;
   - le API consumate (per esempio di SAP S/4HANA): nome e versione sul SAP Business Accelerator Hub, stato di rilascio,
     destination e communication scenario.
3. **Sicurezza**: scope, role template e role collection (da `xs-security.json` o da IAS), ruoli business e
   restrizioni nel sistema SAP, la matrice dei ruoli di `AUTH_MATRIX`.
4. **Ambienti**: per sviluppo, test e produzione il subaccount o il sistema, le destination, i servizi e i piani, il
   site di SAP Build Work Zone; mai credenziali, chiavi o URL con token.
5. **Rilascio**: come si costruisce e si porta in produzione (pipeline, Cloud Transport Management, trasporti ABAP),
   con i comandi reali del repository.
6. **Esercizio**: log, monitoraggio e allarmi, cosa guardare quando qualcosa si rompe.

Ogni sezione cita la fonte: il file del repository, il comando che l'ha prodotta o la pagina della documentazione SAP.

## Controllo

- ogni servizio del modello compilato è nella sezione 2, con il file OpenAPI o EDMX generato;
- ogni role collection o ruolo del codice è nella sezione 3;
- nessun segreto nel documento: `git diff --cached docs/ | grep -iE 'secret|password|clientsecret|token' ` non trova
  niente.

Chiudi con l'elenco di quello che non hai potuto verificare (per esempio un sistema non raggiungibile), per il passo
`TECH_DOCS` del playbook.
