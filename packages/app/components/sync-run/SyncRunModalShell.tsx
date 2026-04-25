import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { GorhomSheet } from '../ui/GorhomSheet';

interface SyncRunModalShellProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  leftActionLabel?: string;
  rightActionLabel?: string;
  onRightAction?: () => void;
  rightActionDisabled?: boolean;
  children: ReactNode;
  bottomBar?: ReactNode;
}

export function SyncRunModalShell({
  visible,
  title,
  onClose,
  leftActionLabel = 'Back',
  rightActionLabel,
  onRightAction,
  rightActionDisabled = false,
  children,
  bottomBar,
}: SyncRunModalShellProps) {
  if (!visible) {
    return null;
  }

  return (
    <GorhomSheet open={visible} onDismiss={onClose} backgroundColor={C.surface} wrapContent={false}>
      <View style={styles.sheet}>
        <View style={styles.navBar}>
          <Pressable onPress={onClose} style={styles.navEdge}>
            <Text style={styles.navAction}>{leftActionLabel}</Text>
          </Pressable>
          <Text style={styles.navTitle}>{title}</Text>
          <Pressable
            disabled={!rightActionLabel || rightActionDisabled}
            onPress={onRightAction}
            style={styles.navEdge}
          >
            <Text
              style={[
                styles.navAction,
                styles.navActionPrimary,
                (!rightActionLabel || rightActionDisabled) && styles.navActionDisabled,
              ]}
            >
              {rightActionLabel ?? ''}
            </Text>
          </Pressable>
        </View>
        <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>{children}</BottomSheetScrollView>
        {bottomBar}
      </View>
    </GorhomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  navEdge: {
    minWidth: 56,
  },
  navAction: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.muted,
  },
  navActionPrimary: {
    textAlign: 'right',
    color: C.forest,
  },
  navActionDisabled: {
    color: C.border,
  },
  navTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 15,
    color: C.ink,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
});
