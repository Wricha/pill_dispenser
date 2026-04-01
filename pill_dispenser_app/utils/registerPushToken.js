// utils/registerPushToken.js
import * as Notifications from 'expo-notifications';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { API_BASE_URL } from './apiConfig';

export const registerPushToken = async () => {
    try {
        // 1. Ask permission
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
            console.warn('Push notification permission denied');
            return;
        }

        // 2. Get the real Expo push token
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
            console.error('No projectId found in app.json. Add it under extra.eas.projectId');
            return;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData.data;
        console.log('Real Expo push token:', token); // copy this and test it

        // 3. Save to backend
        const accessToken = await AsyncStorage.getItem('accessToken');
        await axios.post(
            `${API_BASE_URL}/api/save-push-token/`,
            { expo_push_token: token },
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        console.log('Token saved to backend successfully');

    } catch (e) {
        console.error('registerPushToken failed:', e);
    }
};