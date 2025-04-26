import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from "react-native";
import React, {useState} from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { registerUser } from '../app/api_auth';

export const Signup = ({navigation}) => {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const onRegister = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    try {
      // Call the imported registerUser function
      const data = await registerUser(username, email, password, confirmPassword); // Pass confirmPassword

      console.log("Registration successful:", data); // Log success data
      Alert.alert('Success', 'User registered successfully');
      router.push("/login"); // Navigate to login after successful registration

    } catch (error) {
      console.error("Registration failed:", error); // Log the raw error
      let errorMessage = 'Registration failed. Please try again.';

      // Attempt to parse specific DRF validation errors
      if (typeof error === 'object' && error !== null) {
        const errorDetails = Object.entries(error).map(([field, messages]) =>
            `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`
        ).join('\n');
         if (errorDetails) {
           errorMessage = `Registration Failed:\n${errorDetails}`;
         } else if (error.detail) { 
            errorMessage = `Registration Failed: ${error.detail}`;
         }
      } else if (typeof error === 'string') {
         errorMessage = `Registration Failed: ${error}`; 
      }

      Alert.alert('Registration Failed', errorMessage);
    }
  };
  return (
    <SafeAreaView style={styles.container}>
      {/* Progress Indicator */}
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
        <Text style={styles.headerText}>CREATE ACCOUNT</Text>
      </View>
      
      {/* Form Fields */}
      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color="rgba(255,255,255,0.6)" />
          <TextInput
            style={styles.input}
            placeholder="Name"
            value={username}
            onChangeText={setUsername}
            placeholderTextColor="rgba(255,255,255,0.8)"
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={20} color="rgba(255,255,255,0.6)" />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            placeholderTextColor="rgba(255,255,255,0.8)"
            keyboardType="email-address"
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

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="rgba(255,255,255,0.6)" />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholderTextColor="rgba(255,255,255,0.8)"
            secureTextEntry
          />
        </View>
      </View>
      
      {/* Continue Button */}
      <TouchableOpacity style={styles.continueButton} onPress={onRegister}>
        <Text style={styles.continueText}>Continue</Text>
      </TouchableOpacity>
      
      {/* Terms & Conditions */}
      <TouchableOpacity style={styles.termsContainer}>
        <Text style={styles.termsText}>Terms & Conditions</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
    padding: 20,
    justifyContent: "space-between",
    // Gradient background simulated with a single color
    // For a real gradient, use a library like react-native-linear-gradient
    backgroundColor: "#CC7755",
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 30,
    marginBottom: 60,
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
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: 1,
  },
  formContainer: {
    width: "100%",
    marginBottom: 40,
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
  },
  continueText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  termsContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  termsText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },
});

export default Signup;