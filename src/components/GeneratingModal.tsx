import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../i18n/useI18n';

const C = {
  bg: '#07101f',
  surface: '#111d30',
  border: '#1e3352',
  primary: '#6366f1',
  text: '#e2eaf6',
  muted: '#6a87ae',
  faint: '#2d4464',
};

const STEP_DELAYS = [0, 2200, 4500];

type StepState = 'pending' | 'active' | 'done';

function StepRow({
  label,
  state,
  last,
  badgePending,
  badgeActive,
  badgeDone,
}: {
  label: string;
  state: StepState;
  last?: boolean;
  badgePending: string;
  badgeActive: string;
  badgeDone: string;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (state === 'active') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
    if (state === 'done') {
      scaleAnim.setValue(0.6);
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 18 }).start();
    }
  }, [state]);

  const isDone = state === 'done';
  const isActive = state === 'active';

  return (
    <View style={[ls.stepRow, !last && ls.stepRowBorder]}>
      {!last && <View style={ls.connectorLine} />}

      <View style={ls.indicatorWrap}>
        {isDone ? (
          <Animated.View style={[ls.indicatorDone, { transform: [{ scale: scaleAnim }] }]}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </Animated.View>
        ) : isActive ? (
          <Animated.View style={[ls.indicatorActive, { opacity: pulseAnim }]} />
        ) : (
          <View style={ls.indicatorPending} />
        )}
      </View>

      <View style={ls.stepTextWrap}>
        <Text style={[ls.stepLabel, isDone && ls.stepLabelDone, isActive && ls.stepLabelActive]}>
          {label}
        </Text>
      </View>

      {isDone ? (
        <Text style={ls.stepBadgeDone}>{badgeDone}</Text>
      ) : isActive ? (
        <Text style={ls.stepBadgeActive}>{badgeActive}</Text>
      ) : (
        <Text style={ls.stepBadgePending}>{badgePending}</Text>
      )}
    </View>
  );
}

function OrbLoader() {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={[ls.orb, { transform: [{ rotate: spin }] }]}>
      <View style={ls.orbDot} />
    </Animated.View>
  );
}

export function GeneratingModal({
  visible,
  done,
  prompt,
}: {
  visible: boolean;
  done: boolean;
  prompt: string;
}) {
  const { t } = useI18n();
  const stepLabels = [t.genStep1, t.genStep2, t.genStep3];
  const [activeStep, setActiveStep] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (visible && !done) {
      setActiveStep(0);
      timers.current.forEach(clearTimeout);
      timers.current = [];
      STEP_DELAYS.forEach((delay, i) => {
        timers.current.push(setTimeout(() => setActiveStep(i), delay));
      });
    }
    if (done) {
      timers.current.forEach(clearTimeout);
      setActiveStep(stepLabels.length);
    }
    return () => timers.current.forEach(clearTimeout);
  }, [visible, done]);

  const stepState = (i: number): StepState => {
    if (activeStep > i) return 'done';
    if (activeStep === i) return 'active';
    return 'pending';
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <SafeAreaView style={ls.safe}>
        <StatusBar style="light" />
        <View style={ls.content}>
          <View style={ls.logoRow}>
            <OrbLoader />
            <Text style={ls.logoText}>AppFromAI</Text>
          </View>

          <Text style={ls.headline}>
            {done ? t.genModalDone : t.genModalBuilding}
          </Text>

          <View style={ls.promptPreview}>
            <Ionicons name="sparkles" size={13} color={C.muted} />
            <Text style={ls.promptPreviewText} numberOfLines={2}>{prompt}</Text>
          </View>

          <View style={ls.stepsCard}>
            {stepLabels.map((label, i) => (
              <StepRow
                key={i}
                label={label}
                state={stepState(i)}
                last={i === stepLabels.length - 1}
                badgePending={t.genStepPending}
                badgeActive={t.genStepActive}
                badgeDone={t.genStepDone}
              />
            ))}
          </View>

          {!done && <Text style={ls.hint}>{t.genHint}</Text>}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const ls = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32, gap: 24 },

  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  orb: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: C.primary,
    alignItems: 'center', justifyContent: 'flex-start',
  },
  orbDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary, marginTop: -4 },
  logoText: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.5 },

  headline: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.8, lineHeight: 34 },

  promptPreview: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: C.surface, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: C.border,
  },
  promptPreviewText: { flex: 1, color: C.muted, fontSize: 13, lineHeight: 19 },

  stepsCard: {
    backgroundColor: C.surface, borderRadius: 20,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },

  stepRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 18, gap: 14, position: 'relative',
  },
  stepRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  connectorLine: {
    position: 'absolute', left: 30, top: '50%', bottom: -18,
    width: 2, backgroundColor: C.border,
  },

  indicatorWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  indicatorPending: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.faint },
  indicatorActive: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: C.primary,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 8, elevation: 6,
  },
  indicatorDone: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#16a34a',
    alignItems: 'center', justifyContent: 'center',
  },

  stepTextWrap: { flex: 1 },
  stepLabel: { fontSize: 15, fontWeight: '500', color: C.faint },
  stepLabelActive: { color: C.text, fontWeight: '700' },
  stepLabelDone: { color: C.muted },

  stepBadgePending: { fontSize: 11, color: C.faint },
  stepBadgeActive: { fontSize: 11, color: C.primary, fontWeight: '600' },
  stepBadgeDone: { fontSize: 11, color: '#16a34a', fontWeight: '600' },

  hint: { color: C.faint, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
