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
    onDismiss,
  }: {
    children: React.ReactNode;
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

  return <View data-rn="BottomSheetModal">{children}</View>;
});

export function BottomSheetScrollView({
  children,
  ...props
}: React.ComponentProps<typeof ScrollView>) {
  return <ScrollView {...props}>{children}</ScrollView>;
}

export const BottomSheetTextInput = TextInput;

export default function BottomSheet({ children }: { children: React.ReactNode }) {
  return <View>{children}</View>;
}
