/**
 * Pre-built, tested game modules for common game types.
 * When the user asks for a known game, these are returned directly —
 * no model code-generation pass needed, ensuring 100% reliability
 * and correct physics.
 */

export type BuiltinGame = 'flappy' | 'snake' | 'pong' | 'breakout';

// ── UIs ──────────────────────────────────────────────────────────────────────

const FLAPPY_UI = {
  type: 'screen', title: 'Flappy Bird', gap: 0,
  components: [{ type: 'gameView', id: 'gv', bind: 'scene', width: 320, height: 480, tickMs: 30, tickAction: 'onTick', onTapAction: 'onTap' }],
};

const SNAKE_UI = {
  type: 'screen', title: 'Snake', gap: 0,
  components: [{ type: 'gameView', id: 'gv', bind: 'scene', width: 320, height: 480, tickMs: 150, tickAction: 'onTick', onTapAction: 'onTap' }],
};

const PONG_UI = {
  type: 'screen', title: 'Pong', gap: 0,
  components: [{ type: 'gameView', id: 'gv', bind: 'scene', width: 320, height: 480, tickMs: 25, tickAction: 'onTick', onTapAction: 'onTap' }],
};

const BREAKOUT_UI = {
  type: 'screen', title: 'Breakout', gap: 0,
  components: [{ type: 'gameView', id: 'gv', bind: 'scene', width: 320, height: 480, tickMs: 30, tickAction: 'onTick', onTapAction: 'onTap' }],
};

// ── Codes ─────────────────────────────────────────────────────────────────────

const FLAPPY_CODE =
  `module.exports={actions:{` +
  `onTick(api,input,state){` +
  `const W=320,H=480,BX=60,BR=12,GAP=55,G=0.5;` +
  `if(state.dead){` +
  `const s=parseInt(String(state.score??'0'),10);` +
  `return{scene:[` +
  `{type:'rect',x:0,y:0,w:W,h:H,color:'#70c5ce'},` +
  `{type:'text',x:W/2,y:200,text:'GAME OVER',color:'#f00',fontSize:24,align:'center'},` +
  `{type:'text',x:W/2,y:240,text:'Score:'+s,color:'#fff',fontSize:18,align:'center'},` +
  `{type:'text',x:W/2,y:280,text:'Tap to restart',color:'#ddd',fontSize:14,align:'center'}` +
  `]};}` +
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
  `onTap(api,input,state){` +
  `if(state.dead)return{y:240,vy:0,pipes:[],score:0,dead:false};` +
  `return{vy:-8};}}}`;

const SNAKE_CODE =
  `module.exports={actions:{` +
  `onTick(api,input,state){` +
  `const W=320,H=480,C=20,COLS=16,ROWS=24;` +
  `const body=Array.isArray(state.body)?state.body:[{x:8,y:12},{x:7,y:12},{x:6,y:12}];` +
  `const dx=parseInt(String(state.dx??'1'),10);` +
  `const dy=parseInt(String(state.dy??'0'),10);` +
  `const food=state.food&&typeof state.food==='object'?state.food:{x:5,y:5};` +
  `const head={x:(body[0].x+dx+COLS)%COLS,y:(body[0].y+dy+ROWS)%ROWS};` +
  `const eating=head.x===food.x&&head.y===food.y;` +
  `const nb=eating?[head,...body]:[head,...body.slice(0,-1)];` +
  `const dead=nb.slice(1).some(s=>s.x===head.x&&s.y===head.y);` +
  `const score=parseInt(String(state.score??'0'),10)+(eating?1:0);` +
  `const nf=eating?{x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*ROWS)}:food;` +
  `if(dead){return{body:[{x:8,y:12},{x:7,y:12}],dx:1,dy:0,food:nf,score:0,scene:[` +
  `{type:'rect',x:0,y:0,w:W,h:H,color:'#111'},` +
  `{type:'text',x:W/2,y:H/2,text:'GAME OVER Score:'+score,color:'#fff',fontSize:18,align:'center'}` +
  `]};}` +
  `const scene=[{type:'rect',x:0,y:0,w:W,h:H,color:'#111'}];` +
  `nb.forEach((s,i)=>scene.push({type:'rect',x:s.x*C,y:s.y*C,w:C-1,h:C-1,color:i===0?'#0f0':'#0a0'}));` +
  `scene.push({type:'rect',x:nf.x*C,y:nf.y*C,w:C-1,h:C-1,color:'#f00'});` +
  `scene.push({type:'text',x:4,y:16,text:'Score:'+score,color:'#fff',fontSize:14});` +
  `return{body:nb,dx,dy,food:nf,score,scene};},` +
  `onTap(api,input,state){` +
  `const dx=parseInt(String(state.dx??'1'),10);` +
  `if(dx!==0)return{dx:0,dy:-1};` +
  `return{dx:1,dy:0};}}}`;

const PONG_CODE =
  `module.exports={actions:{` +
  `onTick(api,input,state){` +
  `const W=320,H=480,PR=8,PW=12,PH=60,HALF=PH/2;` +
  `const bx=parseFloat(String(state.bx??'160'));` +
  `const by=parseFloat(String(state.by??'240'));` +
  `const vx=parseFloat(String(state.vx??'4'));` +
  `const vy=parseFloat(String(state.vy??'3'));` +
  `const py=parseFloat(String(state.py??'240'));` +
  `const ay=Math.max(HALF,Math.min(H-HALF,by));` +
  `const nbx=bx+vx;const nby=by+vy;` +
  `const hitP=nbx<PW+PR&&nby>=py-HALF&&nby<=py+HALF;` +
  `const hitA=nbx>W-PW-PR&&nby>=ay-HALF&&nby<=ay+HALF;` +
  `const hitW=nbx<PR||nbx>W-PR;` +
  `const nvx=(hitP||hitA||hitW)?-vx:vx;` +
  `const nvy=(nby<PR||nby>H-PR)?-vy:vy;` +
  `const scored=nbx<0||nbx>W;` +
  `const score=parseInt(String(state.score??'0'),10)+(scored?1:0);` +
  `const rnbx=scored?160:Math.max(PR,Math.min(W-PR,nbx));` +
  `const rnby=scored?240:Math.max(PR,Math.min(H-PR,nby));` +
  `const scene=[` +
  `{type:'rect',x:0,y:0,w:W,h:H,color:'#111'},` +
  `{type:'rect',x:0,y:py-HALF,w:PW,h:PH,color:'#fff'},` +
  `{type:'rect',x:W-PW,y:ay-HALF,w:PW,h:PH,color:'#f44'},` +
  `{type:'circle',x:rnbx,y:rnby,r:PR,color:'#ff0'},` +
  `{type:'text',x:W/2,y:16,text:'Score:'+score,color:'#fff',fontSize:16,align:'center'}` +
  `];` +
  `return{bx:rnbx,by:rnby,vx:scored?4:nvx,vy:scored?3:nvy,py,score,scene};},` +
  `onTap(api,input,state){` +
  `const by=parseFloat(String(state.by??'240'));` +
  `return{py:by};}}}`;

const BREAKOUT_CODE =
  `module.exports={actions:{` +
  `onTick(api,input,state){` +
  `const W=320,H=480,BR=8,PW=70,PH=10,BW=28,BH=12,ROWS=5,COLS=9;` +
  `const bx=parseFloat(String(state.bx??'160'));` +
  `const by=parseFloat(String(state.by??'300'));` +
  `const vx=parseFloat(String(state.vx??'3'));` +
  `const vy=parseFloat(String(state.vy??'-3'));` +
  `const px=parseFloat(String(state.px??'125'));` +
  `let bricks=Array.isArray(state.bricks)?state.bricks:[];` +
  `if(bricks.length===0){for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)bricks.push({r,c,alive:true});}` +
  `const nbx=bx+vx;const nby=by+vy;` +
  `const onPaddle=nby+BR>=H-PH-30&&nby<H-20&&nbx>=px&&nbx<=px+PW;` +
  `let nvx=vx,nvy=vy,hitBrick=false;` +
  `bricks=bricks.map(b=>{` +
  `if(!b.alive)return b;` +
  `const bx2=b.c*(BW+2)+10;const by2=b.r*(BH+4)+50;` +
  `if(nbx+BR>bx2&&nbx-BR<bx2+BW&&nby+BR>by2&&nby-BR<by2+BH){` +
  `if(!hitBrick){nvy=-nvy;hitBrick=true;}return{...b,alive:false};}return b;});` +
  `if(nbx<BR||nbx>W-BR)nvx=-nvx;` +
  `if(nby<BR)nvy=-nvy;` +
  `else if(onPaddle&&nvy>0)nvy=-nvy;` +
  `const score=parseInt(String(state.score??'0'),10)+(hitBrick?1:0);` +
  `if(nby>H){return{bx:160,by:300,vx:3,vy:-3,px,bricks:[],score,scene:[` +
  `{type:'rect',x:0,y:0,w:W,h:H,color:'#111'},` +
  `{type:'text',x:W/2,y:H/2,text:'GAME OVER Score:'+score,color:'#fff',fontSize:18,align:'center'},` +
  `{type:'text',x:W/2,y:H/2+36,text:'Tap to play again',color:'#aaa',fontSize:14,align:'center'}` +
  `]};}` +
  `const scene=[{type:'rect',x:0,y:0,w:W,h:H,color:'#111'}];` +
  `const colors=['#f44','#f84','#ff4','#4f4','#44f'];` +
  `bricks.forEach(b=>{if(!b.alive)return;` +
  `scene.push({type:'rect',x:b.c*(BW+2)+10,y:b.r*(BH+4)+50,w:BW,h:BH,color:colors[b.r%5]});});` +
  `scene.push({type:'rect',x:px,y:H-PH-30,w:PW,h:PH,color:'#fff'});` +
  `scene.push({type:'circle',x:Math.max(BR,Math.min(W-BR,nbx)),y:Math.max(BR,Math.min(H-BR,nby)),r:BR,color:'#ff0'});` +
  `scene.push({type:'text',x:4,y:16,text:'Score:'+score,color:'#fff',fontSize:14});` +
  `return{bx:Math.max(BR,Math.min(W-BR,nbx)),by:Math.max(BR,Math.min(H-BR,nby)),vx:nvx,vy:nvy,px,bricks,score,scene};},` +
  `onTap(api,input,state){` +
  `const px=parseFloat(String(state.px??'125'));` +
  `const W=320,PW=70;` +
  `return{px:Math.max(0,Math.min(W-PW,px+40))};}}}`;

// ── Public API ────────────────────────────────────────────────────────────────

export const BUILTIN_GAMES: Record<BuiltinGame, { ui: unknown; code: string }> = {
  flappy:   { ui: FLAPPY_UI,   code: FLAPPY_CODE   },
  snake:    { ui: SNAKE_UI,    code: SNAKE_CODE     },
  pong:     { ui: PONG_UI,     code: PONG_CODE      },
  breakout: { ui: BREAKOUT_UI, code: BREAKOUT_CODE  },
};

export function detectBuiltinGame(prompt: string): BuiltinGame | null {
  const p = prompt.toLowerCase();
  if (/\b(flappy|flap)\b/.test(p))              return 'flappy';
  if (/\bsnake\b/.test(p))                       return 'snake';
  if (/\bpong\b/.test(p))                        return 'pong';
  if (/\b(breakout|brick|arkanoid|break\s*out)\b/.test(p)) return 'breakout';
  return null;
}
