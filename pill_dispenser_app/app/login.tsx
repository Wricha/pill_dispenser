import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from "react-native";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import axios from 'axios'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; // Need AsyncStorage for direct calls

export const Login = ({navigation}) => {

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false); // Local loading state is used
    const router = useRouter();

    const onLogin = async () => {

      setLoading(true); 
      try {
        const res = await axios.post('http://192.168.1.104:8000/auth/api/token/', { 
          username,
          password,
        });

        const token = res.data.access;
        const userId = res.data.user_id; // Adjust 'user_id' if the key name is different
        console.log('Login Response Data:', res.data); // Log the whole response to check
        console.log('Access Token:', token);
        console.log('User ID from response:', userId); // Log the extracted userId

        if (!token) {
            throw new Error("Access token not received from server.");
        }
        // Save token directly
        await AsyncStorage.setItem('accessToken', token);
        console.log("Token saved directly in Login.js");

        if (userId) {
           await AsyncStorage.setItem('userId', String(userId)); // Save userId as a string
           console.log("User ID saved directly in Login.js:", userId);
        } else {
           console.warn("User ID not found in login response. Cannot save userId.");
        }

        Alert.alert('Success', 'Logged in successfully!');
        router.push("/(tab)"); // Navigate

      } catch (error) {
         console.error("Login failed:", error.response?.data || error.message); // Log full error
         Alert.alert('Login Failed', error.response?.data?.detail || 'An error occurred. Try again.');
      } 
      finally {
         setLoading(false); // Stop loading
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

        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.headerText}>Login</Text>
        </View>

        {/* Form Fields */}
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

        {/* Continue Button */}

        <TouchableOpacity
          style={styles.continueButton} // Consider adding disabled styles based on 'loading' state
          onPress={onLogin}
          disabled={loading} // Disable button when loading
        >
          {/* You need to conditionally render Text or ActivityIndicator here based on 'loading' state */}
          {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
          ) : (
              <Text style={styles.continueText}>Login</Text>
          )}
        </TouchableOpacity>


        {/* Optional: Link to Signup - Added from previous context version */}
         <TouchableOpacity onPress={() => router.push('/signup')}>
           <Text style={styles.signupLinkText}>Don't have an account? Sign Up</Text>
         </TouchableOpacity>


      </SafeAreaView>

    );

  };



  const styles = StyleSheet.create({

    container: {

      flex: 1,

      // backgroundColor: "transparent", // Commented out from signup version
      padding: 20,

      justifyContent: "center", // Changed from space-between

      backgroundColor: "#CC7755",

    },

    progressContainer: {

      flexDirection: "row",

      justifyContent: "center",
      position: 'absolute', // Copied style from context version
      top: 60,
      left: 0,
      right: 0,
      // marginTop: 30, // Removed based on absolute positioning
      // marginBottom: 60, // Removed based on absolute positioning


    },

    progressStep: {

      flexDirection: "row",

      alignItems: "center",

    },

    progressDot: {

      width: 10,

      height: 10,

      borderRadius: 5,

      backgroundColor: "rgba(255,255,255,0.3)",

      marginHorizontal: 5,

    },

    activeDot: {

      backgroundColor: "rgba(255,255,255,0.9)",

      width: 12,

      height: 12,

      borderRadius: 6,

    },

    progressLine: {

      height: 1,

      width: 80,

      backgroundColor: "rgba(255,255,255,0.5)",

    },

    headerContainer: {

      marginBottom: 40,

      alignItems: "center",

    },

    headerText: {

      color: "white",

      fontSize: 24, // Changed from signup version

      fontWeight: "600",

      letterSpacing: 1,

    },

    formContainer: {

      width: "100%",

      marginBottom: 30, // Changed from signup version

    },

    inputContainer: {

      flexDirection: "row",

      alignItems: "center",

      backgroundColor: "rgba(255,255,255,0.2)",

      borderRadius: 25,

      paddingHorizontal: 20,

      paddingVertical: 12,

      marginBottom: 15,

    },

    input: {

      flex: 1,

      color: "white",

      marginLeft: 10,

      fontSize: 16,

    },

    continueButton: {

      backgroundColor: "rgba(255,255,255,0.1)",

      borderWidth: 1,

      borderColor: "rgba(255,255,255,0.3)",

      borderRadius: 25,

      paddingVertical: 15,

      alignItems: "center",

      marginBottom: 20,
      minHeight: 50, // Added from context version
      justifyContent: 'center', // Added from context version

    },
    // Added disabledButton style from context version for reference
    disabledButton: {
       backgroundColor: "rgba(255,255,255,0.05)",
       borderColor: "rgba(255,255,255,0.1)",
    },

    continueText: {

      color: "white",

      fontSize: 16,

      fontWeight: "500",

    },
    // Added signupLinkText style from context version
    signupLinkText: {
       color: 'white',
       textAlign: 'center',
       marginTop: 15,
       fontWeight: '500',
       textDecorationLine: 'underline'
     },

    // Removed termsContainer and termsText styles from signup version
    // termsContainer: { ... }
    // termsText: { ... }

  });

export default Login;