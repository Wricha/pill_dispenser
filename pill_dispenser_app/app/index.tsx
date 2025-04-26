import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import React from "react";
import { useRouter } from "expo-router";
import { useFonts } from "expo-font";

const Index = () => {
  const router = useRouter();
  
  const onSignUp = () => {
    router.navigate("/signup");
  };
  
  const onLogIn = () => {
    router.navigate("/login");
  };
  
  return (
    <View style={styles.container}>
      {/* Path Logo */}
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>
          <Text style={styles.logoP}>M</Text>edimate
        </Text>
        <Text style={styles.tagline}>A dose of care</Text>
      </View>
      
      {/* Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.signUpButton} onPress={onSignUp}>
          <Text style={styles.signUpText}>Sign Up</Text>
        </TouchableOpacity>
        
        <Text style={styles.accountText}>Already have an account?</Text>
        
        <TouchableOpacity style={styles.logInButton} onPress={onLogIn}>
          <Text style={styles.logInText}>Log In</Text>
        </TouchableOpacity>
      </View>
      
      
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#CC7755", // Path's red color
    justifyContent: "space-between",
    padding: 20,
  },
  logoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    color: "white",
    fontSize: 48,
    fontWeight: "300", // Lighter weight to match Path's logo
    fontFamily: "System",
    letterSpacing: -1, // Tighter letter spacing
  },
  logoP: {
    fontWeight: "500", // Make the 'P' slightly bolder as in the image
    fontStyle: "italic", // Add slight italics to match the 'P' in Path logo
  },
  tagline: {
    color: "white",
    fontSize: 16,
    marginTop: 5,
    fontWeight: "300", // Lighter weight for tagline
    letterSpacing: 0.5, // Slightly spaced letters for tagline
  },
  buttonContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 40,
  },
  signUpButton: {
    backgroundColor: "white",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 4,
    width: "100%",
    alignItems: "center",
    marginBottom: 15,
  },
  signUpText: {
    color: "#F03C22",
    fontSize: 16,
    fontWeight: "500",
  },
  accountText: {
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 10,
    fontSize: 14,
  },
  logInButton: {
    borderColor: "rgba(255, 255, 255, 0.8)",
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 4,
    width: "100%",
    alignItems: "center",
  },
  logInText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  termsContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  termsText: {
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    fontSize: 12,
  },
  linkText: {
    textDecorationLine: "underline",
  },
});

export default Index;