/**
 * Prompt builder for the local provider (LiteRT-LM on-device, Android).
 * Two variants calibrated to each model's token budget and capabilities:
 *
 *  - buildSmallModelPrompt  → Gemma 3 1B, Qwen 2.5 1.5B, DeepSeek R1 1.5B
 *    KV cache 1024–4096 tokens. Ultra-compact prompt, minimum required structure only.
 *
 *  - buildGemma4Prompt      → Gemma 4 E2B, Gemma 4 E4B
 *    KV cache 8192 tokens, 32K context, advanced instruction-following.
 *    Intermediate prompt: full schema + state-safety rules + navigator example.
 */

const GAME_KEYWORDS =
  /\b(game|gioco|pong|flappy|snake|bounce|ball|pallina|platformer|arcade|tetris|sparatutto|shooter|brick|breakout|pinball|endless|runner|jumper)\b/i;
const FLAPPY_KEYWORDS = /\b(flappy|flap)\b/i;
const SNAKE_KEYWORDS  = /\bsnake\b/i;
const PONG_KEYWORDS   = /\bpong\b/i;

// ── Small models (≤1.5B, KV cache ≤4096) ────────────────────────────────────

export function buildSmallModelPrompt(userPrompt: string): string {
  const trimmed = userPrompt.trim();
  const isGame = GAME_KEYWORDS.test(trimmed);

  const gameComponentHint = isGame
    ? `, gameView {id,bind:"scene",width:320,height:420,tickMs:50,tickAction:"onTick",onTapAction:"onTap"}`
    : '';

  const gameCodeHint = isGame
    ? `\nGAME RULES: onTick returns {scene:[{type:'rect',x,y,w,h,color},{type:'circle',x,y,r,color},{type:'text',x,y,text,color,fontSize}],...state}. MAX 10 lines. Math.min/Math.max for bounds. onTap: return{vy:-8};`
    : '';

  const gameExample = isGame
    ? `

GAME EXAMPLE (follow this exact pattern):
{"manifest":{"id":"ball","name":"Ball","version":"1.0.0","runtime":"javascript","permissions":[],"entry":"logic.js","ui":"ui.json"},"ui":{"type":"screen","title":"Ball","gap":8,"components":[{"type":"gameView","id":"gv","bind":"scene","width":320,"height":420,"tickMs":50,"tickAction":"onTick","onTapAction":"onTap"}]},"code":"module.exports={actions:{onTick(api,input,state){const W=320,H=420,R=10;const x=parseFloat(String(state.x??'160'));const y=parseFloat(String(state.y??'80'));const vx=parseFloat(String(state.vx??'3'));const vy=parseFloat(String(state.vy??'3'));const score=parseInt(String(state.score??'0'),10)+1;const nx=x+vx;const ny=y+vy;const nvx=(nx<R||nx>W-R)?-vx:vx;const nvy=(ny<R||ny>H-R)?-vy:vy;return{x:Math.max(R,Math.min(W-R,nx)),y:Math.max(R,Math.min(H-R,ny)),vx:nvx,vy:nvy,score,scene:[{type:'rect',x:0,y:0,w:W,h:H,color:'#111'},{type:'circle',x:Math.max(R,Math.min(W-R,nx)),y:Math.max(R,Math.min(H-R,ny)),r:R,color:'#6cf'},{type:'text',x:8,y:14,text:'Score:'+score,color:'#fff',fontSize:14}]};},onTap(api,input,state){return{vy:-8};}}}"}`
    : '';

  return `You are a mobile app module generator. Output ONLY a single valid JSON object. No markdown, no explanation, no text outside JSON.

THE OUTPUT MUST HAVE EXACTLY 3 TOP-LEVEL KEYS: "manifest", "ui", "code"

KEY 1 — "manifest" (object with metadata only):
{"id":"myapp","name":"My App","version":"1.0.0","runtime":"javascript","permissions":[],"entry":"logic.js","ui":"ui.json"}
WARNING: manifest.ui must be the STRING "ui.json" — never put the UI definition inside manifest.

KEY 2 — "ui" (the screen definition as an object, NOT inside manifest):
{"type":"screen","title":"App Title","gap":16,"components":[...]}
Component types: text {id,text,bind?}, input {id,bind,placeholder?}, button {id,text,action}, list {id,bind}, box {direction:"row"|"column",gap?,components:[...]}, image {id,bind}${gameComponentHint}
Action button: {"type":"button","id":"btn","text":"Go","action":"doAction"}
Navigate button: {"type":"button","id":"btn","text":"Next","navigate":"screenName"}

KEY 3 — "code" (JavaScript as a JSON string, all on one line with escaped quotes):
"module.exports={actions:{doAction(api,input,state){const x=parseFloat(String(state.x??'0'))||0;return {x:x+1};}}}"
RULES: fn(api,input,state) — always 3 params. No TypeScript, no eval, no require. State reads need fallback: String(state.x??'').
VARIABLE RULE: declare every variable with const/let before using it. Only return keys you explicitly declared.${gameCodeHint}
Permissions array: use only what's needed from: camera, audioRecorder, qrScanner, torch, location, storage, network.

EXAMPLE OUTPUT:
{"manifest":{"id":"counter","name":"Counter","version":"1.0.0","runtime":"javascript","permissions":[],"entry":"logic.js","ui":"ui.json"},"ui":{"type":"screen","title":"Counter","gap":16,"components":[{"type":"text","id":"t","text":"0","bind":"count"},{"type":"button","id":"btn","text":"Add","action":"add"}]},"code":"module.exports={actions:{add(api,input,state){const n=parseInt(String(state.count??'0'),10)||0;return {count:String(n+1)};}}}"}
${gameExample}
REQUEST: ${trimmed}`;
}

// ── Gemma 4 E2B / E4B (KV cache 8192) ───────────────────────────────────────

export function buildGemma4Prompt(userPrompt: string): string {
  const trimmed = userPrompt.trim();
  // LiteRT-LM 0.11.x InputData.Text passes raw bytes — Gemma 4 instruct template
  // is NOT applied automatically, so the model echoes the prompt instead of
  // generating JSON. We apply it manually here.
  const body = buildGemma4Body(trimmed);
  return `<start_of_turn>user\n${body}<end_of_turn>\n<start_of_turn>model\n`;
}

function buildGemma4Body(trimmed: string): string {
  return `You are a mobile app module generator for AppFromAI. Output ONLY a single valid JSON object. No markdown, no preamble, no text outside JSON.

THE JSON MUST HAVE EXACTLY 3 TOP-LEVEL KEYS: "manifest", "ui", "code"

KEY 1 — "manifest":
{"id":"myapp","name":"My App","version":"1.0.0","runtime":"javascript","permissions":[],"entry":"logic.js","ui":"ui.json"}
- id: lowercase letters/numbers/dashes only. runtime: exactly "javascript".
- manifest.ui must be the STRING "ui.json" — never put the UI tree inside manifest.
- permissions: include only what the code actually uses: camera, audioRecorder, qrScanner, torch, location, sensors, linking, storage, network, notifications.
- Clipboard, haptics, share, tts need NO permission — use them freely.

KEY 2 — "ui" (component tree, NOT inside manifest):
Single-page root: {"type":"screen","title":"...","gap":16,"components":[...]}
Multi-page root:  {"type":"navigator","initialScreen":"home","screens":{"home":{...},"detail":{...}}}

Component reference:
- text:     {"type":"text","id":"t","text":"Hello","bind":"key"}
- input:    {"type":"input","id":"inp","bind":"key","placeholder":"...","keyboardType":"default|numeric|decimal-pad"}
- textarea: {"type":"textarea","id":"ta","bind":"key","placeholder":"..."}
- button (action):   {"type":"button","id":"btn","text":"Label","action":"actionName"}
- button (navigate): {"type":"button","id":"btn","text":"Next","navigate":"screenName"}
- list:     {"type":"list","id":"lst","bind":"items","emptyText":"Empty"}
- image:    {"type":"image","id":"img","bind":"uri"}
- box:      {"type":"box","direction":"row|column","gap":8,"alignItems":"center","justifyContent":"space-between","components":[...]}
- card:     {"type":"card","id":"c","components":[...]}
- ticker:   {"type":"ticker","tickMs":1000,"tickAction":"onTick","running":"isRunning"} — invisible node, calls onTick every tickMs. Pause/resume via state[running]. Use for timers/countdowns. NEVER use setTimeout/setInterval in action code.
- gameView: {"type":"gameView","bind":"scene","width":320,"height":480,"tickMs":50,"tickAction":"onTick","onTapAction":"onTap"}
- gamepad:  {"type":"gamepad","direction":"row","buttonSize":72,"buttons":[{"id":"b","label":"▶","action":"move","hold":true,"holdMs":80}]}
- layout on any component: {"layout":{"flex":1,"textAlign":"center","marginTop":8}}

Navigator rules:
- onFocus: MANDATORY on any screen with a list or storage data — without it the list is always empty after saving. Action fires automatically on startup and on return from another screen. Pattern: "home":{"type":"screen","onFocus":"loadList",...} → async loadList(api,input,state){const raw=await api.storage.load('items');return{items:Array.isArray(raw)?raw:[]};}
- Save action MUST return {"__navigate":"__back"} to go back and trigger onFocus reload. Example: async save(api,input,state){...await api.storage.save('items',items);return{text:'',__navigate:'__back'};}
- Navigate programmatically from code: return {"__navigate":"screenName"} in the state patch.
- Back button is automatic. Use "navigate":"__back" on a button to go back manually.

KEY 3 — "code" (JavaScript string — escape inner quotes as \\", keep compact):
module.exports={actions:{name(api,input,state){...return {key:value};}}}

Code rules:
- No TypeScript annotations. No eval, require, import. No while(true) or for(;;). No setTimeout/setInterval (use ticker node instead).
- Multiple actions: comma-separated siblings inside actions{} — a1(...){...}, a2(...){...}
- After if(cond){return A;} use else {return B;} — never a naked return immediately after a closing brace.
- Every action must return a plain patch object (or null). Values must be JSON-serialisable.

State safety (Hermes crashes on undefined access — use fallbacks everywhere):
- Number:  const x = parseFloat(String(state.x ?? '0')) || 0;
- String:  const s = String(state.s ?? '');
- Boolean: const b = !!state.b;
- Array:   const arr = Array.isArray(state.arr) ? state.arr : [];
- Never call methods on a value read from state without first assigning it with a fallback.
- NESTED: never write state.obj.prop — always guard: const obj=(state.obj&&typeof state.obj==='object')?state.obj:{}; const val=String(obj.prop??''); Direct nested access → "Property 'X' doesn't exist" crash.

Available APIs (require matching permission in manifest):
- Storage:       await api.storage.save(key,value); const v=await api.storage.load(key); IMPORTANT: save/load handle serialization automatically — NEVER use JSON.stringify on save or JSON.parse on load. Arrays: await api.storage.save('k',arr); const arr=Array.isArray(await api.storage.load('k'))?await api.storage.load('k'):[];
- Network:       const r=await api.network.fetch(url,{method:"GET"}); r.ok, r.status, r.text
- Camera:        const photo=await api.camera.takePhoto(); returns {uri,width,height}|null
- Audio record:  await api.audioRecorder.start(); const f=await api.audioRecorder.stop(); returns {uri,durationMs}|null
- Audio play:    await api.audioPlayer.play(uri); await api.audioPlayer.stop();
- Location:      const pos=await api.location.getCurrentPosition(); returns {latitude,longitude,...}
- Linking:       await api.linking.openUrl(url); .dialPhone(p); .sendSms(p,body); .composeEmail({to,subject,body})
- Notifications: await api.notifications.schedule(title,body,secondsFromNow);
- No-permission: await api.clipboard.set(t); await api.haptics.impact("medium"); await api.tts.speak(t,{language:"en-US"}); await api.share.text(msg);

gameView physics (onTick MAX 15 lines — use Math.min/Math.max for bounds, never if-chains):
onTick(api,input,state){const W=320,H=480,R=12;const x=parseFloat(String(state.bx??'160'));const y=parseFloat(String(state.by??'80'));const vx=parseFloat(String(state.vx??'3'));const vy=parseFloat(String(state.vy??'3'));const nx=x+vx;const ny=y+vy;const nvx=(nx<R||nx>W-R)?-vx:vx;const nvy=(ny<R||ny>H-R)?-vy:vy;const scene=[{type:'rect',x:0,y:0,w:W,h:H,color:'#111'},{type:'circle',x:Math.max(R,Math.min(W-R,nx)),y:Math.max(R,Math.min(H-R,ny)),r:R,color:'#6cf'},{type:'text',x:8,y:14,text:'Pts:'+parseInt(String(state.score??'0'),10),color:'#fff',fontSize:14}];return{bx:Math.max(R,Math.min(W-R,nx)),by:Math.max(R,Math.min(H-R,ny)),vx:nvx,vy:nvy,score:(parseInt(String(state.score??'0'),10)+1),scene};}
onTap receives input.x, input.y, input.jump (-8). Scene objects: rect{type,x,y,w,h,color,radius?}, circle{type,x,y,r,color}, text{type,x,y,text,color,fontSize,align?}.

EXAMPLE — navigator with storage list:
{"manifest":{"id":"notes","name":"Notes","version":"1.0.0","runtime":"javascript","permissions":["storage"],"entry":"logic.js","ui":"ui.json"},"ui":{"type":"navigator","initialScreen":"home","screens":{"home":{"type":"screen","title":"Notes","onFocus":"load","components":[{"type":"list","id":"lst","bind":"items","emptyText":"No notes"},{"type":"button","id":"btn-add","text":"New","navigate":"add"}]},"add":{"type":"screen","title":"Add note","components":[{"type":"input","id":"inp","bind":"draft","placeholder":"Note text"},{"type":"button","id":"btn-save","text":"Save","action":"save"}]}}},"code":"module.exports={actions:{load(api,input,state){const raw=await api.storage.load('notes');return{items:Array.isArray(raw)?raw:[]};},save(api,input,state){const draft=String(state.draft??'');if(!draft)return{draft:''};const raw=await api.storage.load('notes');const items=Array.isArray(raw)?raw:[];items.push(draft);await api.storage.save('notes',items);return{draft:'',__navigate:'__back'};}}}"}

CRITICAL — AVOID THESE MISTAKES:
1. Root "ui" MUST be "screen" or "navigator". NEVER use "gameView" as root — gameView goes inside a screen's components array.
2. permissions ONLY from this exact list: camera, audioRecorder, qrScanner, torch, location, sensors, linking, storage, network, notifications. Do NOT invent permissions (e.g. "physics" does not exist).
3. onTap MUST be minimal (1-3 lines): const jump=parseFloat(String(input.jump??'-8'))||−8; return {birdVy:jump};
4. onTick MAX 15 lines. Use Math.min/Math.max for bounds — never chain if/else for boundary checks.

REQUEST: ${trimmed}`;
}

// ── Fine-tuned AppFromAI model ───────────────────────────────────────────────
//
// The fine-tuned model learned the AppFromAI schema during training.
// Prompt is ~20 tokens — no instructions, no schema, no examples.
//
// Expected output format (tagged, no JSON escaping of code):
//   <ui>
//   {"type":"screen",...}
//   </ui>
//   <code>
//   module.exports={actions:{...}}
//   </code>
//
// The manifest is NOT generated by the model — aiClient.ts builds it from the
// prompt using makeModuleId / makeModuleName / inferPermissions.

export function buildFinetunedPrompt(userPrompt: string): string {
  const trimmed = userPrompt.trim();
  return `<start_of_turn>user\nGenerate an AppFromAI module for: ${trimmed}<end_of_turn>\n<start_of_turn>model\n`;
}

// ── Gemma 4 E2B / E4B — Two-pass generation ─────────────────────────────────
//
// Pass 1: generate ONLY the UI JSON (small output, focused task).
// Pass 2: given the UI already known, generate ONLY the JavaScript code.
// Manifest is assembled programmatically in aiClient — no model tokens wasted on it.

export function buildGemma4UiPass(userPrompt: string): string {
  const trimmed = userPrompt.trim();
  const isGame    = GAME_KEYWORDS.test(trimmed);
  const isFlappy  = FLAPPY_KEYWORDS.test(trimmed);
  const isSnake   = SNAKE_KEYWORDS.test(trimmed);

  // Game-specific UI templates — the model should copy these exactly.
  // Flappy Bird: full-screen tap, no gamepad needed.
  // Snake: slow tickMs (150ms), tap changes direction.
  // Generic: 2-button gamepad for left/right movement.
  const gameUiExample = isGame
    ? isFlappy
      ? `\nFLAPPY BIRD UI (copy exactly, rename title only): {"type":"screen","title":"Flappy Bird","gap":0,"components":[{"type":"gameView","id":"gv","bind":"scene","width":320,"height":480,"tickMs":30,"tickAction":"onTick","onTapAction":"onTap"}]}`
      : isSnake
      ? `\nSNAKE UI (copy exactly, rename title only): {"type":"screen","title":"Snake","gap":0,"components":[{"type":"gameView","id":"gv","bind":"scene","width":320,"height":480,"tickMs":150,"tickAction":"onTick","onTapAction":"onTap"}]}`
      : `\nGAME SCREEN EXAMPLE: {"type":"screen","title":"Game","gap":8,"components":[{"type":"gameView","id":"gv","bind":"scene","width":320,"height":480,"tickMs":50,"tickAction":"onTick","onTapAction":"onTap"},{"type":"gamepad","direction":"row","buttonSize":72,"buttons":[{"id":"bl","label":"◀","action":"moveLeft","hold":true,"holdMs":80},{"id":"br","label":"▶","action":"moveRight","hold":true,"holdMs":80}]}]}`
    : '';

  const body = `Output ONLY a single valid JSON object for a mobile app UI. No markdown. No multiple objects.

CRITICAL: output EXACTLY ONE JSON object. Multi-screen apps MUST use navigator — never output separate JSON objects for each screen.

Root (choose one):
- Single screen: {"type":"screen","title":"T","gap":16,"components":[...]}
- Multi-screen:  {"type":"navigator","initialScreen":"home","screens":{"home":{"type":"screen",...},"detail":{"type":"screen",...}}}

Components (type field is always the exact string shown):
text{"type":"text",id,text,bind?} input{"type":"input",id,bind,placeholder?,keyboardType?} textarea{"type":"textarea",id,bind,placeholder?}
button{"type":"button",id,text,action:"actionName"} OR button{"type":"button",id,text,navigate:"screenName"}
list{"type":"list",id,bind,emptyText?} image{"type":"image",id,bind} box{"type":"box",direction,gap?,components:[]} card{"type":"card",id,components:[]}
gameView{"type":"gameView","id":"gv","bind":"scene","width":320,"height":480,"tickMs":50,"tickAction":"onTick","onTapAction":"onTap"} gamepad{"type":"gamepad",direction,buttonSize,buttons:[{id,label,action,hold?,holdMs?}]}

RULES: gameView inside screen.components — NEVER as root. gameView bind must be "scene". Navigator: onFocus:"action" for data-reload screens. Compact JSON no extra whitespace.
ACTION NAMING: button "action" must be a descriptive app logic name (e.g. "save","load","addItem","calculate","search"). FORBIDDEN as action names: onPress, onClick, onSubmit, onChange, onFocus, onBlur, handlePress, handleClick — these are React event handler names, not valid here.
${gameUiExample}
OUTPUT: only the JSON. Nothing else.
REQUEST: ${trimmed}`;
  return `<start_of_turn>user\n${body}<end_of_turn>\n<start_of_turn>model\n`;
}

export function buildGemma4CodePass(
  userPrompt: string,
  ui: unknown,
  actionNames: string[],
  bindKeys: string[]
): string {
  const trimmed = userPrompt.trim();
  const uiJson = JSON.stringify(ui);
  const actions = actionNames.length > 0 ? actionNames.join(', ') : 'none';
  const binds = bindKeys.length > 0 ? bindKeys.join(', ') : 'none';

  const isGameCode =
    actionNames.some((a) => /tick|tap/i.test(a)) || bindKeys.includes('scene');

  const isFlappy = FLAPPY_KEYWORDS.test(trimmed);
  const isSnake  = SNAKE_KEYWORDS.test(trimmed);
  const isPong   = PONG_KEYWORDS.test(trimmed);

  // ── Game-specific examples ─────────────────────────────────────────────────
  // Each example is a complete, working implementation that the model should
  // mirror for the requested game type. Action names are placeholders — the
  // model must rename them to match the actual "Actions to implement" list.

  const FLAPPY_EXAMPLE =
    `{actions:{onTick(api,input,state){const W=320,H=480,BX=60,BR=12,GAP=55,G=0.5;` +
    `if(state.dead){const s=parseInt(String(state.score??'0'),10);` +
    `return{scene:[{type:'rect',x:0,y:0,w:W,h:H,color:'#70c5ce'},` +
    `{type:'text',x:W/2,y:200,text:'GAME OVER',color:'#f00',fontSize:24,align:'center'},` +
    `{type:'text',x:W/2,y:240,text:'Score:'+s,color:'#fff',fontSize:18,align:'center'},` +
    `{type:'text',x:W/2,y:278,text:'Tap to restart',color:'#fff',fontSize:14,align:'center'}]};}` +
    `const y=parseFloat(String(state.y??'240'));` +
    `const vy=parseFloat(String(state.vy??'0'))+G;` +
    `const ny=y+vy;` +
    `let pipes=Array.isArray(state.pipes)?state.pipes:[];` +
    `pipes=pipes.map(p=>({x:p.x-2,gap:p.gap})).filter(p=>p.x>-40);` +
    `const lastX=pipes.length>0?pipes[pipes.length-1].x:0;` +
    `if(lastX<W-150)pipes=[...pipes,{x:W,gap:100+Math.floor(Math.random()*220)}];` +
    `const pts=parseInt(String(state.score??'0'),10)+pipes.filter(p=>p.x+2>=BX&&p.x<BX).length;` +
    `const hit=ny<BR||ny>H-BR||pipes.some(p=>Math.abs(p.x-BX)<BR+20&&(ny<p.gap-GAP||ny>p.gap+GAP));` +
    `const scene=[{type:'rect',x:0,y:0,w:W,h:H,color:'#70c5ce'}];` +
    `pipes.forEach(p=>{` +
    `scene.push({type:'rect',x:p.x-20,y:0,w:40,h:Math.max(0,p.gap-GAP),color:'#5d8a3c'});` +
    `scene.push({type:'rect',x:p.x-20,y:p.gap+GAP,w:40,h:H,color:'#5d8a3c'});` +
    `});` +
    `scene.push({type:'circle',x:BX,y:Math.max(BR,Math.min(H-BR,ny)),r:BR,color:'#f6d622'});` +
    `scene.push({type:'text',x:8,y:20,text:'Score:'+pts,color:'#fff',fontSize:16});` +
    `return{y:Math.max(BR,Math.min(H-BR,ny)),vy:hit?0:vy,pipes,score:pts,dead:hit,scene};},` +
    `onTap(api,input,state){if(state.dead)return{y:240,vy:0,pipes:[],score:0,dead:false};return{vy:-8};}}}`;

  const SNAKE_EXAMPLE =
    `{actions:{onTick(api,input,state){const W=320,H=480,C=20,COLS=16,ROWS=24;` +
    `const body=Array.isArray(state.body)?state.body:[{x:8,y:12},{x:7,y:12},{x:6,y:12}];` +
    `const dx=parseInt(String(state.dx??'1'),10);const dy=parseInt(String(state.dy??'0'),10);` +
    `const food=state.food&&typeof state.food==='object'?state.food:{x:5,y:5};` +
    `const head={x:(body[0].x+dx+COLS)%COLS,y:(body[0].y+dy+ROWS)%ROWS};` +
    `const eating=head.x===food.x&&head.y===food.y;` +
    `const nb=eating?[head,...body]:[head,...body.slice(0,-1)];` +
    `const dead=nb.slice(1).some(s=>s.x===head.x&&s.y===head.y);` +
    `const score=parseInt(String(state.score??'0'),10)+(eating?1:0);` +
    `const nf=eating?{x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*ROWS)}:food;` +
    `if(dead){return{body:[{x:8,y:12},{x:7,y:12}],dx:1,dy:0,food:nf,score:0,` +
    `scene:[{type:'rect',x:0,y:0,w:W,h:H,color:'#111'},` +
    `{type:'text',x:W/2,y:H/2,text:'GAME OVER Score:'+score,color:'#fff',fontSize:18,align:'center'}]};}` +
    `const scene=[{type:'rect',x:0,y:0,w:W,h:H,color:'#111'}];` +
    `nb.forEach((s,i)=>scene.push({type:'rect',x:s.x*C,y:s.y*C,w:C-1,h:C-1,color:i===0?'#0f0':'#0a0'}));` +
    `scene.push({type:'rect',x:nf.x*C,y:nf.y*C,w:C-1,h:C-1,color:'#f00'});` +
    `scene.push({type:'text',x:4,y:16,text:'Score:'+score,color:'#fff',fontSize:14});` +
    `return{body:nb,dx,dy,food:nf,score,scene};},` +
    `onTap(api,input,state){const dx=parseInt(String(state.dx??'1'),10);` +
    `if(dx!==0)return{dx:0,dy:-1};return{dx:1,dy:0};}}}`;

  const PONG_EXAMPLE =
    `{actions:{onTick(api,input,state){const W=320,H=480,PR=8,PW=12,PH=60,HALF=PH/2;` +
    `const bx=parseFloat(String(state.bx??'160'));const by=parseFloat(String(state.by??'240'));` +
    `const vx=parseFloat(String(state.vx??'4'));const vy=parseFloat(String(state.vy??'3'));` +
    `const py=parseFloat(String(state.py??'240'));` +
    `const ay=Math.max(HALF,Math.min(H-HALF,by));` +
    `const nbx=bx+vx;const nby=by+vy;` +
    `const nvx=(nbx<PW+PR&&nby>=py-HALF&&nby<=py+HALF)||(nbx>W-PW-PR&&nby>=ay-HALF&&nby<=ay+HALF)||(nbx<PR||nbx>W-PR)?-vx:vx;` +
    `const nvy=(nby<PR||nby>H-PR)?-vy:vy;` +
    `const score=parseInt(String(state.score??'0'),10)+(nbx<0||nbx>W?1:0);` +
    `const scene=[{type:'rect',x:0,y:0,w:W,h:H,color:'#111'},` +
    `{type:'rect',x:0,y:py-HALF,w:PW,h:PH,color:'#fff'},` +
    `{type:'rect',x:W-PW,y:ay-HALF,w:PW,h:PH,color:'#f44'},` +
    `{type:'circle',x:Math.max(PR,Math.min(W-PR,nbx)),y:Math.max(PR,Math.min(H-PR,nby)),r:PR,color:'#ff0'},` +
    `{type:'text',x:W/2,y:16,text:'Score:'+score,color:'#fff',fontSize:16,align:'center'}];` +
    `return{bx:Math.max(PR,Math.min(W-PR,nbx)),by:Math.max(PR,Math.min(H-PR,nby)),vx:nvx,vy:nvy,py,score,scene};},` +
    `onTap(api,input,state){const by=parseFloat(String(state.by??'240'));return{py:by};}}}`;

  // ── Game-specific rules injected into the prompt ───────────────────────────
  let gameSpecificRules = '';
  if (isFlappy) {
    gameSpecificRules = `
FLAPPY BIRD — implement these exact mechanics:
- State: y (bird y, init 240), vy (velocity, init 0), pipes (array of {x,gap}), score (int), dead (bool)
- Gravity: every tick vy += 0.5 (accumulates — NOT a fixed bounce)
- Pipes: each tick move x-=2; add {x:320,gap:100+rand*220} when last pipe x<170; filter x<-40
- Score: count pipes where prev x>=BX and new x<BX (BX=60, bird's x position)
- Collision: ny<12 OR ny>468 OR any pipe where abs(pipe.x-60)<32 AND (ny<pipe.gap-55 OR ny>pipe.gap+55)
- On collision: set dead:true (next tick shows GAME OVER screen, physics stops)
- onTap: if dead→ reset all to initial; else return {vy:-8}
- Scene: sky #70c5ce bg, green rects for pipe top (0 to gap-55) and bottom (gap+55 to 480), yellow circle bird at x=60, score text`;
  } else if (isSnake) {
    gameSpecificRules = `
SNAKE — implement these exact mechanics:
- State: body (array {x,y} grid coords), dx (1=right), dy (0), food {x,y}, score
- Grid: 320×480 canvas → 16 cols × 24 rows of 20px cells
- Every tick: compute new head = {x:(body[0].x+dx+16)%16, y:(body[0].y+dy+24)%24}
- If eating food → grow (don't pop tail); else pop tail; check self-collision on new head
- Self-collision → game over: reset body, dx:1, dy:0, score:0
- New food random position on eat; +1 score per food
- onTap: if currently horizontal (dx!=0) → switch to vertical (dx:0,dy:-1); else → horizontal (dx:1,dy:0)
- Scene: dark #111 bg, green rects body (head brighter), red rect food, score text top-left`;
  } else if (isPong) {
    gameSpecificRules = `
PONG — implement these mechanics:
- State: bx/by (ball pos, init 160/240), vx/vy (ball velocity), py (player paddle y, left side), score
- AI paddle (right side) tracks ball y automatically: ay = Math.max(HALF,Math.min(H-HALF,by))
- Ball bounces off paddles and top/bottom walls; when ball exits left/right → score++, reset
- onTap: move player paddle to ball's current y position (tap to track)
- Scene: dark bg, white player paddle at x=0, red AI paddle at x=W-PW, yellow ball, score centered`;
  }

  // ── Build example format ───────────────────────────────────────────────────
  let exampleFormat: string;
  if (isFlappy) {
    exampleFormat = FLAPPY_EXAMPLE;
  } else if (isSnake) {
    exampleFormat = SNAKE_EXAMPLE;
  } else if (isPong) {
    exampleFormat = PONG_EXAMPLE;
  } else if (isGameCode) {
    exampleFormat = `{actions:{onTick(api,input,state){const W=320,H=480,R=12;const x=parseFloat(String(state.x??'160'));const y=parseFloat(String(state.y??'80'));const vx=parseFloat(String(state.vx??'3'));const vy=parseFloat(String(state.vy??'3'));const score=parseInt(String(state.score??'0'),10)+1;const nx=x+vx;const ny=y+vy;const nvx=(nx<R||nx>W-R)?-vx:vx;const nvy=(ny<R||ny>H-R)?-vy:vy;return{x:Math.max(R,Math.min(W-R,nx)),y:Math.max(R,Math.min(H-R,ny)),vx:nvx,vy:nvy,score,scene:[{type:'rect',x:0,y:0,w:W,h:H,color:'#111'},{type:'circle',x:Math.max(R,Math.min(W-R,nx)),y:Math.max(R,Math.min(H-R,ny)),r:R,color:'#6cf'},{type:'text',x:8,y:16,text:'Score:'+score,color:'#fff',fontSize:14}]};},onTap(api,input,state){return{vy:-8};}}}`;
  } else {
    // Use the real action names from the UI in the example so the model MUST implement them.
    const exActions = actionNames.length > 0 ? actionNames : ['doAction'];
    const exBodies = exActions
      .map((a) => `${a}(api,input,state){const s=String(state.text??'');return{result:s};}`)
      .join(',');
    exampleFormat = `{actions:{${exBodies}}}`;
  }

  const body = `Write JavaScript actions for this mobile app. Implement EXACTLY the listed actions.

App: ${trimmed}
UI (already built — do not re-generate): ${uiJson}
Actions to implement (MANDATORY — use EXACTLY these names): ${actions}
State keys used by UI: ${binds}
${gameSpecificRules}
EXAMPLE FORMAT (adapt action names to match the list above, keep the mechanics):
${exampleFormat}

Rules:
- Implement ALL actions listed above. Action names must match EXACTLY (case-sensitive).
- State fallbacks (mandatory): const x=parseFloat(String(state.x??'0'))||0; const s=String(state.s??''); const arr=Array.isArray(state.arr)?state.arr:[];
- if(cond){return A;}else{return B;} — no naked return after closing brace
- No TypeScript, no declarations outside actions, no require/import/eval/while(true)
- Navigate: return{__navigate:"screenName"} or {__navigate:"__back"}
- onTick max 20 lines. Scene array: [{type:'rect',x,y,w,h,color},{type:'circle',x,y,r,color},{type:'text',x,y,text,color,fontSize,align?}]
- USE these built-in APIs (do NOT implement them): api.storage.save(k,v)/load(k), api.network.fetch(url,{method:'GET'}), api.clipboard.set(t), api.haptics.impact("medium"), api.tts.speak(t,{language:"en-US"})

Output ONLY the {actions:{...}} object — nothing else:`;

  // The model turn is pre-filled with "module.exports=" so the model continues from there.
  // aiClient prepends it back when reconstructing the full code string.
  return `<start_of_turn>user\n${body}<end_of_turn>\n<start_of_turn>model\nmodule.exports=`;
}
