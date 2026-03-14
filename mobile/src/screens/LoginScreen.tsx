import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { authApi } from '../services/authApi';
import { useAuthStore } from '../stores/authStore';

const LoginScreen = (): React.JSX.Element => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAuth = useAuthStore((s) => s.setAuth);

  const handleLogin = async (): Promise<void> => {
    if (!email.trim() || !password.trim()) {
      setError('请输入邮箱和密码');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await authApi.login(email.trim(), password);
      setAuth(result.user, result.accessToken, result.refreshToken);
      // Navigation is handled reactively by RootNavigator watching isLoggedIn
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : '登录失败，请检查账号密码';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <Text style={styles.appTitle}>中科琉光</Text>
        <Text style={styles.appSubtitle}>调研工具</Text>

        <View style={styles.form}>
          <Text style={styles.label}>邮箱</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="请输入邮箱"
            placeholderTextColor="#aaa"
            editable={!loading}
          />

          <Text style={styles.label}>密码</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="请输入密码"
            placeholderTextColor="#aaa"
            editable={!loading}
            onSubmitEditing={handleLogin}
          />

          {error !== null && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>登录</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4ff',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1a56db',
    letterSpacing: 2,
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 18,
    color: '#4a6fa5',
    marginBottom: 48,
  },
  form: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1a1a1a',
    backgroundColor: '#fafafa',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#e53e3e',
    marginBottom: 12,
    textAlign: 'center',
  },
  loginButton: {
    height: 50,
    backgroundColor: '#1a56db',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LoginScreen;
