import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { SectionLabel } from '../ui/SectionLabel';
import { Btn } from '../ui/Btn';

interface GoalReassessmentProps {
  originalTarget: string;
  reassessedTarget?: string;
  isSaving?: boolean;
  onSave: (value: string) => Promise<void> | void;
}

export function GoalReassessment({
  originalTarget,
  reassessedTarget,
  isSaving = false,
  onSave,
}: GoalReassessmentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(reassessedTarget ?? '');

  useEffect(() => {
    setDraft(reassessedTarget ?? '');
  }, [reassessedTarget]);

  async function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }

    await onSave(trimmed);
    setIsEditing(false);
  }

  return (
    <View style={styles.container}>
      <SectionLabel>Goal Update</SectionLabel>

      {isEditing ? (
        <View>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="e.g. sub-3:35"
            placeholderTextColor={C.muted}
            style={styles.input}
            editable={!isSaving}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.buttonRow}>
            <Btn
              title="Cancel"
              variant="secondary"
              onPress={() => {
                setDraft(reassessedTarget ?? '');
                setIsEditing(false);
              }}
              disabled={isSaving}
            />
            <Btn title="Save" onPress={handleSave} disabled={isSaving || !draft.trim()} />
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setIsEditing(true)} style={styles.goalRow}>
          <Text style={styles.oldTarget}>{originalTarget}</Text>
          <Text style={styles.arrow}>→</Text>
          <View style={styles.newTargetWrap}>
            <Text style={styles.newTarget}>{reassessedTarget ?? 'Tap to reassess'}</Text>
            <Text style={styles.helper}>
              {reassessedTarget ? 'Tap to edit' : 'Set a temporary target during recovery'}
            </Text>
          </View>
          {isSaving && <ActivityIndicator size="small" color={C.clay} />}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  oldTarget: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: C.muted,
    textDecorationLine: 'line-through',
  },
  arrow: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: C.muted,
  },
  newTargetWrap: {
    flex: 1,
  },
  newTarget: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.clay,
  },
  helper: {
    marginTop: 3,
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: C.muted,
  },
  input: {
    borderWidth: 1.5,
    borderColor: `${C.clay}35`,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: C.ink,
  },
  buttonRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
});
