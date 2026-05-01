import { useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';

const W = Dimensions.get('window').width - 40;
const H = 120;

const DINO_X = 48;
const DINO_W = 24;
const DINO_H = 30;

const CACTUS_W = 15;

const FPS = 30;
const TICK_MS = 1000 / FPS;
const GRAVITY = 1.5;
const JUMP_V = -17;
const BASE_SPEED = 4.5;
const MAX_SPEED = 10;

type Cactus = { x: number; h: number };

type GS = {
  dinoY: number;
  vy: number;
  jumping: boolean;
  cacti: Cactus[];
  score: number;
  speed: number;
  dead: boolean;
  tick: number;
  nextIn: number;
};

function freshState(): GS {
  return {
    dinoY: 0, vy: 0, jumping: false,
    cacti: [], score: 0, speed: BASE_SPEED,
    dead: false, tick: 0, nextIn: 55,
  };
}

export function DinoGame() {
  const gs = useRef<GS>(freshState());
  const [, setFrame] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const wantJump = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    gs.current = freshState();

    timerRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      const s = gs.current;
      if (s.dead) return;

      s.tick++;
      s.score = Math.floor((s.tick / FPS) * 8);
      s.speed = Math.min(MAX_SPEED, BASE_SPEED + s.tick * 0.005);

      // Jump input
      if (wantJump.current && !s.jumping) {
        s.vy = JUMP_V;
        s.jumping = true;
        wantJump.current = false;
      }

      // Physics
      if (s.jumping || s.dinoY > 0) {
        s.vy += GRAVITY;
        s.dinoY -= s.vy;
        if (s.dinoY <= 0) { s.dinoY = 0; s.vy = 0; s.jumping = false; }
      }

      // Move & cull cacti
      s.cacti = s.cacti
        .map(c => ({ ...c, x: c.x - s.speed }))
        .filter(c => c.x > -CACTUS_W - 4);

      // Spawn
      s.nextIn--;
      if (s.nextIn <= 0) {
        s.cacti.push({ x: W + 4, h: 28 + Math.floor(Math.random() * 22) });
        s.nextIn = Math.floor(36 + Math.random() * 48);
      }

      // Collision (3px forgiveness)
      const dL = DINO_X + 3, dR = DINO_X + DINO_W - 3;
      const dTop = GROUND_PX - s.dinoY - DINO_H + 4;
      const dBot = GROUND_PX - s.dinoY;
      for (const c of s.cacti) {
        if (dR > c.x + 2 && dL < c.x + CACTUS_W - 2 && dBot > GROUND_PX - c.h + 2 && dTop < GROUND_PX) {
          s.dead = true;
          break;
        }
      }

      setFrame(f => f + 1);
    }, TICK_MS);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const s = gs.current;
  const legPhase = Math.floor(s.tick / 5) % 2 === 0;

  const handlePress = () => {
    if (s.dead) {
      gs.current = freshState();
      setFrame(f => f + 1);
    } else {
      wantJump.current = true;
    }
  };

  return (
    <Pressable onPress={handlePress} style={styles.outer}>
      <View style={styles.area}>
        {/* Score */}
        <Text style={styles.score}>{String(s.score).padStart(5, '0')}</Text>

        {/* Dino body */}
        <View style={[styles.dino, { left: DINO_X, bottom: GROUND_OFFSET + s.dinoY }]}>
          <View style={styles.dinoEye} />
          <View style={styles.dinoMouth} />
        </View>

        {/* Dino legs (solo quando a terra) */}
        {!s.jumping && s.dinoY === 0 && (
          <>
            <View style={[styles.leg, { left: DINO_X + 5, bottom: GROUND_OFFSET - 6, opacity: legPhase ? 1 : 0.3 }]} />
            <View style={[styles.leg, { left: DINO_X + 13, bottom: GROUND_OFFSET - 6, opacity: legPhase ? 0.3 : 1 }]} />
          </>
        )}

        {/* Cacti */}
        {s.cacti.map((c, i) => (
          <View key={i} style={[styles.cactus, { left: c.x, height: c.h, bottom: GROUND_OFFSET }]}>
            <View style={[styles.cactusArm, { top: Math.floor(c.h * 0.35), left: -7 }]} />
            <View style={[styles.cactusArm, { top: Math.floor(c.h * 0.45), right: -7 }]} />
          </View>
        ))}

        {/* Ground */}
        <View style={styles.ground} />

        {/* Dust particles while running */}
        {!s.jumping && s.dinoY === 0 && s.tick % 3 === 0 && (
          <View style={[styles.dust, { left: DINO_X - 4, bottom: GROUND_OFFSET - 2 }]} />
        )}

        {/* Game over */}
        {s.dead && (
          <View style={styles.overlay}>
            <Text style={styles.deadText}>GAME OVER</Text>
            <Text style={styles.restartText}>tocca per ricominciare</Text>
          </View>
        )}

        {/* Initial hint */}
        {s.tick < 20 && !s.dead && (
          <Text style={styles.hint}>tocca per saltare</Text>
        )}
      </View>
    </Pressable>
  );
}

const GROUND_OFFSET = 16;
const GROUND_PX = H - GROUND_OFFSET;

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: 20,
    marginTop: 14,
  },
  area: {
    width: W,
    height: H,
    backgroundColor: '#07101f',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e3352',
    overflow: 'hidden',
  },
  score: {
    position: 'absolute',
    top: 10,
    right: 14,
    color: '#2d4464',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    letterSpacing: 2,
  },
  dino: {
    position: 'absolute',
    width: DINO_W,
    height: DINO_H,
    backgroundColor: '#6366f1',
    borderRadius: 5,
    borderTopRightRadius: 10,
  },
  dinoEye: {
    position: 'absolute',
    top: 5,
    right: 4,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  dinoMouth: {
    position: 'absolute',
    bottom: 6,
    right: 4,
    width: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  leg: {
    position: 'absolute',
    width: 5,
    height: 8,
    backgroundColor: '#4f46e5',
    borderRadius: 2,
  },
  cactus: {
    position: 'absolute',
    width: CACTUS_W,
    backgroundColor: '#34d399',
    borderRadius: 3,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  cactusArm: {
    position: 'absolute',
    width: 10,
    height: 6,
    backgroundColor: '#34d399',
    borderRadius: 3,
  },
  ground: {
    position: 'absolute',
    bottom: GROUND_OFFSET,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#1e3352',
  },
  dust: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1e3352',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(7,16,31,0.75)',
  },
  deadText: {
    color: '#f87171',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 3,
  },
  restartText: {
    color: '#2d4464',
    fontSize: 11,
    letterSpacing: 1,
  },
  hint: {
    position: 'absolute',
    bottom: GROUND_OFFSET + 8,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#1e3352',
    fontSize: 11,
  },
});
