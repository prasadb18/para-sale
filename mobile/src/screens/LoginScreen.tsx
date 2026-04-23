import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import * as AppleAuthentication from 'expo-apple-authentication'
import { useNavigation, CommonActions } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import useAuthStore from '../store/authStore'
import { supabase } from '../lib/supabase'
import { RootStackParamList } from '../navigation'

type Nav = NativeStackNavigationProp<RootStackParamList>

WebBrowser.maybeCompleteAuthSession()

type Mode = 'signin' | 'signup' | 'forgot' | 'otp-entry' | 'otp-verify'

async function createSessionFromUrl(url: string) {
  const hashParams = new URLSearchParams(url.split('#')[1] ?? '')
  const accessToken  = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')
  if (!accessToken) return
  await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken ?? '' })
}

function goHome(navigation: Nav) {
  navigation.dispatch(
    CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] })
  )
}

export default function LoginScreen() {
  const navigation = useNavigation<Nav>()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone]       = useState('')
  const [otp, setOtp]           = useState('')
  const [mode, setMode]         = useState<Mode>('signin')
  const [resetSent, setResetSent] = useState(false)

  const [loading, setLoading]         = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [appleLoading, setAppleLoading]   = useState(false)
  const [otpLoading, setOtpLoading]       = useState(false)

  const { signIn, signUp } = useAuthStore()

  // ── Email / Password ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your email and password.')
      return
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    if (mode === 'signin') {
      const { error } = await signIn(email.trim(), password)
      if (error) Alert.alert('Sign In Failed', 'Incorrect email or password.')
      else goHome(navigation)
    } else {
      const { error } = await signUp(email.trim(), password)
      if (error) {
        Alert.alert('Sign Up Failed', (error as { message?: string }).message || 'Could not create account.')
      } else {
        goHome(navigation)
      }
    }
    setLoading(false)
  }

  // ── Forgot password ──────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Enter your email first', 'Type your email above then tap send.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    setLoading(false)
    if (error) Alert.alert('Error', error.message)
    else setResetSent(true)
  }

  // ── Google OAuth ─────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    try {
      const redirectTo = makeRedirectUri({ scheme: 'com.parasale.shopstore', path: 'auth/callback' })
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      })
      if (error || !data?.url) throw error ?? new Error('No URL')
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
      if (result.type === 'success') {
        await createSessionFromUrl(result.url)
        goHome(navigation)
      }
    } catch {
      Alert.alert('Google Sign-In Failed', 'Please try again.')
    } finally {
      setGoogleLoading(false)
    }
  }

  // ── Apple Sign-In ────────────────────────────────────────────────────
  const handleAppleSignIn = async () => {
    setAppleLoading(true)
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      })
      const idToken = credential.identityToken
      if (!idToken) throw new Error('No identity token')
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: idToken,
      })
      if (error) throw error
      goHome(navigation)
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple Sign-In Failed', 'Please try again.')
      }
    } finally {
      setAppleLoading(false)
    }
  }

  // ── OTP: send ────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    const target = email.trim()
    if (!target) { Alert.alert('Enter your email', 'Type your email to receive the OTP.'); return }
    setOtpLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email: target })
    setOtpLoading(false)
    if (error) { Alert.alert('Error', error.message); return }
    setMode('otp-verify')
  }

  // ── OTP: verify ──────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otp.length < 6) { Alert.alert('Enter the 6-digit code', 'Check your email for the code.'); return }
    setOtpLoading(true)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp, type: 'email' })
    setOtpLoading(false)
    if (error) Alert.alert('Invalid Code', 'The code was wrong or expired. Try sending again.')
    else goHome(navigation)
  }

  // ── Divider ──────────────────────────────────────────────────────────
  const Divider = () => (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or</Text>
      <View style={styles.dividerLine} />
    </View>
  )

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>1ShopStore</Text>
          <Text style={styles.subtitle}>
            {mode === 'signin'     ? 'Sign in to your account'    :
             mode === 'signup'     ? 'Create a new account'       :
             mode === 'forgot'     ? 'Reset your password'        :
             mode === 'otp-entry'  ? 'Sign in with OTP'           :
             'Enter the code we sent'}
          </Text>

          {/* ── OTP verify screen ── */}
          {mode === 'otp-verify' ? (
            <>
              <Text style={styles.otpHint}>A 6-digit code was sent to <Text style={{ fontWeight: '700' }}>{email}</Text></Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="• • • • • •"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
              />
              <TouchableOpacity style={styles.button} onPress={handleVerifyOtp} disabled={otpLoading}>
                {otpLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify Code</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.link} onPress={() => setMode('otp-entry')}>
                <Text style={styles.linkText}>← Resend code</Text>
              </TouchableOpacity>
            </>
          ) : mode === 'otp-entry' ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="you@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.button} onPress={handleSendOtp} disabled={otpLoading}>
                {otpLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Code</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.link} onPress={() => setMode('signin')}>
                <Text style={styles.linkText}>← Back to sign in</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* ── Social buttons ── */}
              <TouchableOpacity style={styles.socialBtn} onPress={handleGoogleSignIn} disabled={googleLoading}>
                {googleLoading
                  ? <ActivityIndicator color="#374151" />
                  : <><Text style={styles.socialIcon}>G</Text><Text style={styles.socialText}>Continue with Google</Text></>
                }
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity style={[styles.socialBtn, styles.appleBtn]} onPress={handleAppleSignIn} disabled={appleLoading}>
                  {appleLoading
                    ? <ActivityIndicator color="#fff" />
                    : <><Text style={[styles.socialIcon, { color: '#fff' }]}></Text><Text style={[styles.socialText, { color: '#fff' }]}>Continue with Apple</Text></>
                  }
                </TouchableOpacity>
              )}

              <Divider />

              {/* ── Email/password form ── */}
              <TextInput
                style={styles.input}
                placeholder="you@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              {mode !== 'forgot' && (
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
              )}

              {mode === 'forgot' ? (
                resetSent ? (
                  <View style={styles.resetDone}>
                    <Text style={styles.resetDoneText}>✅ Reset link sent! Check your inbox.</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.button} onPress={handleForgotPassword} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Reset Link</Text>}
                  </TouchableOpacity>
                )
              ) : (
                <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>}
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.link} onPress={() => setMode('otp-entry')}>
                <Text style={styles.linkText}>Sign in with OTP (no password)</Text>
              </TouchableOpacity>

              {mode === 'signin' && (
                <TouchableOpacity style={styles.link} onPress={() => { setMode('forgot'); setResetSent(false) }}>
                  <Text style={styles.linkText}>Forgot password?</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.link}
                onPress={() => setMode(mode === 'signup' ? 'signin' : mode === 'forgot' ? 'signin' : 'signup')}
              >
                <Text style={styles.linkText}>
                  {mode === 'signin'  ? "Don't have an account? Sign up" :
                   mode === 'signup'  ? 'Already have an account? Sign in' :
                   '← Back to sign in'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 28,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  title:    { fontSize: 26, fontWeight: '700', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 20 },

  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    paddingVertical: 13, marginBottom: 10, backgroundColor: '#fff', gap: 10,
  },
  appleBtn:   { backgroundColor: '#000', borderColor: '#000' },
  socialIcon: { fontSize: 16, fontWeight: '900', color: '#374151' },
  socialText: { fontSize: 15, fontWeight: '600', color: '#374151' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: '#9ca3af' },

  input: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 16,
    marginBottom: 14, backgroundColor: '#f9fafb', color: '#111827',
  },
  otpInput:  { fontSize: 28, letterSpacing: 12, fontWeight: '700' },
  otpHint:   { fontSize: 14, color: '#6b7280', marginBottom: 16, lineHeight: 20 },

  button: {
    backgroundColor: '#0c64c0', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginBottom: 4,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  link:     { marginTop: 12, alignItems: 'center' },
  linkText: { color: '#0c64c0', fontSize: 14 },

  resetDone: {
    backgroundColor: '#f0fdf4', borderRadius: 10, padding: 14,
    marginBottom: 4, borderWidth: 1, borderColor: '#a5d6a7',
  },
  resetDoneText: { fontSize: 14, color: '#2e7d32', lineHeight: 20 },
})
