import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, MEDICATIONS_ENDPOINT, TOKEN_REFRESH_ENDPOINT, LOGIN_ENDPOINT, REGISTER_ENDPOINT } from './apiConfig';

export const registerUser = async (username, email, password, passwordConfirmation) => {
  try {
    const response = await axios.post(REGISTER_ENDPOINT, {
      username,
      email,
      password,
      confirm_password: passwordConfirmation
    });
    return response.data;
  } catch (error) {
    console.error("Registration API error:", error.response?.data || error.message);
    throw error.response ? error.response.data : new Error('Network error during registration');
  }
};

export const loginUser = async (username, password) => {
  try {
    const loginResponse = await axios.post(LOGIN_ENDPOINT, {
      username,
      password
    });
    if (loginResponse.data.access) {
      const tokenToSave = loginResponse.data.access;
      await AsyncStorage.setItem('accessToken', tokenToSave);
      const userId = loginResponse.data.user_id;
      if (userId) {
        await AsyncStorage.setItem('userId', String(userId));
      }
    } else {
      throw new Error('Access token not received');
    }
    return loginResponse.data;
  } catch (error) {
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
    const response = await axios.get(`${API_BASE_URL}user/`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error("Get User Details API error:", error.response?.data || error.message);
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      await AsyncStorage.removeItem('accessToken');
    }
    throw error.response ? error.response.data : new Error('Network error fetching user details');
  }
};
