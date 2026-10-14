import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../src/config/firebaseConfig';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleResetPassword = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      Alert.alert('Lỗi', 'Vui lòng nhập địa chỉ Gmail tài khoản của bạn.');
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setIsSent(true);
      Alert.alert(
        'Đã gửi liên kết ✉️',
        `Hệ thống đã gửi đường link đặt lại mật khẩu đến: ${cleanEmail}.\nVui lòng mở Gmail để tạo mật khẩu mới!`
      );
    } catch (error: any) {
      console.log('Reset pass error:', error);
      let msg = 'Không thể gửi email đặt lại mật khẩu. Vui lòng kiểm tra lại!';
      if (error.code === 'auth/user-not-found') {
        msg = 'Không tìm thấy tài khoản nào khớp với Email này.';
      }
      Alert.alert('Thất bại', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, paddingHorizontal: 25 }}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>

        <View style={styles.headerContainer}>
          <Ionicons name="key-outline" size={70} color="#007AFF" />
          <Text style={styles.title}>QUÊN MẬT KHẨU</Text>
          <Text style={styles.subtitle}>
            Nhập Gmail tài khoản của bạn để nhận liên kết khôi phục mật khẩu từ Firebase
          </Text>
        </View>

        {!isSent ? (
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Địa chỉ Gmail đăng ký"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.primaryButtonText}>GỬI LIÊN KẾT ĐẶT LẠI MẬT KHẨU</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.sentContainer}>
            <Ionicons name="checkmark-circle" size={60} color="#34C759" />
            <Text style={styles.sentTitle}>Đã gửi thư thành công!</Text>
            <Text style={styles.sentDesc}>
              Kiểm tra hộp thư đến (hoặc hòm thư Spam) của <Text style={{ fontWeight: 'bold' }}>{email}</Text> để đổi mật khẩu mới.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace('/login')}
            >
              <Text style={styles.primaryButtonText}>QUAY LẠI ĐĂNG NHẬP</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  backBtn: { marginTop: 10, width: 40, height: 40, justifyContent: 'center' },
  headerContainer: { alignItems: 'center', marginTop: 25, marginBottom: 35 },
  title: { fontSize: 24, fontWeight: '900', color: '#1A1A1A', marginTop: 12 },
  subtitle: { fontSize: 13, color: '#666', marginTop: 8, textAlign: 'center', lineHeight: 20, paddingHorizontal: 15 },
  formContainer: { width: '100%' },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 15,
    height: 54,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#333' },
  primaryButton: {
    backgroundColor: '#007AFF',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    width: '100%',
  },
  buttonDisabled: { backgroundColor: '#99C8FF' },
  primaryButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  sentContainer: { alignItems: 'center', paddingHorizontal: 10 },
  sentTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 12, color: '#222' },
  sentDesc: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 8, marginBottom: 25, lineHeight: 20 },
});