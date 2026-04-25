import React, { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Dimensions, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { C } from '../../constants/colours';

interface GorhomSheetProps {
  open: boolean;
  children: ReactNode;
  onDismiss: () => void;
  backgroundColor?: string;
  backgroundStyle?: StyleProp<ViewStyle>;
  maxHeightRatio?: number;
  backdropOpacity?: number;
  enablePanDownToClose?: boolean;
  keyboardBehavior?: 'extend' | 'fillParent' | 'interactive';
  wrapContent?: boolean;
  footer?: ReactNode;
}

export function GorhomSheet({
  open,
  children,
  onDismiss,
  backgroundColor = C.surface,
  backgroundStyle,
  maxHeightRatio = 0.9,
  backdropOpacity = 0.6,
  enablePanDownToClose = true,
  keyboardBehavior = 'interactive',
  wrapContent = true,
  footer,
}: GorhomSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const maxDynamicContentSize = useMemo(
    () => Math.floor(Dimensions.get('window').height * maxHeightRatio),
    [maxHeightRatio],
  );

  useEffect(() => {
    if (open) {
      sheetRef.current?.present();
    }
  }, [open]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={backdropOpacity}
        pressBehavior="close"
        style={[props.style, styles.backdrop]}
      />
    ),
    [backdropOpacity],
  );
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props}>{footer}</BottomSheetFooter>
    ),
    [footer],
  );

  if (!open) {
    return null;
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.sheetBackground, { backgroundColor }, backgroundStyle]}
      enableDynamicSizing
      enablePanDownToClose={enablePanDownToClose}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handle}
      keyboardBehavior={keyboardBehavior}
      keyboardBlurBehavior="restore"
      footerComponent={footer ? renderFooter : undefined}
      maxDynamicContentSize={maxDynamicContentSize}
      onDismiss={onDismiss}
    >
      {wrapContent ? <BottomSheetView style={styles.content}>{children}</BottomSheetView> : children}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: C.ink,
  },
  sheetBackground: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  content: {
    width: '100%',
  },
  handle: {
    paddingTop: 10,
    paddingBottom: 4,
  },
  handleIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
  },
});
