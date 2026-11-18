# Il metodo

Questo file non parla di SAP. Parla di come si scrive un audit che produce misure
invece di opinioni, e di come si evita che un controllo diventi cerimonia.

Vale per qualsiasi comando generato da questa cartella. Il generatore lo cita in
testa a ogni comando che scrive; se lo leggi una volta sola, leggi questo.

---

## 1. Le quattro trappole di verifica

Sono classi di errore misurate su un prodotto reale, non ipotesi. Ognuna è
sopravvissuta a un audit che si dichiarava completo.

**1. Il gate verde non è una prova.** Un linter può essere verde 9 progetti su 9
con finding gravi sotto: vede i simboli del framework e **non** i pattern del
namespace applicativo. Prima di citare un gate come evidenza, chiedi *cosa*
misura, non *se* passa.

**2. Il validatore che passa non valida ciò che credi.** Un validatore di schema
dice che il file è conforme allo schema — non che i suoi valori abbiano senso nel
framework che li consuma. Su un prodotto reale, nove manifest `isValid: true` contenevano una
proprietà che nel framework di destinazione **non esiste**: ventinove stati vuoti
contati come implementati non arrivavano all'utente.

**3. Il layer dichiarativo non è il layer attivo.** Un'annotazione di
autorizzazione che il runtime non applica su un certo percorso è documentazione,
non un controllo. Un marcatore documentato in tre posti e assente dalla `SELECT`
del resolver non esiste. **Per ogni controllo che dichiari conforme, di' quale
funzione lo applica e con quale query.**

**4. Un test che non diventa rosso quando il guard sparisce non prova nulla.**
Si valida neutralizzando il guard e verificando **quali** test diventano rossi.
Se non ne diventa rosso nessuno, il test misurava altro.

---

## 2. Derivare, invertire, cablare — mai una lista scritta a mano

Una lista di nomi mantenuta a mano **diverge**. Non "può divergere": diverge, e i
casi misurati su un solo prodotto sono cinque, tutti con impatto reale — da
un'allowlist che cancellava 40 file di configurazione dall'immagine di produzione,
a una lista di entità che lasciava quattro entità fuori dallo scope aziendale.

In ordine di preferenza:

1. **Derivare.** L'insieme si calcola dalla fonte: `GLOBALI = TUTTE − SCOPATE`, le
   app si scoprono da `git ls-files`, i conteggi li misura uno script.
2. **Invertire.** Se non puoi derivare, trasforma l'allowlist in **denylist**, così
   l'elemento dimenticato cade nel caso *sicuro* e non in quello permissivo.
3. **Cablare un gate** che confronti la lista con la sua fonte e fallisca sul delta
   **in entrambe le direzioni** — perché una lista che contiene voci morte mente
   quanto una che ne omette di vive.

Corollario: **un warning non è un gate.** Quando dichiari warn-only un controllo,
di' quale ramo esce con quale codice di uscita.

---

## 3. La prova di sensibilità

Ogni gate deve dimostrare di diventare rosso. Il rilevatore si esegue **due
volte**: sul caso sano deve dare zero riscontri, sul caso col difetto — costruito
nel test, non letto dal repository — almeno uno, **e il testo del riscontro deve
combaciare** con ciò che ci si aspetta.

Il vincolo sul testo atteso è la parte che conta: senza, un rilevatore che segnala
una violazione *qualsiasi* passerebbe la prova pur essendo cieco su quella cercata.

E la prova va scritta **anche nel verso opposto**, dove esiste: un gate che scatta
su un caso legittimo è rumore, e il rumore si disattiva in blocco al primo giro.
Quello è il quinto modo di perdere un gate, dopo le quattro trappole.

---

## 4. Un gate va misurato dove gira davvero

Non dove lo scrivi. Una suite può essere verde sulla macchina di chi la lancia e
rossa in CI per ragioni che non hanno niente a che vedere col codice: una sintassi
di `mktemp` diversa fra GNU e BSD, un file generato che sta in `.gitignore` e che
nessuno step ricrea, un tetto di heap impostato a mano in locale e assente in CI.

Prima di dichiarare verde un gate: eseguirlo su un clone pulito della piattaforma
su cui girerà. E un ramo «check saltato» che nell'ambiente reale è l'**unico**
imboccato non è un check.

---

## 5. Verificare prima di correggere

Su un Round misurato, **un finding CRITICAL su tre era allucinato**. Nessuna
correzione senza aver letto il codice reale.

La regola ha un secondo tempo, meno ovvio e più utile: quando rimisuri, aspettati
che i finding cambino **in entrambe le direzioni**. Su sei letture rimisurate, tre
erano più gravi del riportato e tre meno gravi o false. Un audit che chiude i
propri finding senza rimisurarli si crede sulla parola.

---

## 6. Correzioni parallele solo su file disgiunti

Raggruppa per **proprietario del file**, non per tema. Due agenti sullo stesso
file si sovrascrivono in silenzio, e il secondo non se ne accorge.

---

## 7. Lo strumento assente va dichiarato

Se una skill, un MCP o un browser non è disponibile, scrivilo: `TOOL UNAVAILABLE`,
con l'impatto sulla completezza. **Il silenzio si legge come «verificato e a
posto»**, ed è il modo più economico di trasformare un audit in una bugia.

Corollario sulla forma dell'esito: se un controllo non è verificabile, il suo
stato è `NON VERIFICATO`, che è una terza cosa rispetto a `PASSA` e `FALLISCE`.
Un rapporto con solo due esiti costringe a mentire su metà dei casi.

---

## 8. Il rapporto è immutabile, il registro no

Ogni run produce un rapporto datato che **non si riscrive**: i finding non si
cancellano. Ciò che cambia è lo **stato** nel registro dei pendenti — `Chiuso`,
`Ancora aperto`, `Parzialmente corretto`, `Superato`, `Rinviato` — con l'evidenza
accanto.

Quando un run successivo corregge una lettura di un run precedente, la correzione
va **in coda al rapporto vecchio**, non al posto della riga sbagliata: chi rilegge
deve poter vedere che cosa si credeva allora e perché non era vero.

---

## 9. Come si scrive un finding

Un finding utile ha cinque parti e nessuna è decorativa:

```
[GRAVITÀ] ID — titolo in una riga
- Dove:      file:riga (cliccabile), o il comando che l'ha prodotto
- Impatto:   che cosa succede a un utente o a un dato, non «è una cattiva pratica»
- Evidenza:  l'output, il numero, la riga. Non «si nota che»
- Azione:    che cosa va cambiato, e dove
- Quick win: sì/no — è correggibile subito senza decisioni di prodotto?
```

Due proprietà da pretendere:

- **L'impatto è sul dominio, non sullo stile.** «Manca un indice» non è un finding;
  «la query che precede l'aggiornamento non prende il lock, quindi due approvazioni
  concorrenti ne perdono una» lo è.
- **Un dato sbagliato pesa più di un dato assente.** Un valore errato che arriva a
  valle costa una rettifica; un valore mancante costa un errore visibile.

---

## 10. Il costo dichiarato

Alla fine di un run, di' quanto è costato: tempo per fase, che cosa non è stato
eseguito e perché. Un audit senza costo dichiarato non è ripetibile, e un audit
non ripetibile non è una misura.
