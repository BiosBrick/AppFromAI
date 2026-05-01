# GenApp — Prompt di contesto per l’AI

Documento di riferimento: cos’è l’app, cosa deve fare, caratteristiche tecniche e **contratto** del JSON che ogni modello deve rispettare quando genera un modulo. Puoi incollarlo in chat con un altro LLM, usarlo in system prompt esterni, o allegarlo a issue e PR.

---

## 1. Cos’è GenApp

**GenApp** è un’app madre **React Native + Expo + TypeScript** che:

1. Riceve una **descrizione in linguaggio naturale** (es. «crea una calcolatrice»).
2. Chiama un **provider AI** (Ollama in locale, API OpenAI-compatibile, oppure **mock** offline).
3. Si aspetta in risposta **un solo oggetto JSON** che descrive un **modulo**: metadati, interfaccia dichiarativa, e piccole funzioni JavaScript.
4. **Valida** la risposta (schema Zod + scanner di sicurezza sul codice).
5. **Salva** il modulo in locale (**AsyncStorage**).
6. **Esegue** il modulo nella stessa app: UI costruita dal JSON, logica tramite `module.exports` + `new Function` nell’host, con **API controllata** (`motherApi`), **permessi** dichiarati nel manifest e **gate** di consenso utente.

Non genera APK separati: tutto gira **dentro GenApp**.

---

## 2. Cosa deve fare l’app (funzionalità utente)

| Area | Comportamento |
|------|----------------|
| **Home** | Prompt testuale, scelta provider (Ollama / OpenAI URL), URL e modello Ollama, switch mock. Pulsante **Genera modulo**. Lista moduli salvati, apertura modulo, eliminazione. |
| **Generazione** | Invio del prompt (con istruzioni formato JSON **prima** e richiesta utente **dopo**, vedi `src/ai/modulePrompt.ts`). Parsing JSON, validazione, salvataggio. In caso di errore, messaggio + promemoria formato JSON in UI. |
| **Modulo** | Caricamento da store, **schermata permessi** se il manifest richiede capability, poi **renderer dinamico** (JSON UI → componenti React Native). |
| **Azioni UI** | I pulsanti chiamano per nome funzioni in `actions`; ogni azione riceve `motherApi`, `input`, `state` e deve restituire un **oggetto** (patch di stato) **JSON-serializzabile**, entro **timeout** (default ~8s). |
| **Sicurezza** | Nessun `eval`/`require`/`import` arbitrario nel `code`; rete moduli opzionale e disabilitata di default; log diagnostici `[GenApp]` in Metro. |

---

## 3. Caratteristiche tecniche

- **Stack**: Expo SDK ~54, Expo Router, Hermes, Zod.
- **Moduli**: payload con tre radici obbligatorie: **`manifest`**, **`ui`**, **`code`** (`code` è sempre una **stringa** che contiene il sorgente JS).
- **Runtime codice**: solo **JavaScript** eseguibile da Hermes (niente TypeScript nei parametri delle action: niente `: MotherApi`, `: any`, `Record<...>`, ecc.).
- **UI**: albero di nodi tipizzati (`screen`, `text`, `input`, `textarea`, `button`, `list`, `card`, `image`, `audioRecorder`, `qrScanner`, …). Legame stato tramite **`bind`** dove previsto.
- **Permessi manifest**: `camera`, `audioRecorder`, `qrScanner`, `torch`, `location`, `sensors`, `linking`, `storage`, `network`, `notifications` — usati sia per il gate UX sia per abilitare le relative API su `motherApi`.
- **Ollama**: `POST /api/chat`, `format: "json"`, timeout lungo; su dispositivo reale serve IP del PC o `10.0.2.2` per emulatore Android.
- **Rete moduli**: `api.network.fetch` solo se variabile ambiente **`EXPO_PUBLIC_ENABLE_MODULE_NETWORK=true`**.
- **Notifiche**: `expo-notifications` caricato in modo lazy; su web o ambienti senza modulo nativo le schedule possono fallire con messaggio chiaro.
- **Esempi**: cartella `examples/` con JSON di riferimento.

---

## 4. Contratto JSON per la generazione (obbligatorio)

L’AI deve rispondere con **un solo JSON valido**, senza markdown, senza testo prima o dopo.

### 4.1 `manifest`

- **`id`**: stringa minuscola, pattern tipo `[a-z0-9][a-z0-9_-]*`.
- **`name`**, **`version`** (semver tipo `1.0.0`).
- **`runtime`**: esattamente `"javascript"`.
- **`permissions`**: array di valori ammessi: `camera`, `audioRecorder`, `qrScanner`, `torch`, `location`, `sensors`, `linking`, `storage`, `network`, `notifications` (solo se servono).
- **`entry`**: `"logic.js"`, **`ui`**: `"ui.json"` (placeholder documentali).

### 4.2 `ui`

- Radice: `{ "type": "screen", "title": "...", "components": [ ... ] }`.
- Ogni **button**: `id`, `text`, **`action`** (nome della funzione in `actions`).
- **input** / **textarea**: `id`, **`bind`**, eventuali `placeholder`, `keyboardType` dove supportato.
- **text** con stato: `bind` + testo iniziale opzionale.
- **list**, **image**: `bind`, ecc.

### 4.3 `code` (stringa)

Forma obbligatoria:

```text
module.exports = { actions: { async nomeAction(api, input, state) { ... return { chiaveStato: valore }; } } };
```

Regole importanti:

- Parametri sempre **`(api, input, state)`** senza annotazioni TypeScript.
- Virgolette **dentro** la stringa `code` devono essere **escape** come `\"` nel JSON esterno, oppure `code` compatto su una riga con escape corretto.
- Graffe/parentesi **bilanciate**.
- Dopo un ramo `if (...) { return ...; }` se serve un altro `return`, usare sempre **`else { return ...; }`**, mai `} return ...` subito dopo (sintassi non valida in Hermes).
- **Vietato** nel sorgente modulo: `eval`, `Function`, `require`, `import`, `process`, `global`, uso diretto di `Linking.` (usare `api.linking`).
- **Consentito** (e solo così, oltre al JS standard):  
  `api.camera`, `api.audioRecorder`, `api.qrScanner`, `api.torch`, `api.location`, `api.sensors`, `api.linking`, `api.storage`, `api.network`, `api.notifications` — solo se il manifest dichiara il permesso corrispondente e l’utente ha accettato.

### 4.4 Esempio minimale (struttura)

```json
{
  "manifest": {
    "id": "esempio-modulo",
    "name": "Esempio",
    "version": "1.0.0",
    "runtime": "javascript",
    "permissions": [],
    "entry": "logic.js",
    "ui": "ui.json"
  },
  "ui": {
    "type": "screen",
    "title": "Esempio",
    "components": [
      { "type": "text", "id": "t", "text": "0", "bind": "display" },
      { "type": "button", "id": "b", "text": "+1", "action": "inc" }
    ]
  },
  "code": "module.exports = { actions: { async inc(api, input, state) { const n = parseFloat(String(state.display||0))||0; return { display: String(n+1) }; } } };"
}
```

---

## 5. `motherApi` (API esposta ai moduli)

Solo dopo permesso manifest + consenso utente:

| API | Uso sintetico |
|-----|----------------|
| `api.camera` | `takePhoto()` → `{ uri, width?, height? }` o `null`. |
| `api.audioRecorder` | `start()` / `stop()` → URI e durata opzionale. |
| `api.qrScanner` | `scan()` → stringa letta o `null`. |
| `api.torch` | `setEnabled(on)` — torcia LED. |
| `api.location` | `getCurrentPosition()` → latitudine, longitudine, accuratezza e timestamp. |
| `api.sensors` | `getAccelerometer`, `getGyroscope`, `getMagnetometer`, `getBarometer`, `getLight` → un campione sensore. |
| `api.linking` | `openUrl`, `composeEmail`, `dialPhone`, `sendSms` (mailto/tel/sms). |
| `api.storage` | `save` / `load` / `list` / `delete` — chiavi isolate per modulo. |
| `api.network` | `fetch` — solo se abilitato a livello app. |
| `api.notifications` | `schedule(title, body, secondsFromNow)` — notifica locale. |

---

## 6. Limiti e note per chi scrive prompt

- La **sandbox non è forte**: il codice gira nello stesso JS engine dell’app; la difesa è validazione + API ristrette + timeout.
- **Expo Go** vs **development build**: alcune capability (notifiche, hardware) sono più affidabili su build dedicate.
- Per **rigenerare** un modulo: eliminarlo dalla lista e generare di nuovo con un prompt più preciso, eventualmente incollando questo file o la sezione §4.

---

## 7. Allineamento con il codice

- Prompt costruito a runtime: **`src/ai/modulePrompt.ts`** (`buildModuleGenerationPrompt`, `JSON_RESPONSE_RULES_IT`).
- Schema e permessi: **`src/types/generatedModule.ts`**.
- Tipi API: **`src/capabilities/types.ts`**.

*Ultimo aggiornamento: coerente con GenApp MVP (moduli JSON + JS host-side).*
