import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signOut,
} from 'firebase/auth';
import { ref, set } from 'firebase/database';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, realtimeDB } from '../src/config/firebaseConfig';

export default function RegisterScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Trạng thái chờ người dùng bấm link trong Gmail
  const [isWaitingVerification, setIsWaitingVerification] = useState(false);

  const handleRegister = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password || !confirmPassword) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ tất cả các trường.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Mật khẩu yếu', 'Mật khẩu phải có độ dài ít nhất 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Không khớp', 'Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Tạo tài khoản Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      // 2. Gửi link xác nhận về Gmail
      await sendEmailVerification(user);

      setIsWaitingVerification(true);
      Alert.alert(
        'Đã gửi email xác nhận ✉️',
        `Hệ thống đã gửi liên kết kích hoạt đến ${cleanEmail}.\nVui lòng mở Gmail và bấm vào liên kết để hoàn tất đăng ký!`
      );
    } catch (error: any) {
      console.log('Lỗi đăng ký:', error);
      let msg = 'Không thể tạo tài khoản. Vui lòng thử lại!';
      if (error.code === 'auth/email-already-in-use') {
        msg = 'Email này đã được sử dụng bởi một tài khoản khác.';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'Địa chỉ Email không đúng định dạng.';
      }
      Alert.alert('Đăng ký thất bại', msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Người dùng bấm kiểm tra sau khi đã click link trong Gmail
  const handleCheckVerified = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Lỗi', 'Phiên đăng ký hết hạn. Vui lòng thử lại từ đầu.');
      setIsWaitingVerification(false);
      return;
    }

    setIsLoading(true);
    try {
      await user.reload(); // Cập nhật lại trạng thái từ máy chủ Firebase

      if (user.emailVerified) {
        // Khởi tạo node User trên Firebase Realtime
        const userRef = ref(realtimeDB, `SmartHelmet/Users/${user.uid}`);
        await set(userRef, {
          email: user.email,
          created_at: Date.now(),
          devices: {},
        });

        Alert.alert('Thành công 🎉', 'Xác thực tài khoản thành công! Vui lòng đăng nhập.', [
          {
            text: 'Đăng nhập ngay',
            onPress: async () => {
              await signOut(auth);
              router.replace('/login');
            },
          },
        ]);
      } else {
        Alert.alert(
          'Chưa xác thực',
          'Tài khoản chưa được kích hoạt. Bạn hãy mở hòm thư Gmail và bấm vào đường link xác nhận nhé!'
        );
      }
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể kiểm tra trạng thái xác thực.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        await sendEmailVerification(user);
        Alert.alert('Đã gửi lại', 'Email xác nhận mới đã được gửi vào hòm thư của bạn.');
      } catch (e) {
        Alert.alert('Thông báo', 'Vui lòng đợi vài phút trước khi yêu cầu gửi lại.');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>

          <View style={styles.headerContainer}>
            <Ionicons
              name={isWaitingVerification ? 'mail-open' : 'shield-checkmark'}
              size={70}
              color="#007AFF"
            />
            <Text style={styles.title}>
              {isWaitingVerification ? 'XÁC THỰC EMAIL' : 'ĐĂNG KÝ TÀI KHOẢN'}
            </Text>
            <Text style={styles.subtitle}>
              {isWaitingVerification
                ? `Kiểm tra hộp thư ${email} để kích hoạt`
                : 'Tạo tài khoản chính chủ bảo vệ mũ bảo hiểm'}
            </Text>
          </View>

          {!isWaitingVerification ? (
            /* FORM NHẬP THÔNG TIN ĐĂNG KÝ */
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Địa chỉ Gmail chính chủ"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.inputGroup}>
                <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Mật khẩu (ít nhất 6 ký tự)"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Ionicons name="shield-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Xác nhận lại mật khẩu"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.primaryButtonText}>GỬI EMAIL XÁC THỰC</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* GIAO DIỆN CHỜ XÁC NHẬN LINK TRONG GMAIL */
            <View style={styles.waitingContainer}>
              <Text style={styles.instructionText}>
                Chúng tôi đã gửi một đường liên kết xác thực đến hòm thư của bạn. Vui lòng mở Gmail, nhấn vào liên kết đó rồi bấm nút dưới đây để tiếp tục.
              </Text>

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                onPress={handleCheckVerified}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.primaryButtonText}>TÔI ĐÃ BẤM XÁC THỰC</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={handleResendEmail}>
                <Text style={styles.secondaryButtonText}>Gửi lại thư xác nhận</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ marginTop: 20 }}
                onPress={() => setIsWaitingVerification(false)}
              >
                <Text style={{ color: '#666', textAlign: 'center' }}>Nhập lại Email khác</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Đã có tài khoản? </Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={styles.loginLink}>Đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scrollContent: { paddingHorizontal: 25, paddingBottom: 30 },
  backBtn: { marginTop: 10, width: 40, height: 40, justifyContent: 'center' },
  headerContainer: { alignItems: 'center', marginTop: 15, marginBottom: 30 },
  title: { fontSize: 24, fontWeight: '900', color: '#1A1A1A', marginTop: 12, letterSpacing: 0.5 },
  subtitle: { fontSize: 13, color: '#666', marginTop: 6, textAlign: 'center', paddingHorizontal: 15 },
  formContainer: { width: '100%' },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 15,
    paddingHorizontal: 15,
    height: 54,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#333' },
  eyeIcon: { padding: 5 },
  primaryButton: {
    backgroundColor: '#007AFF',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    elevation: 2,
  },
  buttonDisabled: { backgroundColor: '#99C8FF', elevation: 0 },
  primaryButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold', letterSpacing: 0.5 },
  waitingContainer: { width: '100%', alignItems: 'center' },
  instructionText: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    backgroundColor: '#EAF3FF',
    padding: 16,
    borderRadius: 12,
  },
  secondaryButton: {
    marginTop: 15,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#007AFF', fontWeight: '700', fontSize: 14 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 35 },
  footerText: { fontSize: 14, color: '#666' },
  loginLink: { fontSize: 14, color: '#007AFF', fontWeight: 'bold' },
});