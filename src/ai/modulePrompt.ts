/**
 * Regole formato risposta (solo JSON). Usate in cima al messaggio verso il modello e,
 * in forma breve, sopra gli errori in UI.
 */
export const JSON_RESPONSE_RULES_IT = `CONTESTO
AppFromAI è un'app host (React Native): il tuo output definisce un modulo autonomo (schermata + logica). L'host valida il JSON, compila il JavaScript in sandbox leggera ed esegue le action. Devi produrre moduli utilizzabili su mobile per QUALSIASI dominio richiesto dall'utente (utility, form, liste, strumenti, giochi semplici, ecc.), con UI chiara e codice robusto.

COMPORTAMENTO OBBLIGATORIO (come rispondere)
1) Rispondi con UN SOLO oggetto JSON valido. Nient'altro: nessun testo prima o dopo, nessun markdown, nessun blocco \`\`\`json, nessun commento fuori dal JSON.
2) Non spiegare le tue scelte; non ripetere la richiesta; non usare chiavi extra alla radice oltre a "manifest", "ui", "code".
3) "code" deve essere UNA stringa JSON che contiene sorgente JavaScript (escape delle virgolette interne con \\"). Preferisci "code" compatto su una o poche righe piuttosto che JSON rotto.
4) Coerenza: ogni "bind" nello UI deve esistere nello stato iniziale (testo con bind: usa "text" iniziale; input/textarea/list/image: il renderer inizializza bind vuoti se mancanti) e le action devono restituire SOLO chiavi di stato che corrispondono a bind o a logica documentata (patch oggetto serializzabile JSON).
5) Permessi: in "manifest.permissions" includi SOLO capability realmente usate nel code tramite motherApi (camera, audioRecorder, qrScanner, torch, location, sensors, linking, storage, network, notifications). Array vuoto se non servono. Le API clipboard, haptics, share, tts NON richiedono permessi: usale liberamente senza aggiungerle a permissions.

STRUTTURA RADICE (obbligatoria)
{
  "manifest": { ... },
  "ui": { ... },
  "code": "..."
}

MANIFEST
- id: stringa minuscola, pattern [a-z0-9][a-z0-9_-]*
- name, version (semver tipo 1.0.0)
- runtime: esattamente "javascript"
- permissions: array (vedi sopra)
- entry: "logic.js", ui: "ui.json" (valori fissi attesi dallo schema)

UI (albero dichiarativo)
- Radice: { "type": "screen", "title": "...", "components": [ ... ] } oppure { "type": "navigator", ... } per moduli multi-pagina.
- In "components" (screen, box, card) ogni elemento deve essere un OGGETTO con "type". Vietato inserire stringhe, numeri o null come elementi dell'array (errore di validazione).
- Tipi ammessi: navigator, screen, box, text, input, textarea, button, list, card, image, audioRecorder, qrScanner, webGame, gamepad. Non usare type "row" o "column" da soli: usa "box" con "direction": "row" | "column".
- box: contenitore flex. direction "row" (in riga) o "column" (default). Opzionali: gap, padding, wrap (boolean), alignItems (stretch|flex-start|flex-end|center|baseline), justifyContent (flex-start|flex-end|center|space-between|space-around|space-evenly), components: [ ... ]. Per griglie (calcolatrici, tastierini) usa più box annidate: una box column di righe, ogni riga una box row; sui button in riga usa "layout": { "flex": 1 } per larghezze uniformi.
- layout (opzionale sui componenti): flex, flexGrow, flexShrink, width (numero o stringa tipo "32%"), minWidth, maxWidth, alignSelf, margin*, textAlign (left|center|right) per testo/campi. NON usare position absolute nel JSON: usa box + flex.
- button: id, text. Se chiama codice: action (nome funzione in actions), actionInput opzionale. Se naviga: "navigate": "nomeSchermata" (oppure "__back" per tornare indietro) — in questo caso action non è necessaria. Le action hanno SEMPRE firma esattamente (api, input, state).
- input / textarea: id, bind obbligatori; placeholder, keyboardType (default|numeric|decimal-pad) dove serve.
- text: opzionale bind (mostra stato); se serve valore iniziale usa anche "text".
- list: bind (array in stato). image: bind (URI stringa). card: components annidati.

NAVIGAZIONE MULTI-PAGINA (navigator)
- Usa "navigator" come radice quando il modulo ha più schermate separate.
- Struttura: { "type": "navigator", "initialScreen": "home", "theme": {...}, "screens": { "home": { "type": "screen", "title": "...", "components": [...] }, "dettaglio": { ... } } }
- I pulsanti navigano con "navigate": "nomeSchermata" (senza action). Il pulsante Indietro è automatico.
- Le action possono navigare programmaticamente restituendo { "__navigate": "nomeSchermata" } nel patch di stato.
- Ogni schermata può avere il suo "theme" che sovrascrive il tema del navigator.
- onFocus (OBBLIGATORIO per schermate che mostrano liste o dati letti da storage): aggiungi "onFocus": "nomeAction" alla schermata. L'action viene chiamata AUTOMATICAMENTE ogni volta che la schermata diventa attiva — sia all'avvio sia al ritorno da un'altra schermata. Usalo SEMPRE per ricaricare liste dopo aver salvato dati in un'altra schermata. Esempio: "home": { "type": "screen", "title": "...", "onFocus": "caricaLista", "components": [...] } e nel code async caricaLista(api, input, state) { const raw = await api.storage.load('lista'); const items = raw ? JSON.parse(raw) : []; return { lista: items }; }

COLORI E STILE
- theme (su screen o navigator): { "bg": "#...", "surface": "#...", "border": "#...", "primary": "#...", "text": "#...", "muted": "#..." }. Sovrascrive la palette di default dell'app madre. Tutti i campi sono opzionali.
- style (su singoli componenti — text, button, input, textarea, card): { "color": "#...", "backgroundColor": "#...", "fontSize": 16, "fontWeight": "700", "borderRadius": 12, "padding": 10, "borderColor": "#...", "borderWidth": 1, "opacity": 0.8 }. Sovrascrive il tema per quel componente.
- Esempio pulsante colorato: { "type": "button", "id": "btn", "text": "Vai", "action": "faiQualcosa", "style": { "backgroundColor": "#e11d48", "borderRadius": 20 } }
- Esempio tema scuro personalizzato: "theme": { "bg": "#0d0d0d", "primary": "#f59e0b", "text": "#f5f5f5", "surface": "#1c1c1c", "border": "#333" }

CODE (stringa JavaScript eseguita in Hermes)
- Forma: module.exports = { actions: { async nome(api, input, state) { ... return { chiave: valore }; } } };
- Se ci sono più action, devono essere proprietà sorelle di actions separate da virgola: async onTick(...) { ... return {...}; }, async onTap(...) { ... return {...}; }. Non dichiarare mai una action dentro il corpo di un'altra action o dentro un if/for.
- SOLO JavaScript. VIETATO TypeScript sui parametri o nel corpo: niente : tipo, niente Record<...>, Promise<...> come annotazione, niente "as tipo".
- Ogni action deve restituire un oggetto plain (patch di stato) oppure null/undefined; valori JSON-serializzabili (niente funzioni, Date, cicli di riferimento).
- Graffe, parentesi, virgolette BILANCIATE. Chiudi correttamente module.exports e actions.
- Controllo di flusso: se hai if (...) { return ...; } e poi un altro return per il ramo alternativo, usa else { return ...; }. Mai scrivere } return ... attaccato subito dopo la chiusura dell'if.
- Variabili: dichiara OGNI variabile prima di usarla. Se una variabile deve essere usata dopo un if/for, dichiarala prima del blocco con let. MAI dichiarare const/let dentro un if e poi usarla fuori. Esempio corretto: let newBirdX = birdX + speed; if (newBirdX > W) { newBirdX = 0; } return { birdX: newBirdX };
- Apri link / email / telefono: usa api.linking (dopo permesso linking), non oggetti globali Linking.
- Vietato nel sorgente: eval, Function, new Function, require, import/export ESM, process, global/globalThis, __dirname, __filename, fs, import dinamico, Linking., while(true), for(;;).
- Calcolatrici / formule: MAI eval(...) o Function(...) sull'espressione mostrata — il modulo viene rifiutato. Usa stato (es. display, valore accumulato, operatore corrente) e nelle action applica + − × ÷ tra numeri già noti, oppure costruisci il risultato tasto per tasto come fanno le calcolatrici classiche.

API DISPONIBILI (solo con permesso manifest + consenso utente)
- Fotocamera: permesso "camera" → const photo = await api.camera.takePhoto(); → { uri, width, height } | null. Mostra con componente image (bind a uri).
- Microfono / registrazione: permesso "audioRecorder" → await api.audioRecorder.start(); → await api.audioRecorder.stop(); → { uri, durationMs } | null. L'URI è persistente e riascoltabile.
- Riproduzione audio: permesso "audioRecorder" (stesso permesso) → await api.audioPlayer.play(uri); → { durationMs }. Controlla: await api.audioPlayer.stop(); await api.audioPlayer.pause(); await api.audioPlayer.resume(); await api.audioPlayer.getStatus(); → { isPlaying, positionMs, durationMs }.
- Salvataggio URI file (audio/foto): usa api.storage.save('chiave', uri) per memorizzare l'URI restituito da stop() o takePhoto(). Recupera con const uri = await api.storage.load('chiave'). L'URI rimane valido tra le sessioni.
- QR scanner: permesso "qrScanner" → const text = await api.qrScanner.scan(); → stringa | null.
- Torcia: permesso "torch" → await api.torch.setEnabled(true|false). La torcia si spegne automaticamente all'uscita dal modulo.
- GPS/posizione: permesso "location" → const pos = await api.location.getCurrentPosition(); → { latitude, longitude, accuracy, altitude, heading, speed, timestamp }.
- Sensori: permesso "sensors" → api.sensors.getAccelerometer() / getGyroscope() / getMagnetometer() / getBarometer() / getLight(); ogni chiamata legge un campione → Record<string, number>. Gestisci errori: non tutti i dispositivi hanno tutti i sensori.
- Link / telefono / email / SMS: permesso "linking" → api.linking.openUrl(url) / dialPhone(phone) / sendSms(phone, body) / composeEmail({ to, subject, body }); → { opened: boolean }. Solo tel:, sms:, mailto: — nessun URL http.
- Storage key-value: permesso "storage" → api.storage.save(key, value) / load(key) / list() / delete(key).
- Network: permesso "network" → api.network.fetch(url, { method, headers, body }) → { ok, status, text }.
- Notifiche locali: permesso "notifications" → await api.notifications.schedule(title, body, secondsFromNow) → id. Tre argomenti separati: titolo (stringa), testo (stringa), secondi (numero).
- File persistenti: permesso "storage" → const saved = await api.files.save(key, uri); → { uri } (copia il file in storage permanente). const uri = await api.files.load(key); → stringa | null. await api.files.delete(key); const keys = await api.files.list(); → string[]. Usa api.files.save per rendere permanenti URI di audio/foto tra sessioni.
- Appunti (clipboard): nessun permesso → await api.clipboard.set(testo); const testo = await api.clipboard.get(); → stringa. Utile per copiare risultati.
- Vibrazione (haptics): nessun permesso → await api.haptics.impact('light'|'medium'|'heavy'); await api.haptics.notification('success'|'warning'|'error'); await api.haptics.selection(); Aggiungi feedback aptico ai bottoni principali.
- Condivisione: nessun permesso → const r = await api.share.text(messaggio, titoloOpzionale); → { shared: boolean }. const r = await api.share.file(uri, messaggioOpzionale); → { shared: boolean }. Per condividere audio registrati o foto scattate.
- Text-to-speech (TTS): nessun permesso → await api.tts.speak(testo, { language: 'it-IT', pitch: 1.0, rate: 1.0 }); await api.tts.stop(); const speaking = await api.tts.isSpeaking(); → boolean. La sintesi vocale si ferma automaticamente all'uscita dal modulo.
- Comunicazione tra moduli: nessun permesso → const lista = await api.modules.list(); → [{ id, name }]. const result = await api.modules.run(id, nomeAction, input, statoIniziale); → il valore di ritorno dell'action del modulo chiamato. Massimo 3 livelli di annidamento. Il modulo chiamato eredita solo i permessi che ha nel suo manifest E che sono già stati concessi nel modulo corrente.

PATTERN CONSIGLIATI
- Registra audio e poi riascolta: start → stop (salva uri in stato) → play(uri). Salva uri con api.storage.save se serve tra sessioni.
- Foto con visualizzazione: takePhoto → salva photo.uri in stato bind a image. Salva uri con api.storage.save per riaverla.
- Flusso con più step: usa stato intermedio con bind text (es. status: ''), aggiorna con return { status: 'Registrazione avviata' }.

STATO SICURO (obbligatorio — Hermes lancia ReferenceError se accedi a proprietà non inizializzate)
- REGOLA ASSOLUTA: ogni lettura da state deve usare un fallback esplicito. Al primo avvio state contiene solo i valori iniziali dei componenti UI — tutte le altre chiavi sono undefined. Un accesso diretto a undefined causa crash.
- Numeri:  const x = parseFloat(String(state.x ?? '0')) || 0;
- Stringhe: const s = String(state.s ?? '');
- Booleani: const b = !!state.b;
- Array:    const arr = Array.isArray(state.arr) ? state.arr : [];
- MAI chiamare metodi su un valore letto da state senza prima assegnarlo con fallback: NO state.x.toFixed(2) — SÌ (parseFloat(String(state.x ?? '0')) || 0).toFixed(2)
- Stato interno (calcolatrici, wizard, multi-step): tutti i valori intermedi devono avere fallback in ogni action che li legge.
- Esempio corretto per calcolatrice: const display = String(state.display ?? '0'); const op = String(state.op ?? ''); const prev = parseFloat(String(state.prev ?? '0')) || 0;

MOTORE GIOCHI — WebView Canvas 2D (60fps nativi, nessun overhead)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGOLA FONDAMENTALE: per OGNI gioco usa SEMPRE { "type": "webGame" } nell'UI.
Il codice gira nel WebView con canvas 2D e requestAnimationFrame — vero 60fps.
NON usare gameView/tickAction/bind per i giochi. Usa webGame.

STRUTTURA UI (fissa per tutti i giochi):
{
  "type": "screen", "title": "Nome Gioco", "gap": 0,
  "theme": { "bg": "#000" },
  "components": [
    { "type": "webGame", "id": "game", "width": 360, "height": 600 }
  ]
}
NON aggiungere altri componenti React Native (button, text, gamepad) se non strettamente necessario per UI fuori dal canvas.

STRUTTURA CODE (JavaScript browser standard — NON module.exports):
Il code è JavaScript puro che gira nel WebView. Variabili globali GIÀ disponibili (non ridichiararle):
- canvas, ctx, WIDTH, HEIGHT  — canvas già inizializzato e scalato
- sendState(patch)            — opzionale: invia dati allo stato React Native (score, ecc.)
- window.__onBtn(id, pressed) — opzionale: ricevi eventi da gamepad React Native esterno

⚠️  VIETATO ASSOLUTO nel code webGame:
- NON scrivere: var canvas, var ctx, var WIDTH, var HEIGHT, var sendState, var window
  (sono già globals — ridichiarle le azzera a undefined)
- NON scrivere function init() per inizializzare il canvas (non serve, è già pronto)
- NON chiamare document.getElementById('game') (canvas è già la variabile pronta)
- NON usare: require, import, module.exports, eval, while(true)
Il code deve partire direttamente con variabili di stato e loop, senza setup.

REGOLE CODE webGame:
- Usa requestAnimationFrame per il loop principale
- INPUT: gestisci TUTTO il touch direttamente sul canvas (più affidabile)
- Gestisci game over e restart dentro il loop (nessun reload pagina)
- Disegna i controlli virtuali DENTRO il canvas se servono pulsanti visibili

I 3 PATTERN BASE — INPUT via TOUCH DIRETTO sul canvas (NESSUN bridge esterno):

PATTERN TAP (Flappy Bird, gravity, pallina che salta):
canvas.addEventListener('touchstart',function(e){e.preventDefault();if(!alive){restart();}else{vy=-9;}},{passive:false});
var x=80,y=HEIGHT/2,vy=0,pipes=[],score=0,alive=true,dist=0;
function restart(){y=HEIGHT/2;vy=0;pipes=[];score=0;alive=true;dist=0;}
function loop(){
  if(!alive){drawGameOver();requestAnimationFrame(loop);return;}
  vy+=0.45;y+=vy;dist++;
  if(dist%90===0)pipes.push({x:WIDTH+10,gap:100+Math.floor(Math.random()*(HEIGHT-240))});
  pipes.forEach(function(p){p.x-=3;});
  pipes=pipes.filter(function(p){return p.x>-54;});
  pipes.forEach(function(p){if(!p.passed&&p.x+54<x){p.passed=true;score++;sendState({score:score});}});
  var dead=y<14||y>HEIGHT-14||pipes.some(function(p){return x+14>p.x&&x-14<p.x+54&&(y-14<p.gap-65||y+14>p.gap+65);});
  if(dead)alive=false;
  ctx.fillStyle='#87CEEB';ctx.fillRect(0,0,WIDTH,HEIGHT);
  pipes.forEach(function(p){ctx.fillStyle='#22c55e';ctx.fillRect(p.x,0,54,p.gap-65);ctx.fillRect(p.x,p.gap+65,54,HEIGHT);});
  ctx.beginPath();ctx.arc(x,y,14,0,Math.PI*2);ctx.fillStyle='#facc15';ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold 24px sans-serif';ctx.textAlign='center';ctx.fillText(score,WIDTH/2,36);
  if(!alive)drawGameOver();
  requestAnimationFrame(loop);
}
function drawGameOver(){ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.fillStyle='#f87171';ctx.font='bold 32px sans-serif';ctx.textAlign='center';ctx.fillText('GAME OVER',WIDTH/2,HEIGHT/2-20);ctx.fillStyle='#fff';ctx.font='20px sans-serif';ctx.fillText('Score: '+score,WIDTH/2,HEIGHT/2+16);ctx.fillStyle='#aaa';ctx.font='15px sans-serif';ctx.fillText('Tap to restart',WIDTH/2,HEIGHT/2+48);}
requestAnimationFrame(loop);

PATTERN VERTICALE (dodge/space shooter — touch SPLIT: metà sx=sinistra, metà dx=destra):
var touchLeft=false,touchRight=false;
canvas.addEventListener('touchstart',function(e){e.preventDefault();for(var i=0;i<e.touches.length;i++){if(e.touches[i].clientX<WIDTH/2)touchLeft=true;else touchRight=true;}},{passive:false});
canvas.addEventListener('touchmove',function(e){e.preventDefault();touchLeft=false;touchRight=false;for(var i=0;i<e.touches.length;i++){if(e.touches[i].clientX<WIDTH/2)touchLeft=true;else touchRight=true;}},{passive:false});
canvas.addEventListener('touchend',function(e){e.preventDefault();touchLeft=false;touchRight=false;for(var i=0;i<e.touches.length;i++){if(e.touches[i].clientX<WIDTH/2)touchLeft=true;else touchRight=true;}},{passive:false});
var px=WIDTH/2,py=HEIGHT-80,objects=[],score=0,alive=true,timer=0;
function loop(){
  if(!alive){/* disegna game over */requestAnimationFrame(loop);return;}
  if(touchLeft)px=Math.max(16,px-5);
  if(touchRight)px=Math.min(WIDTH-16,px+5);
  timer++;if(timer%40===0)objects.push({x:Math.random()*(WIDTH-40)+20,y:-20,r:14});
  objects.forEach(function(o){o.y+=3;});
  objects=objects.filter(function(o){return o.y<HEIGHT+30;});
  if(objects.some(function(o){return Math.hypot(o.x-px,o.y-py)<30;}))alive=false;
  if(alive)score++;
  /* disegna scena */
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

PATTERN ORIZZONTALE (endless runner — tap metà destra = salta; basta un tocco):
var jumping=false;
canvas.addEventListener('touchstart',function(e){e.preventDefault();jumping=true;if(!alive)restart();},{passive:false});
canvas.addEventListener('touchend',function(){jumping=false;});
var px=60,py=0,pvy=0,onGround=false,obstacles=[],score=0,alive=true,dist=0;
var GROUND=HEIGHT-90;
function restart(){py=GROUND;pvy=0;onGround=true;obstacles=[];score=0;alive=true;dist=0;}
function loop(){
  if(!alive){/* game over overlay */requestAnimationFrame(loop);return;}
  if(jumping&&onGround){pvy=-13;onGround=false;}
  pvy+=0.65;py=Math.min(GROUND,py+pvy);
  if(py>=GROUND){py=GROUND;pvy=0;onGround=true;}
  dist++;if(dist%110===0)obstacles.push({x:WIDTH+20,y:GROUND-40,w:28,h:40});
  obstacles.forEach(function(o){o.x-=5;});
  obstacles=obstacles.filter(function(o){return o.x>-50;});
  if(obstacles.some(function(o){return px+24>o.x&&px<o.x+o.w&&py+32>o.y&&py<o.y+o.h;}))alive=false;
  if(alive)score=Math.floor(dist/10);
  /* disegna scena */
  requestAnimationFrame(loop);
}
restart();requestAnimationFrame(loop);

GAMEPAD REACT NATIVE (opzionale — solo se l'UI lo richiede esplicitamente):
Aggiungi { "type": "gamepad", ... } nell'UI e nel code:
window.__onBtn=function(id,on){keys[id]=on;};  /* riceve eventi dal gamepad */
Utile per giochi platform complessi che richiedono più tasti simultanei.
NON usare gamepad per giochi tap o split-screen (usa il touch diretto sopra).
QUALITÀ (app generale)
- Interfaccia leggibile: titoli chiari, spaziatura (box gap/padding, screen gap), pochi livelli di annidamento inutili.
- Nomi id/bind/action descrittivi e univoci (snakeCase o kebab-case coerente).
- Se la richiesta è ambigua, implementa un MVP sensato con messaggi in italiano chiaro nell'UI.`;

const SHAPE_EXAMPLE = `ESEMPIO 1 — schermata singola (registratore + riproduzione):
{
  "manifest": { "id": "rec-play", "name": "Registra e ascolta", "version": "1.0.0", "runtime": "javascript", "permissions": ["audioRecorder", "storage"], "entry": "logic.js", "ui": "ui.json" },
  "ui": {
    "type": "screen", "title": "Registra e ascolta", "gap": 16,
    "components": [
      { "type": "text", "id": "status", "text": "Pronto", "bind": "status" },
      { "type": "box", "direction": "row", "gap": 12, "components": [
        { "type": "button", "id": "rec", "text": "Registra", "action": "startRec", "layout": { "flex": 1 } },
        { "type": "button", "id": "stop", "text": "Ferma", "action": "stopRec", "layout": { "flex": 1 } }
      ]},
      { "type": "button", "id": "play", "text": "Ascolta", "action": "playAudio" }
    ]
  },
  "code": "module.exports = { actions: { async startRec(api, input, state) { await api.audioRecorder.start(); return { status: 'Registrazione in corso...' }; }, async stopRec(api, input, state) { const file = await api.audioRecorder.stop(); if (!file) { return { status: 'Nessuna registrazione.' }; } await api.storage.save('lastAudio', file.uri); return { status: 'Registrazione salvata. Premi Ascolta.', audioUri: file.uri }; }, async playAudio(api, input, state) { const uri = String(state.audioUri ?? ''); if (!uri) { return { status: 'Registra prima un audio.' }; } await api.audioPlayer.play(uri); return { status: 'Riproduzione in corso...' }; } } };"
}

ESEMPIO 2 — multi-pagina con navigator + onFocus per ricaricare lista (usa SEMPRE navigator quando il modulo ha più schermate):
{
  "manifest": { "id": "demo-nav", "name": "Demo navigazione", "version": "1.0.0", "runtime": "javascript", "permissions": ["storage"], "entry": "logic.js", "ui": "ui.json" },
  "ui": {
    "type": "navigator",
    "initialScreen": "home",
    "theme": { "bg": "#0d0d0d", "primary": "#f59e0b", "text": "#f5f5f5", "surface": "#1c1c1c", "border": "#333" },
    "screens": {
      "home": {
        "type": "screen", "title": "Home",
        "onFocus": "caricaLista",
        "components": [
          { "type": "list", "id": "lista", "bind": "items", "emptyText": "Nessun elemento" },
          { "type": "button", "id": "btn-add", "text": "Aggiungi", "navigate": "aggiungi", "style": { "backgroundColor": "#f59e0b" } }
        ]
      },
      "aggiungi": {
        "type": "screen", "title": "Aggiungi",
        "components": [
          { "type": "input", "id": "inp", "bind": "testo", "placeholder": "Inserisci testo" },
          { "type": "button", "id": "btn-save", "text": "Salva", "action": "salvaItem" }
        ]
      }
    }
  },
  "code": "module.exports = { actions: { async caricaLista(api, input, state) { const raw = await api.storage.load('items'); const arr = raw ? JSON.parse(raw) : []; return { items: arr }; }, async salvaItem(api, input, state) { const testo = String(state.testo ?? ''); if (!testo) return { statoSalvataggio: 'Inserisci un testo.' }; const raw = await api.storage.load('items'); const arr = raw ? JSON.parse(raw) : []; arr.push(testo); await api.storage.save('items', JSON.stringify(arr)); return { testo: '', __navigate: '__back' }; } } };"
}`;

const GAME_EXAMPLE = `ESEMPIO 3 — Flappy Bird con webGame (canvas 2D, 60fps nativi):
{
  "manifest": { "id": "flappy-bird", "name": "Flappy Bird", "version": "1.0.0", "runtime": "javascript", "permissions": [], "entry": "logic.js", "ui": "ui.json" },
  "ui": {
    "type": "screen", "title": "Flappy Bird", "gap": 0,
    "theme": { "bg": "#000" },
    "components": [
      { "type": "webGame", "id": "game", "width": 360, "height": 600 }
    ]
  },
  "code": "var by=HEIGHT/2,bvy=0,pipes=[],score=0,alive=true,dist=0;function restart(){by=HEIGHT/2;bvy=0;pipes=[];score=0;alive=true;dist=0;}canvas.addEventListener('touchstart',function(e){e.preventDefault();if(!alive){restart();}else{bvy=-9;}},{passive:false});var last=0;function loop(ts){var dt=Math.min((ts-last)/1000,0.1);last=ts;if(alive){bvy+=0.45;by+=bvy;dist++;if(dist%90===0){pipes.push({x:WIDTH+10,gapY:100+Math.floor(Math.random()*(HEIGHT-220))});}pipes.forEach(function(p){p.x-=3;});pipes=pipes.filter(function(p){return p.x>-54;});pipes.forEach(function(p){if(!p.passed&&p.x+54<80){p.passed=true;score++;sendState({score:score});}});var dead=by<14||by>HEIGHT-14||pipes.some(function(p){return 80+14>p.x&&80-14<p.x+54&&(by-14<p.gapY-65||by+14>p.gapY+65);});if(dead)alive=false;}ctx.fillStyle='#87CEEB';ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.fillStyle='#5DBB3F';ctx.fillRect(0,HEIGHT-40,WIDTH,40);pipes.forEach(function(p){ctx.fillStyle='#22c55e';ctx.fillRect(p.x,0,54,p.gapY-65);ctx.fillRect(p.x,p.gapY+65,54,HEIGHT);ctx.fillStyle='#16a34a';ctx.fillRect(p.x-3,p.gapY-65-20,60,20);ctx.fillRect(p.x-3,p.gapY+65,60,20);});ctx.beginPath();ctx.arc(80,by,14,0,Math.PI*2);ctx.fillStyle='#facc15';ctx.fill();ctx.strokeStyle='#ca8a04';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 28px sans-serif';ctx.textAlign='center';ctx.fillText(score,WIDTH/2,40);if(!alive){ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.fillStyle='#f87171';ctx.font='bold 32px sans-serif';ctx.textAlign='center';ctx.fillText('GAME OVER',WIDTH/2,HEIGHT/2-30);ctx.fillStyle='#fff';ctx.font='bold 20px sans-serif';ctx.fillText('Score: '+score,WIDTH/2,HEIGHT/2+10);ctx.fillStyle='#aaa';ctx.font='15px sans-serif';ctx.fillText('Tap to restart',WIDTH/2,HEIGHT/2+45);}requestAnimationFrame(loop);}requestAnimationFrame(loop);"
}`;

/** Blocco da mostrare sopra agli errori di generazione/validazione/compilazione (stesso "contratto" del modello). */
export function getJsonResponseRetryHint(): string {
  return `Rigenera un UNICO JSON valido (solo chiavi manifest, ui, code — niente markdown né testo extra).
GIOCHI: usa SEMPRE { "type":"webGame","width":360,"height":600 } nell'UI. Il code è JavaScript browser (canvas 2D + requestAnimationFrame), NON module.exports.
  Globals già pronti (NON ridichiarare): canvas, ctx, WIDTH, HEIGHT, sendState.
  VIETATO: var canvas, var ctx, var WIDTH, var HEIGHT, var window, function init(){canvas=document...}.
  Touch: canvas.addEventListener('touchstart',fn,{passive:false}), e.preventDefault() dentro.
  Split-screen: touchLeft=(e.touches[0].clientX<WIDTH/2).
  Loop: function loop(){...draw...requestAnimationFrame(loop);} requestAnimationFrame(loop);
  NO: require, import, module.exports, eval, while(true).
• navigator: { "type":"navigator","initialScreen":"home","screens":{"home":{"type":"screen","onFocus":"loadData",...}} }
• app normale: code=module.exports={actions:{async nome(api,input,state){return patch;}}}; NO TypeScript; NO eval; virgolette escape \\"; graffe bilanciate.
• notifications: api.notifications.schedule(titolo, testo, secondiDaOra) — 3 argomenti separati.`;
}

const LANGUAGE_DIRECTIVES: Record<string, string> = {
  en: 'IMPORTANT: Generate ALL UI text in English: button labels, screen titles, placeholders, status messages, emptyText, error messages. Do not use Italian words in the UI.',
  es: 'IMPORTANTE: Genera TODOS los textos de la UI en español: etiquetas de botones, títulos, placeholders, mensajes de estado, emptyText.',
  fr: 'IMPORTANT: Génère TOUS les textes de l\'UI en français: labels des boutons, titres, placeholders, messages de statut, emptyText.',
  de: 'WICHTIG: Generiere ALLE UI-Texte auf Deutsch: Button-Labels, Titel, Platzhalter, Statusmeldungen, emptyText.',
};

export function buildModuleGenerationPrompt(userPrompt: string, language?: string): string {
  const trimmed = userPrompt.trim();
  const lang = language?.toLowerCase().slice(0, 2) || 'it';
  const langDirective = LANGUAGE_DIRECTIVES[lang] ?? '';

  return `Sei il generatore di moduli per AppFromAI. Obiettivo: modulo completo, valido e pronto all'uso su dispositivo mobile.
${langDirective ? `\n${langDirective}\n` : ''}
=== FORMATO DI RISPOSTA (leggi tutto questo blocco prima della richiesta utente; l'output deve rispettarlo al 100%) ===

${JSON_RESPONSE_RULES_IT}

${SHAPE_EXAMPLE}

${GAME_EXAMPLE}

=== RICHIESTA UTENTE (implementa in modo concreto; la tua risposta deve essere ESCLUSIVAMENTE l'oggetto JSON richiesto sopra, senza altro testo) ===

${trimmed}`;
}
