import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, REGISTER_PATH, LOGIN_PATH } from './apiConfig';

export const registerUser = async (username: any, email: any, password: any, passwordConfirmation: any) => {
  try {
    const response = await api.post(REGISTER_PATH, {
      username,
      email,
      password,
      confirm_password: passwordConfirmation
    });
    return response.data;
  } catch (error: any) {
    console.error("Registration API error:", error.response?.data || error.message);
    throw error.response ? error.response.data : new Error('Network error during registration');
  }
};

export const loginUser = async (username: any, password: any) => {
  try {
    const loginResponse = await api.post(LOGIN_PATH, {
      username,
      password
    });
    if (loginResponse.data.access) {
      await AsyncStorage.setItem('accessToken', loginResponse.data.access);
      if (loginResponse.data.refresh) {
        await AsyncStorage.setItem('refreshToken', loginResponse.data.refresh);
      }
      const userId = loginResponse.data.user_id;
      if (userId) {
        await AsyncStorage.setItem('userId', String(userId));
      }
    } else {
      throw new Error('Access token not received');
    }
    return loginResponse.data;
  } catch (error: any) {
    console.error("Login API error:", error.response?.data || error.message);
    throw error.response ? error.response.data : new Error('Network error during login');
  }
};

export const getUserDetails = async () => {
  try {
    const token = await AsyncStorage.getItem('accessToken');
    if (!token) {
      throw new Error('No access token found');
    }
    const response = await api.get('/api/user/', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error: any) {
    console.error("Get User Details API error:", error.response?.data || error.message);
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      await AsyncStorage.removeItem('accessToken');
    }
    throw error.response ? error.response.data : new Error('Network error fetching user details');
  }
};
