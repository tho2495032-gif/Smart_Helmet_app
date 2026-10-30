import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Theme = { card: string; text: string; border: string };
type Props = {
  visible: boolean;
  name: string;
  saving: boolean;
  isDark: boolean;
  theme: Theme;
  onChangeName: (name: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

export default function RenameModal({ visible, name, saving, isDark, theme, onChangeName, onCancel, onSave }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.title, { color: theme.text }]}>Äá»•i tÃªn nÃ³n</Text>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? '#2A2A2A' : '#FAFAFA' }]}
            value={name}
            onChangeText={onChangeName}
            placeholder="TÃªn má»›i..."
            placeholderTextColor="#888"
          />
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelText}>Há»¦Y</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={onSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>LÆ¯U</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', borderRadius: 18, padding: 20, elevation: 6 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  input: { height: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 14 },
  buttons: { flexDirection: 'row', marginTop: 18, gap: 10 },
  cancelButton: { flex: 1, height: 44, backgroundColor: '#EEE', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontWeight: '700', color: '#666' },
  saveButton: { flex: 1, height: 44, backgroundColor: '#007AFF', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  saveText: { fontWeight: '700', color: '#FFF' },
});
