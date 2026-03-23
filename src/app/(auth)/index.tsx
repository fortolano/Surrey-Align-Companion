import React, { useState, useRef, useEffect } from 'react';
import { webShadow } from '@/lib/web-styles';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  Keyboard,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useAuth } from '@/lib/auth-context';
import Colors from '@/constants/colors';
import { WEB_TOP_INSET, WEB_BOTTOM_INSET } from '@/constants/layout';

// On web (especially iOS Safari), Animated.View with entry animations creates
// CSS transform layers that block touch/focus events on native <input> elements.
// Use plain View on web for containers that hold TextInputs.
const FormCard = Platform.OS === 'web' ? View : Animated.View;

export default function LoginScreen() {
  const { isLoading, login } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  // Prevent iOS standalone PWA from auto-focusing the first input on load
  useEffect(() => {
    if (Platform.OS === 'web') {
      const timer = setTimeout(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: Colors.brand.primary }]}>
        <ActivityIndicator size="large" color={Colors.brand.white} />
      </View>
    );
  }

  const handleLogin = async () => {
    Keyboard.dismiss();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    const result = await login(email.trim(), password);
    if (!result.success) {
      setError(result.message || 'Login failed.');
    }
    setSubmitting(false);
  };

  const webTopInset = WEB_TOP_INSET;

  return (
    <View style={[styles.container, { backgroundColor: Colors.brand.primary }]}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + webTopInset + 35,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? WEB_BOTTOM_INSET : 20),
          },
        ]}
        bottomOffset={40}
      >
        <Animated.View entering={FadeIn.duration(600)} style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Image
              source={require('../../assets/images/surreyalign-compass.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.appName}>SurreyALIGN</Text>
          <Text style={styles.subtitle}>Leadership Companion</Text>
        </Animated.View>

        <FormCard
          {...(Platform.OS !== 'web' ? { entering: FadeInDown.duration(500).delay(200) } : {})}
          style={styles.formCard}
        >
          <Text style={styles.welcomeText}>Welcome back</Text>
          <Text style={styles.instructionText}>
            Use your SurreyALIGN credentials
          </Text>

          {!!error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={Colors.brand.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={Colors.brand.midGray} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="your.email@example.com"
                placeholderTextColor={Colors.brand.midGray}
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={false}
                autoComplete="off"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!submitting}
                testID="email-input"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.brand.midGray} style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={[styles.input, { flex: 1 }]}
                placeholder="Enter your password"
                placeholderTextColor={Colors.brand.midGray}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(''); }}
                secureTextEntry={!showPassword}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                editable={!submitting}
                testID="password-input"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={Colors.brand.midGray}
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={submitting}
            style={({ pressed }) => [
              styles.loginButton,
              pressed && !submitting && styles.loginButtonPressed,
              submitting && styles.loginButtonDisabled,
            ]}
            testID="login-button"
          >
            {submitting ? (
              <ActivityIndicator size="small" color={Colors.brand.white} />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </Pressable>
        </FormCard>

        <Animated.View entering={FadeIn.duration(400).delay(500)} style={styles.footer}>
          <Text style={styles.footerText}>
            Surrey British Columbia Stake
          </Text>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.brand.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...webShadow('#000', 0, 4, 0.15, 12),
    elevation: 6,
  },
  logoImage: {
    width: 56,
    height: 56,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.brand.white,
    letterSpacing: 0.5,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
  },
  formCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 20,
    padding: 24,
    ...webShadow('#000', 0, 8, 0.12, 24),
    elevation: 8,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.brand.black,
    marginBottom: 4,
    fontFamily: 'Inter_700Bold',
  },
  instructionText: {
    fontSize: 14,
    color: Colors.brand.darkGray,
    marginBottom: 20,
    fontFamily: 'Inter_400Regular',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.errorLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 15,
    color: Colors.brand.error,
    flex: 1,
    fontFamily: 'Inter_500Medium',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.brand.dark,
    marginBottom: 6,
    fontFamily: 'Inter_600SemiBold',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.offWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.brand.black,
    fontFamily: 'Inter_400Regular',
  },
  loginButton: {
    backgroundColor: Colors.brand.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    ...webShadow(Colors.brand.primary, 0, 4, 0.3, 8),
    elevation: 4,
  },
  loginButtonPressed: {
    backgroundColor: Colors.brand.primaryDark,
    transform: [{ scale: 0.98 }],
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.brand.white,
    fontFamily: 'Inter_600SemiBold',
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_400Regular',
  },
});
