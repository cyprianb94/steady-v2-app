import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  deriveTrainingPaceProfile,
  type TrainingPaceProfileKey,
  normalizeTrainingPaceProfile,
  type TrainingPaceProfile,
} from '@steady/types';
import {
  scrollTrainingPaceProfileInputIntoView,
  TrainingPaceProfileEditor,
  TRAINING_PACE_PROFILE_INTRO,
} from '../../components/pace-profile/TrainingPaceProfileEditor';
import { Btn } from '../../components/ui/Btn';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { usePlan } from '../../hooks/usePlan';
import {
  getTrainingPaceProfile,
  saveTrainingPaceProfile,
} from '../../lib/plan-api';

function deriveProfileFromPlan(
  plan: ReturnType<typeof usePlan>['plan'],
): TrainingPaceProfile | null {
  if (!plan) {
    return null;
  }

  return deriveTrainingPaceProfile({
    raceDistance: plan.raceDistance,
    targetTime: plan.targetTime,
  });
}

export default function TrainingPacesScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { plan, loading, refresh } = usePlan();
  const fallbackProfile = useMemo(
    () => deriveProfileFromPlan(plan),
    [plan?.raceDistance, plan?.targetTime],
  );
  const [profile, setProfile] = useState<TrainingPaceProfile | null>(fallbackProfile);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;

    if (!fallbackProfile) {
      setProfile(null);
      setLoadingProfile(false);
      return () => {
        active = false;
      };
    }

    setLoadingProfile(true);
    getTrainingPaceProfile()
      .then((storedProfile) => {
        if (!active) {
          return;
        }
        setProfile(normalizeTrainingPaceProfile(storedProfile) ?? fallbackProfile);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        console.log('Failed to load training pace profile:', error);
        setProfile(fallbackProfile);
      })
      .finally(() => {
        if (active) {
          setLoadingProfile(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fallbackProfile]);

  async function handleSave() {
    const normalized = normalizeTrainingPaceProfile(profile);
    if (!normalized || saving) {
      return;
    }

    try {
      setSaving(true);
      const savedProfile = await saveTrainingPaceProfile(normalized);
      setProfile(normalizeTrainingPaceProfile(savedProfile) ?? normalized);
      setSaved(true);
      await refresh();
    } catch (error) {
      Alert.alert(
        'Could not save paces',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  const showEmpty = !loading && !loadingProfile && !profile;

  function keepInputVisible(profileKey: TrainingPaceProfileKey) {
    scrollTrainingPaceProfileInputIntoView(scrollRef, profileKey);
  }

  return (
    <KeyboardAvoidingView
      testID="training-paces-keyboard-frame"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 18,
            paddingBottom: insets.bottom + 112,
          },
        ]}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.backText}>‹ Settings</Text>
        </Pressable>

        {profile ? (
          <TrainingPaceProfileEditor
            title="Training paces"
            intro={TRAINING_PACE_PROFILE_INTRO}
            profile={profile}
            onChange={(nextProfile) => {
              setProfile(nextProfile);
              setSaved(false);
            }}
            onInputFocus={keepInputVisible}
          />
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {showEmpty ? 'No active plan' : 'Loading training paces'}
            </Text>
            <Text style={styles.emptyCopy}>
              {showEmpty
                ? 'Build a plan before setting training pace ranges.'
                : 'Reading the pace profile on your current plan.'}
            </Text>
          </View>
        )}

        {saved ? <Text style={styles.savedText}>Saved to your active plan.</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <Btn
          title={saving ? 'Saving paces...' : 'Save paces'}
          onPress={handleSave}
          fullWidth
          disabled={!profile || saving}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingRight: 10,
  },
  backText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: C.clay,
  },
  emptyCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  emptyTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 22,
    lineHeight: 27,
    color: C.ink,
  },
  emptyCopy: {
    marginTop: 6,
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 19,
    color: C.muted,
  },
  savedText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: C.forest,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    backgroundColor: C.cream,
    borderTopWidth: 1,
    borderTopColor: `${C.border}AA`,
  },
  pressed: {
    opacity: 0.82,
  },
});
