import { api, LOGIN_PATH, REGISTER_PATH, getBaseUrl } from '../utils/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
export const registerUser = async (username, email, password, passwordConfirmation) => {

  try {
    const response = await api.post(REGISTER_PATH, { 
      username,
      email,
      password,
      confirm_password : passwordConfirmation
    });

    return response.data;

  } catch (error) {
    console.error("Registration API error:", error.response?.data || error.message);
    throw error.response ? error.response.data : new Error('Network error during registration');
  }
};

export const loginUser = async (username, password) => {

  try {
    const loginResponse = await api.post(LOGIN_PATH, {
       username,
       password
     });

    if (loginResponse.data.access) {
      const tokenToSave = loginResponse.data.access;
      console.log("Attempting to save token via loginUser:", tokenToSave);
      await AsyncStorage.setItem('accessToken', tokenToSave);
      console.log("Token saved successfully via loginUser!");

      const userId = loginResponse.data.user_id; 

      if (userId) {

           console.log("Attempting to save userId:", userId);

           await AsyncStorage.setItem('userId', String(userId)); // Save as string

           console.log("UserId saved successfully!");

      } else {

           console.warn("User ID not found in login response. Cannot save userId.");

           // If userId is essential, you might need to fetch user details separately here

           // Or modify the backend to include it in the login response.

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



// Keep getUserDetails, ensure Authorization header matches backend (Token vs Bearer/JWT)

export const getUserDetails = async () => {

  try {

    const token = await AsyncStorage.getItem('accessToken'); // Retrieve stored token

    if (!token) {

        throw new Error('No access token found');

    }

    // ** CHECK if user detail endpoint is relative to API_URL **

    // Example assuming it's /api/auth/user/ - Note: URL used is API_URL + user/
    const response = await api.get('user/', { // Relative to baseURL
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return response.data;

  } catch (error) {

    console.error("Get User Details API error:", error.response?.data || error.message);

     if (error.response && (error.response.status === 401 || error.response.status === 403)) {

        // Handle unauthorized access, maybe clear token and prompt login

        await AsyncStorage.removeItem('accessToken');

        // await AsyncStorage.removeItem('refreshToken'); // Consider removing refresh token too if applicable

     }

    throw error.response ? error.response.data : new Error('Network error fetching user details');

  }

};