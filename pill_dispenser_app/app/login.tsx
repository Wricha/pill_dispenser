import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOGIN_ENDPOINT } from '../utils/apiConfig';
import { registerPushToken } from '../utils/registerPushToken';

// ── No named export — default only, required by Expo Router ──────────────────
const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Validation Error', 'Please enter both username and password.');
      return;
    }

    console.log('=== LOGIN STARTED ===');
    console.log('Endpoint:', LOGIN_ENDPOINT);
    setLoading(true);

    try {
      console.log('Making API call...');
      const res = await axios.post(LOGIN_ENDPOINT, { username, password });
      console.log('Login Response:', res.status, res.data);

      const token = res.data.access;
      const refreshToken = res.data.refresh;
      const userId = res.data.user_id;

      if (!token) throw new Error("Access token not received from server.");

      await AsyncStorage.setItem('accessToken', token);
      await AsyncStorage.setItem('refreshToken', refreshToken || '');
      if (userId) await AsyncStorage.setItem('userId', String(userId));

      console.log('Tokens saved. Registering push token...');

      try {
        await registerPushToken();
        console.log('Push token registered successfully');
      } catch (notifError) {
        console.warn("Push notification registration failed:", notifError);
      }

      console.log('Navigating to tabs...');
      router.replace("/(tab)");

    } catch (error) {
      console.error("Login error:", error.response?.data || error.message);

      let errorMessage = 'An error occurred. Please try again.';
      if (error.message === 'Network Error') {
        errorMessage = 'Cannot connect to server.\n\nMake sure:\n• You are on WiFi\n• Server is running';
      } else if (error.response?.status === 401) {
        errorMessage = 'Invalid username or password.';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data) {
        errorMessage = JSON.stringify(error.response.data);
      }

      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progressContainer}>
        <View style={styles.progressStep}>
          <View style={[styles.progressDot, styles.activeDot]} />
          <View style={styles.progressLine} />
        </View>
        <View style={styles.progressStep}>
          <View style={styles.progressDot} />
          <View style={styles.progressLine} />
        </View>
        <View style={styles.progressStep}>
          <View style={styles.progressDot} />
        </View>
      </View>

      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Login</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color="rgba(255,255,255,0.6)" />
          <TextInput
            style={styles.input}
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            placeholderTextColor="rgba(255,255,255,0.8)"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="rgba(255,255,255,0.6)" />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            placeholderTextColor="rgba(255,255,255,0.8)"
            secureTextEntry
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.continueButton, loading && styles.disabledButton]}
        onPress={onLogin}
        disabled={loading}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.continueText}>Login</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/signup')}>
        <Text style={styles.signupLinkText}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#CC7755",
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
  },
  progressStep: { flexDirection: "row", alignItems: "center" },
  progressDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.3)", marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: "rgba(255,255,255,0.9)", width: 12, height: 12, borderRadius: 6,
  },
  progressLine: { height: 1, width: 80, backgroundColor: "rgba(255,255,255,0.5)" },
  headerContainer: { marginBottom: 40, alignItems: "center" },
  headerText: { color: "white", fontSize: 24, fontWeight: "600", letterSpacing: 1 },
  formContainer: { width: "100%", marginBottom: 30 },
  inputContainer: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 25,
    paddingHorizontal: 20, paddingVertical: 12, marginBottom: 15,
  },
  input: { flex: 1, color: "white", marginLeft: 10, fontSize: 16 },
  continueButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 25, paddingVertical: 15, alignItems: "center",
    marginBottom: 20, minHeight: 50, justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  continueText: { color: "white", fontSize: 16, fontWeight: "500" },
  signupLinkText: {
    color: 'white', textAlign: 'center', marginTop: 15,
    fontWeight: '500', textDecorationLine: 'underline',
  },
});

export default Login;