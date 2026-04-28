import React from 'react';
import { ScrollView, TextInput, View } from 'react-native';

export function BottomSheetModalProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function BottomSheetBackdrop() {
  return null;
}

export function BottomSheetView({
  children,
  ...props
}: React.ComponentProps<typeof View>) {
  return <View {...props}>{children}</View>;
}

export const BottomSheetModal = React.forwardRef(function MockBottomSheetModal(
  {
    children,
    footerComponent: FooterComponent,
    onDismiss,
  }: {
    children: React.ReactNode;
    footerComponent?: React.ComponentType<any>;
    onDismiss?: () => void;
  },
  ref: React.ForwardedRef<{
    dismiss: () => void;
    present: () => void;
  }>,
) {
  const [open, setOpen] = React.useState(false);

  React.useImperativeHandle(ref, () => ({
    present: () => setOpen(true),
    dismiss: () => {
      setOpen(false);
      onDismiss?.();
    },
  }), [onDismiss]);

  if (!open) return null;

  return (
    <View data-rn="BottomSheetModal">
      {children}
      {FooterComponent ? <FooterComponent animatedFooterPosition={{ get: () => 0 }} /> : null}
    </View>
  );
});

export const BottomSheetScrollView = React.forwardRef(function MockBottomSheetScrollView(
  {
    children,
    ...props
  }: React.ComponentProps<typeof ScrollView>,
  ref: React.ForwardedRef<ScrollView>,
) {
  return <ScrollView ref={ref} {...props}>{children}</ScrollView>;
});

export const BottomSheetTextInput = TextInput;

export function BottomSheetFooter({
  children,
  animatedFooterPosition: _animatedFooterPosition,
  ...props
}: React.ComponentProps<typeof View> & {
  animatedFooterPosition?: unknown;
}) {
  return <View {...props}>{children}</View>;
}

export default function BottomSheet({ children }: { children: React.ReactNode }) {
  return <View>{children}</View>;
}
