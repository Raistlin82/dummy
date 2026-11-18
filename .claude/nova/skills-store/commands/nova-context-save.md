---
description: Aggiorna CONTEXT.md con lo stato della sessione — cronologia, correzioni, decisioni, stato di test e deploy, rinvii — senza riscrivere il passato. Nel repository di uno sviluppo NOVA si allinea al playbook.
argument-hint: "[nota libera sulla fase appena chiusa]"
---

Aggiorna `CONTEXT.md` (alla radice del repository) con lo stato corrente della sessione. `CONTEXT.md` è il file vivo
che conserva il contesto fra una sessione e l'altra; `CLAUDE.md` contiene solo regole durevoli. Lo stato sta qui.

Comando generico del toolkit NOVA, derivato da `context-save` di un prodotto CAP + Fiori elements.

## Argomento: $ARGUMENTS

Una nota libera, facoltativa: se c'è, è la descrizione sintetica della fase appena chiusa nella cronologia.

- `/nova-context-save` → ricava le novità da diff, commit e passi del playbook della sessione;
- `/nova-context-save correzione del filtro per società + test` → usa la nota come titolo della fase.

## Contesto — Fase 0, sempre

1. **Lo sviluppo NOVA**, se il repository ha `.claude/nova/skills.manifest.json`: titolo e profilo dello sviluppo, e
   lo stato del playbook (`node .claude/nova/install.mjs status`). Lo stato dei passi vive in
   `.claude/nova/progress.json`: in `CONTEXT.md` non si ricopia, si cita (passo corrente, passi chiusi nella sessione,
   deviazioni).
2. **La sessione**:
   ```bash
   git log --since="$(git log -1 --format=%cI -- CONTEXT.md 2>/dev/null || echo '1 day ago')" --oneline
   git diff --stat HEAD
   git status --short
   ```
3. **`CONTEXT.md`**, per vedere le sezioni che ha e l'ultima riga con la data (`Ultimo aggiornamento: …`).

## Struttura

Se il file ha già una sua struttura, si rispetta. Se non esiste, **chiedi** all'utente se crearlo, a scelta (*Crea CONTEXT.md* · *Non crearlo*); con il suo sì,
parti da queste sezioni:

1. **Sviluppo**: titolo, tipologia, target e release; passo corrente del playbook.
2. **Cronologia**: una fase per sessione, in coda, con data e sintesi.
3. **Correzioni**: che cosa, dove (`file:riga`), perché, con la gravità (P1/P2/P3) quando viene da un audit.
4. **Decisioni**: architetturali e di prodotto, con chi le ha prese.
5. **Stato del sistema**: test, build, deploy, con i numeri misurati e il comando che li ha dati.
6. **File creati o modificati** in modo significativo.
7. **Commit** della sessione.
8. **Rinvii e backlog**: voci aperte, e quelle chiuse barrate con la nota della fase che le ha chiuse.
9. **Domande aperte** per l'utente o per il referente funzionale.

## Procedura

1. Individua le novità della sessione: fasi, correzioni, file, commit, cambi di stato di test e deploy, voci di
   backlog aperte o chiuse, decisioni.
2. Applica **modifiche mirate** con `Edit`, senza riscrivere il file: in coda alle sezioni storiche, al loro posto
   nelle sezioni di stato. Aggiorna i numeri che sono cambiati (test, entità, app), rimisurandoli.
3. Marca i rinvii risolti con `~~…~~` e la nota della fase che li ha chiusi.
4. Aggiorna la data finale con una nota breve sulla fase chiusa.
5. **Non committare**: decide l'utente.
6. Riporta in al massimo cinque punti che cosa hai aggiunto o cambiato.

## Regole

- **Solo in coda** sulle sezioni storiche (cronologia, commit, file): il passato non si riscrive.
- **Al loro posto** sulle sezioni di stato (stato del sistema, rinvii).
- **Gerarchia**: regole durevoli in `CLAUDE.md`, stato in `CONTEXT.md`, stato dei passi nel playbook. Una regola nuova
  che trovi in `CONTEXT.md` e dovrebbe diventare durevole la proponi all'utente, non la sposti da solo.
- Un numero di `CONTEXT.md` si scrive solo se l'hai misurato in questa sessione, con il comando accanto.
- Niente emoji; tabelle dove servono; `file:riga` per navigare.
