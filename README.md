# OpenAppO — Describe it. Build it. Use it.

> **The AI-powered mobile app factory that runs inside your phone.**
> Type a sentence. Get a fully functional app. No code. No waiting.

---

## What is OpenAppO?

OpenAppO is a **meta-app**: a single mobile application that generates, installs, and runs other apps on demand — all from a natural language prompt.

You describe what you want. An AI builds it in real time. The result is a native, interactive module that lives inside OpenAppO and has access to your camera, microphone, GPS, sensors, file storage, and more.

No web view. No server rendering. Real native UI, running locally on your device.

```
"Create an audio recorder that plays back what I recorded"
                        ↓
         AI generates JSON + JavaScript
                        ↓
     OpenAppO validates, compiles, and runs it
                        ↓
         A real app. On your phone. In seconds.
```

---

## Why it's different

| Feature | OpenAppO | Typical AI app builders |
|---|---|---|
| Runs 100% on-device | ✅ | ❌ (server-rendered) |
| Access to native hardware | ✅ | ❌ |
| No new APK to install | ✅ | ❌ |
| Modules talk to each other | ✅ | ❌ |
| Works with local LLMs (Ollama) | ✅ | ❌ |
| Open source | ✅ | ❌ |

---

## What modules can do

Every generated module gets access to a rich, sandboxed API:

| Capability | API |
|---|---|
| Camera & photos | `api.camera.takePhoto()` |
| Audio recording & playback | `api.audioRecorder` / `api.audioPlayer` |
| GPS & location | `api.location.getCurrentPosition()` |
| Device sensors | `api.sensors.getAccelerometer()` … |
| Persistent file storage | `api.files.save(key, uri)` |
| Key-value storage | `api.storage.save / load / list` |
| Push & local notifications | `api.notifications.schedule()` |
| Text-to-speech | `api.tts.speak()` |
| Haptic feedback | `api.haptics.impact()` |
| Clipboard | `api.clipboard.set / get` |
| Share sheet | `api.share.text / file` |
| QR / barcode scanner | `api.qrScanner.scan()` |
| Torch / flashlight | `api.torch.setEnabled()` |
| HTTP fetch | `api.network.fetch()` |
| Phone / SMS / email | `api.linking.dialPhone / sendSms / composeEmail` |
| **Call other modules** | `api.modules.run(id, action, input)` |

All capabilities are **permission-gated**: the user sees exactly what a module wants to access before it runs.

---

## Module-to-module communication

The killer feature: modules can call each other like functions.

```js
// Inside any module's action
const result = await api.modules.run("calculate-tax", "compute", { amount: 100 });
// → { total: 122, tax: 22 }
```

This enables **pipelines**: snap a photo → analyse it → save the result → send a notification. Each step is a separate module, composable at runtime without writing a single line of integration code.

---

## Tech stack

- **React Native + Expo SDK 54** — runs on iOS, Android, and web
- **Expo Router v6** — file-based navigation
- **Hermes JS engine** — fast, lightweight JS sandbox for module execution
- **Zod v4** — strict schema validation of every AI-generated module
- **AsyncStorage + expo-file-system** — persistent module storage
- **Ollama / OpenAI-compatible APIs** — bring your own LLM

---

## Getting started

```bash
git clone https://github.com/your-username/openappo
cd openappo
npm install
npx expo start
```

Scan the QR code with **Expo Go** or run `npx expo run:android` for a full development build.

### Use a local LLM (recommended)

1. Install [Ollama](https://ollama.com) and pull a model:
   ```bash
   ollama pull gemma3:4b
   ```
2. In the app: disable mock, select **Ollama**, set the URL to your machine's local IP (e.g. `http://192.168.1.20:11434`).
3. Copy `.env.example` → `.env` and set `EXPO_PUBLIC_OLLAMA_URL` and `EXPO_PUBLIC_OLLAMA_MODEL`.

### Use OpenAI or any compatible API

Set your provider to **OpenAI** in settings and enter your API endpoint.

---

## How a module looks

Every module is a single JSON object: a manifest, a declarative UI tree, and a JavaScript logic string. The AI generates all three at once.

```json
{
  "manifest": {
    "id": "voice-notes",
    "name": "Voice Notes",
    "version": "1.0.0",
    "runtime": "javascript",
    "permissions": ["audioRecorder", "storage"]
  },
  "ui": {
    "type": "screen",
    "title": "Voice Notes",
    "components": [
      { "type": "text", "bind": "status", "text": "Ready" },
      { "type": "button", "id": "rec", "text": "Record", "action": "startRec" },
      { "type": "button", "id": "stop", "text": "Stop & Save", "action": "stopRec" },
      { "type": "button", "id": "play", "text": "Play Last", "action": "playLast" }
    ]
  },
  "code": "module.exports = { actions: { ... } };"
}
```

---

## Security model

OpenAppO runs AI-generated code, so every layer has explicit safeguards:

- **Static scan** — `eval`, `Function`, `require`, `import`, `process`, and other dangerous patterns are blocked before saving
- **Permission gate** — users see a native consent screen before any module accesses hardware
- **Capability sandbox** — modules can only call APIs explicitly declared in their manifest
- **Action timeout** — every action is killed after 8 seconds
- **Result validation** — action return values must be JSON-serializable
- **Module depth limit** — cross-module calls are capped at 3 levels to prevent infinite recursion

> **Note:** `new Function` is not a VM-level sandbox. For production deployments handling untrusted content, consider signed bytecode or a restricted interpreter.

---

## Project structure

```
app/               Expo Router screens (tabs + module runner)
src/
  ai/              LLM client, system prompt, mock generator
  capabilities/    motherApi — all native capabilities
  modules/         store, validator, runner (compile + execute)
  renderer/        JSON UI → React Native components
  security/        static code scanner, permission helpers
  types/           Zod schemas + TypeScript types
examples/          Ready-to-import module JSON files
```

---

## Roadmap

- [ ] AI Vision — `api.ai.describe(photoUri)` sends a photo to the LLM and returns structured data
- [ ] SQLite — real relational database for complex data modules
- [ ] Biometric auth — Face ID / fingerprint gate per module
- [ ] Scheduler — run module actions on a cron schedule in the background
- [ ] Charts — native chart component in the declarative UI tree
- [ ] Module marketplace — share and import modules from a community registry

---

## Contributing

PRs, issues, and module examples are all welcome.  
If you build something cool with OpenAppO, open a PR to add it to `examples/`.

---

## License

MIT
