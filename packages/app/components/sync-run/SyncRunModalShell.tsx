import React, { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

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
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
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
          <ScrollView contentContainerStyle={styles.scrollContent}>{children}</ScrollView>
          {bottomBar}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(28,21,16,0.60)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
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
