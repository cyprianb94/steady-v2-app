import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useAuth } from '../../lib/auth';
import { Btn } from '../ui/Btn';

type WelcomeStep = 'welcome' | 'account';

interface WelcomeFrontDoorProps {
  onAuthenticated: () => void;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const TICKER_TOP = ['BASE', '08KM', '5:30/KM', 'TEMPO', '10KM', '4:20/KM', 'LONG', '22KM'];
const TICKER_BOTTOM = ['ADAPT', 'BUILD', 'PEAK', 'TAPER', 'SYNCED', 'PLANNED', 'ACTUAL'];

function BrandMark() {
  return (
    <View style={styles.brandMark} accessibilityLabel="Steady">
      <Text style={styles.brandText}>Steady</Text>
      <View style={styles.brandDots}>
        <View style={[styles.brandDot, { backgroundColor: '#2B4570' }]} />
        <View style={[styles.brandDot, { backgroundColor: '#BC4749' }]} />
        <View style={[styles.brandDot, { backgroundColor: '#8A7EBE' }]} />
        <View style={[styles.brandDot, { backgroundColor: '#D4A373' }]} />
        <View style={[styles.brandDot, { backgroundColor: '#2D5A47' }]} />
      </View>
    </View>
  );
}

function TickerRow({
  items,
  direction,
}: {
  items: string[];
  direction: 'left' | 'right';
}) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(direction === 'left' ? 0 : 1)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(direction === 'left' ? 0 : 1);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: direction === 'left' ? 1 : 0,
        duration: direction === 'left' ? 15000 : 17000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [direction, progress, reducedMotion]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: direction === 'left' ? [0, -220] : [-220, 0],
  });
  const repeated = [...items, ...items, ...items, ...items];

  return (
    <View style={[styles.tickerRow, direction === 'left' ? styles.tickerTop : styles.tickerBottom]}>
      <Animated.View style={[styles.tickerTrack, { transform: [{ translateX }] }]}>
        {repeated.map((item, index) => (
          <Text key={`${item}-${index}`} style={styles.tickerText}>
            {item}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

function PulseDot({
  color,
  left,
  top,
  delay,
}: {
  color: string;
  left: number;
  top: number;
  delay: number;
}) {
  const reducedMotion = useReducedMotion();
  const pop = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      pop.setValue(1);
      pulse.setValue(0);
      return undefined;
    }

    const popAnimation = Animated.timing(pop, {
      toValue: 1,
      duration: 520,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    const pulseAnimation = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2100,
        delay: delay + 650,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    popAnimation.start();
    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, [delay, pop, pulse, reducedMotion]);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const opacity = pop;

  return (
    <Animated.View
      style={[
        styles.pulseDot,
        {
          backgroundColor: color,
          left,
          top,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

function TrainingMotif() {
  const reducedMotion = useReducedMotion();
  const draw = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const textRise = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      draw.setValue(1);
      textRise.setValue(1);
      return;
    }

    Animated.timing(draw, {
      toValue: 1,
      duration: 1300,
      delay: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    Animated.timing(textRise, {
      toValue: 1,
      duration: 620,
      delay: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [draw, reducedMotion, textRise]);

  const dashOffset = draw.interpolate({ inputRange: [0, 1], outputRange: [430, 0] });
  const textOpacity = textRise;
  const textTranslateY = textRise.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <View style={styles.stage} accessibilityLabel="Animated Steady training motif">
      <TickerRow items={TICKER_TOP} direction="left" />
      <View style={styles.kineticCore}>
        <Svg width={306} height={180} viewBox="0 0 306 180" style={styles.kineticLine}>
          <Path
            d="M34 124C72 72 98 50 126 61C165 76 164 141 205 137C239 134 254 86 278 80"
            fill="none"
            stroke={C.border}
            strokeWidth={1.3}
          />
          <AnimatedPath
            d="M34 124C72 72 98 50 126 61C165 76 164 141 205 137C239 134 254 86 278 80"
            fill="none"
            stroke={C.ink}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeDasharray={430}
            strokeDashoffset={dashOffset}
            opacity={0.5}
          />
        </Svg>
        <PulseDot color={C.navy} left={35} top={207} delay={650} />
        <PulseDot color={C.clay} left={105} top={142} delay={790} />
        <PulseDot color={C.amber} left={183} top={220} delay={930} />
        <PulseDot color={C.forest} left={267} top={164} delay={1070} />

        <Animated.View
          style={[
            styles.typeStack,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <Text style={styles.kickerLine}>16W · 48KM · 3:30</Text>
          <Text style={styles.bigWord}>Block</Text>
        </Animated.View>

        <View style={styles.wordRow}>
          <Text style={styles.wordChip}>Build</Text>
          <Text style={styles.wordChip}>Sync</Text>
          <Text style={styles.wordChip}>Adapt</Text>
        </View>
      </View>
      <TickerRow items={TICKER_BOTTOM} direction="right" />
    </View>
  );
}

export function WelcomeFrontDoor({ onAuthenticated }: WelcomeFrontDoorProps) {
  const { signInWithGoogle, isLoading } = useAuth();
  const [step, setStep] = useState<WelcomeStep>('welcome');
  const [submitting, setSubmitting] = useState(false);
  const busy = isLoading || submitting;

  async function handleGoogleSignIn() {
    try {
      setSubmitting(true);
      const session = await signInWithGoogle();
      if (session) {
        onAuthenticated();
      }
    } catch (error) {
      Alert.alert('Google sign-in failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {step === 'welcome' ? (
        <View style={styles.welcomeScreen}>
          <View style={styles.top}>
            <BrandMark />
            <View style={styles.betaChip}>
              <View style={styles.betaDot} />
              <Text style={styles.betaText}>Beta</Text>
            </View>
          </View>

          <TrainingMotif />

          <View style={styles.welcomeCopy}>
            <Text style={styles.title}>Bring your own plan.</Text>
            <Text style={styles.copy}>Build the training, sync the runs, adapt and track.</Text>
            <View style={styles.buttonRows}>
              <Btn
                title="Get started"
                fullWidth
                onPress={() => setStep('account')}
              />
              <Btn
                title="Sign in"
                variant="secondary"
                fullWidth
                onPress={() => setStep('account')}
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.accountScreen}>
          <View>
            <Text style={[styles.title, styles.accountTitle]}>Create your account.</Text>
            <Text style={[styles.copy, styles.accountCopy]}>
              Save your plan before you build it. This account keeps your block, settings, and Strava sync attached to you.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                void handleGoogleSignIn();
              }}
              style={({ pressed }) => [
                styles.googleButton,
                pressed && !busy ? styles.buttonPressed : null,
                busy ? styles.buttonDisabled : null,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={C.clay} />
              ) : (
                <>
                  <View style={styles.googleMark}>
                    <Text style={styles.googleMarkText}>G</Text>
                  </View>
                  <Text style={styles.googleText}>Continue with Google</Text>
                </>
              )}
            </Pressable>
          </View>

          <Text style={styles.footnote}>
            Already have an account?{' '}
            <Text
              style={styles.signInLink}
              onPress={() => {
                if (!busy) {
                  void handleGoogleSignIn();
                }
              }}
            >
              Sign in with Google
            </Text>
            .
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 82,
    paddingBottom: 20,
  },
  welcomeScreen: {
    flex: 1,
  },
  accountScreen: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 28,
    paddingBottom: 5,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 2,
  },
  brandMark: {
    width: 112,
    gap: 2,
  },
  brandText: {
    fontFamily: FONTS.serif,
    fontSize: 32,
    fontStyle: 'italic',
    lineHeight: 34,
    color: C.ink,
  },
  brandDots: {
    flexDirection: 'row',
    gap: 4,
    paddingLeft: 2,
  },
  brandDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  betaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: `${C.navy}3D`,
    borderRadius: 999,
    backgroundColor: C.navyBg,
  },
  betaDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: C.navy,
  },
  betaText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.navy,
  },
  stage: {
    position: 'relative',
    height: 410,
    marginTop: 25,
    overflow: 'hidden',
  },
  tickerRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 22,
    overflow: 'hidden',
  },
  tickerTop: {
    top: 48,
  },
  tickerBottom: {
    bottom: 14,
  },
  tickerTrack: {
    flexDirection: 'row',
    gap: 18,
  },
  tickerText: {
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    color: 'rgba(61, 48, 40, 0.25)',
  },
  kineticCore: {
    position: 'absolute',
    left: '50%',
    top: 64,
    width: 320,
    height: 318,
    transform: [{ translateX: -160 }],
  },
  kineticLine: {
    position: 'absolute',
    left: 7,
    right: 7,
    top: 100,
  },
  pulseDot: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 999,
  },
  typeStack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 42,
    alignItems: 'center',
  },
  kickerLine: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    color: C.muted,
  },
  bigWord: {
    marginTop: 0,
    fontFamily: FONTS.serifBold,
    fontSize: 50,
    lineHeight: 52,
    color: C.ink,
  },
  wordRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 250,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  wordChip: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 999,
    backgroundColor: C.surface,
    fontFamily: FONTS.monoBold,
    fontSize: 10.5,
    color: C.ink2,
  },
  welcomeCopy: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingBottom: 2,
  },
  title: {
    maxWidth: 330,
    fontFamily: FONTS.serifBold,
    fontSize: 31,
    lineHeight: 34,
    color: C.ink,
    textAlign: 'center',
  },
  accountTitle: {
    textAlign: 'left',
  },
  copy: {
    maxWidth: 320,
    marginTop: 9,
    marginBottom: 20,
    fontFamily: FONTS.sans,
    fontSize: 14,
    lineHeight: 21,
    color: C.ink2,
    textAlign: 'center',
  },
  accountCopy: {
    maxWidth: 318,
    textAlign: 'left',
  },
  buttonRows: {
    width: '100%',
    gap: 10,
  },
  googleButton: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  googleMark: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleMarkText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
    color: '#4285F4',
  },
  googleText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.ink,
  },
  footnote: {
    marginTop: 14,
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: C.muted,
    textAlign: 'center',
  },
  signInLink: {
    fontFamily: FONTS.sansSemiBold,
    color: C.ink,
  },
});
