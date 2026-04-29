import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  type LayoutChangeEvent,
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
const TICKER_DURATION_MS = {
  left: 30000,
  right: 34000,
} as const;
const MOTIF_LINE_DELAY_MS = 600;
const MOTIF_LINE_DRAW_MS = 8800;
const HERO_MARK_DELAY_MS = 850;
const HERO_MARK_RISE_MS = 1100;
const DOT_REVEAL_MS = 900;
const MOTIF_DOT_DELAYS_MS = [1800, 4500, 7200, 10000] as const;

function BrandMark({ variant = 'small' }: { variant?: 'small' | 'hero' }) {
  return (
    <View
      style={[styles.brandMark, variant === 'hero' ? styles.brandMarkHero : null]}
      accessibilityLabel="Steady"
    >
      <Text style={[styles.brandText, variant === 'hero' ? styles.brandTextHero : null]}>
        Steady
      </Text>
      <View style={[styles.brandDots, variant === 'hero' ? styles.brandDotsHero : null]}>
        <View style={[styles.brandDot, variant === 'hero' ? styles.brandDotHero : null, { backgroundColor: '#2B4570' }]} />
        <View style={[styles.brandDot, variant === 'hero' ? styles.brandDotHero : null, { backgroundColor: '#BC4749' }]} />
        <View style={[styles.brandDot, variant === 'hero' ? styles.brandDotHero : null, { backgroundColor: '#8A7EBE' }]} />
        <View style={[styles.brandDot, variant === 'hero' ? styles.brandDotHero : null, { backgroundColor: '#D4A373' }]} />
        <View style={[styles.brandDot, variant === 'hero' ? styles.brandDotHero : null, { backgroundColor: '#2D5A47' }]} />
      </View>
    </View>
  );
}

function TickerGroup({ items, onLayout }: { items: string[]; onLayout?: (event: LayoutChangeEvent) => void }) {
  return (
    <View style={styles.tickerGroup} onLayout={onLayout}>
      {items.map((item, index) => (
        <Text key={`${item}-${index}`} style={styles.tickerText}>
          {item}
        </Text>
      ))}
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
  const [loopWidth, setLoopWidth] = useState(360);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(0);
      return undefined;
    }

    progress.setValue(0);
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: TICKER_DURATION_MS[direction],
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [direction, loopWidth, progress, reducedMotion]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: direction === 'left' ? [0, -loopWidth] : [-loopWidth, 0],
  });

  return (
    <View style={[styles.tickerRow, direction === 'left' ? styles.tickerTop : styles.tickerBottom]}>
      <Animated.View style={[styles.tickerTrack, { transform: [{ translateX }] }]}>
        <TickerGroup
          items={items}
          onLayout={(event) => {
            const nextWidth = event.nativeEvent.layout.width;
            if (nextWidth > 0) {
              setLoopWidth(nextWidth);
            }
          }}
        />
        <TickerGroup items={items} />
      </Animated.View>
    </View>
  );
}

function StagedDot({
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

  useEffect(() => {
    if (reducedMotion) {
      pop.setValue(1);
      return undefined;
    }

    const popAnimation = Animated.timing(pop, {
      toValue: 1,
      duration: DOT_REVEAL_MS,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    popAnimation.start();
    return () => {
      popAnimation.stop();
    };
  }, [delay, pop, reducedMotion]);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const opacity = pop;

  return (
    <Animated.View
      style={[
        styles.stagedDot,
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
      duration: MOTIF_LINE_DRAW_MS,
      delay: MOTIF_LINE_DELAY_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    Animated.timing(textRise, {
      toValue: 1,
      duration: HERO_MARK_RISE_MS,
      delay: HERO_MARK_DELAY_MS,
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
        <StagedDot color={C.navy} left={35} top={207} delay={MOTIF_DOT_DELAYS_MS[0]} />
        <StagedDot color={C.clay} left={105} top={142} delay={MOTIF_DOT_DELAYS_MS[1]} />
        <StagedDot color={C.amber} left={183} top={220} delay={MOTIF_DOT_DELAYS_MS[2]} />
        <StagedDot color={C.forest} left={267} top={164} delay={MOTIF_DOT_DELAYS_MS[3]} />

        <Animated.View
          style={[
            styles.heroMarkWrap,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <BrandMark variant="hero" />
        </Animated.View>

      </View>
      <TickerRow items={TICKER_BOTTOM} direction="right" />
    </View>
  );
}

export function WelcomeFrontDoor({ onAuthenticated }: WelcomeFrontDoorProps) {
  const { session, signInWithGoogle, isLoading } = useAuth();
  const [step, setStep] = useState<WelcomeStep>('welcome');
  const [submitting, setSubmitting] = useState(false);
  const busy = isLoading || submitting;

  async function handleGoogleSignIn() {
    if (session) {
      onAuthenticated();
      return;
    }

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
            <View style={styles.betaChip}>
              <View style={styles.betaDot} />
              <Text style={styles.betaText}>Beta</Text>
            </View>
          </View>

          <TrainingMotif />

          <View style={styles.welcomeIntro}>
            <Text style={styles.title}>
              Bring your{'\n'}
              <Text style={styles.titleEmphasis}>own plan.</Text>
            </Text>
            <Text style={styles.copy}>Build the training, sync the runs, adapt and track.</Text>
          </View>

          <View style={styles.welcomeActions}>
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
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  brandMark: {
    width: 112,
    gap: 2,
  },
  brandMarkHero: {
    width: 188,
    alignItems: 'center',
    gap: 4,
  },
  brandText: {
    fontFamily: FONTS.serif,
    fontSize: 32,
    fontStyle: 'italic',
    lineHeight: 34,
    color: C.ink,
  },
  brandTextHero: {
    fontSize: 54,
    lineHeight: 58,
  },
  brandDots: {
    flexDirection: 'row',
    gap: 4,
    paddingLeft: 2,
  },
  brandDotsHero: {
    gap: 7,
    paddingLeft: 0,
  },
  brandDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  brandDotHero: {
    width: 7,
    height: 7,
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
    marginTop: 22,
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
  },
  tickerGroup: {
    flexDirection: 'row',
    gap: 18,
    paddingRight: 18,
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
  stagedDot: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 999,
  },
  heroMarkWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 44,
    alignItems: 'center',
  },
  welcomeIntro: {
    marginTop: 14,
    alignItems: 'center',
  },
  welcomeActions: {
    marginTop: 'auto',
    paddingTop: 26,
    paddingBottom: 20,
  },
  title: {
    maxWidth: 330,
    fontFamily: FONTS.serifBold,
    fontSize: 37,
    lineHeight: 38,
    color: C.ink,
    textAlign: 'center',
  },
  titleEmphasis: {
    color: C.forest,
    fontStyle: 'italic',
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
