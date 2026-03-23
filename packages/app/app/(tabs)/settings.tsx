import { View, Text, StyleSheet } from 'react-native';

export default function SettingsTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4EFE6', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '600', color: '#1C1510' },
});
