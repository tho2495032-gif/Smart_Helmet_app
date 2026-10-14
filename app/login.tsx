import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
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

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const savedRemember = await AsyncStorage.getItem('rememberMe');
        const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');

        if (isLoggedIn === 'true' && savedRemember === 'true') {
          router.replace('/(tabs)');
        } else {
          setIsCheckingSession(false);
        }
      } catch (error) {
        setIsCheckingSession(false);
      }
    };

    checkLoginStatus();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ email và mật khẩu!');
      return;
    }

    setIsLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Kiểm tra xem email đã được xác thực chưa
      if (!user.emailVerified) {
        Alert.alert(
          'Chưa xác thực Email',
          'Tài khoản này chưa được bấm vào liên kết kích hoạt trong Gmail. Vui lòng kiểm tra hòm thư của bạn!'
        );
        setIsLoading(false);
        return;
      }

      await AsyncStorage.setItem('rememberMe', rememberMe ? 'true' : 'false');
      await AsyncStorage.setItem('isLoggedIn', 'true');
      await AsyncStorage.setItem('userEmail', email.trim());
      await AsyncStorage.setItem('userUid', user.uid);

      router.replace('/(tabs)');
    } catch (error: any) {
      console.log('Login error:', error);
      Alert.alert('Đăng nhập thất bại', 'Sai email hoặc mật khẩu. Vui lòng kiểm tra lại!');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Đang tải hệ thống...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.headerContainer}>
          <Ionicons name="shield-checkmark" size={75} color="#007AFF" />
          <Text style={styles.title}>SMART HELMET</Text>
          <Text style={styles.subtitle}>Hệ thống giám sát an toàn thông minh</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email đăng nhập"
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
              placeholder="Mật khẩu"
              placeholderTextColor="#999"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <Ionicons
                name={rememberMe ? 'checkbox' : 'square-outline'}
                size={22}
                color={rememberMe ? '#007AFF' : '#666'}
              />
              <Text style={styles.rememberText}>Ghi nhớ đăng nhập</Text>
            </TouchableOpacity>

            {/* CHUYỂN SANG MÀN HÌNH QUÊN MẬT KHẨU */}
            <TouchableOpacity onPress={() => router.push('/forgot-password')}>
              <Text style={styles.forgotText}>Quên mật khẩu?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.loginButtonText}>ĐĂNG NHẬP</Text>
            )}
          </TouchableOpacity>

          {/* CHUYỂN SANG MÀN HÌNH ĐĂNG KÝ */}
          <View style={styles.registerRow}>
            <Text style={styles.noAccountText}>Chưa có tài khoản? </Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.registerLink}>Đăng ký ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  keyboardView: { flex: 1, justifyContent: 'center', paddingHorizontal: 25 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  loadingText: { marginTop: 15, fontSize: 15, color: '#666' },
  headerContainer: { alignItems: 'center', marginBottom: 35 },
  title: { fontSize: 26, fontWeight: '900', color: '#1A1A1A', marginTop: 12, letterSpacing: 1 },
  subtitle: { fontSize: 13, color: '#666', marginTop: 4 },
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
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    paddingHorizontal: 4,
  },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center' },
  rememberText: { marginLeft: 8, fontSize: 13, color: '#555', fontWeight: '500' },
  forgotText: { fontSize: 13, color: '#007AFF', fontWeight: '600' },
  loginButton: {
    backgroundColor: '#007AFF',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  loginButtonDisabled: { backgroundColor: '#99C8FF', elevation: 0 },
  loginButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold', letterSpacing: 1 },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 25 },
  noAccountText: { fontSize: 14, color: '#666' },
  registerLink: { fontSize: 14, color: '#007AFF', fontWeight: 'bold' },
});