import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser, logoutUser, registerUser /*, getUserDetails */ } from '../utils/api_auth'; // Adjust path

// 1. Create Context
const AuthContext = createContext({
  isAuthenticated: false,
  user: null, // Will hold { id, username, email }
  token: null, // Access Token
  isLoading: true,
  isLoginLoading: false, // Added separate state for login operations
  login: async (username, password) => {},
  logout: async () => {},
  // register: async (...) => {}, // Add if needed
});

// 2. Create Provider Component
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoginLoading, setIsLoginLoading] = useState(false); // New state for login operations

  // Initial check on load
  useEffect(() => {
    const bootstrapAsync = async () => {
      let userToken = null;
      let storedUserData = null;
      try {
        userToken = await AsyncStorage.getItem('accessToken');
        const userDataString = await AsyncStorage.getItem('userData');
        if (userDataString) {
          storedUserData = JSON.parse(userDataString);
        }
        // Optional: Add token validation call to backend here if desired
      } catch (e) {
        console.error('Restoring auth state failed', e);
      }

      if (userToken) {
        setToken(userToken);
        setUser(storedUserData);
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    };
    bootstrapAsync();
  }, []);

  // Login implementation
  const login = async (username, password) => {
    setIsLoginLoading(true); // Set login-specific loading state
    try {
      const data = await loginUser(username, password); // Call API function

      const { access, refresh, user_id, username: loggedInUsername, email } = data;
      if (!access) { throw new Error('Login failed: No access token received.'); }

      const userData = { id: user_id, username: loggedInUsername, email };

      await AsyncStorage.setItem('accessToken', access);
      if (refresh) await AsyncStorage.setItem('refreshToken', refresh);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));

      setToken(access);
      setUser(userData);
      setIsAuthenticated(true);

      return data; // Return full data if component needs it
    } catch (error) {
      console.error('Login failed in AuthContext:', error);
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'userData']);
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      throw error; // Re-throw for component UI
    } finally {
      setIsLoginLoading(false); // Clear login loading state
    }
  };

  // Logout implementation
  const logout = async () => {
    setIsLoading(true);
    try {
      const storedRefreshToken = await AsyncStorage.getItem('refreshToken');
      if (storedRefreshToken) {
        await logoutUser(storedRefreshToken); // Call API function
         console.log("Backend logout call attempted.");
      } else {
          console.log("Skipping backend logout call, no refresh token found.");
      }
    } catch (apiError) {
      // Log error but proceed with local cleanup
      console.error("Backend logout call failed (continuing local logout):", apiError);
    }

    // ALWAYS clear local state and storage in finally block after try/catch
    finally {
        try {
            await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'userData']);
            setToken(null);
            setUser(null);
            setIsAuthenticated(false); // <-- State reset happens here!
            console.log("Local state and storage cleared for logout.");
        } catch (cleanupError) {
             console.error("Local logout cleanup failed:", cleanupError);
        } finally {
             setIsLoading(false);
             // Navigation reset must happen in the component
        }
    }
  };

  // Combine values for the provider
  const authContextValue = {
    isAuthenticated,
    user,
    token,
    isLoading,
    isLoginLoading, // Add the new login loading state
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for easy consumption
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};