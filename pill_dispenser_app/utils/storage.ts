import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL_KEY = '@api_base_url';
export const DEFAULT_API_URL = 'http://192.168.110.105:8000';

export const getStoredBaseUrl = async (): Promise<string> => {
  try {
    const value = await AsyncStorage.getItem(API_URL_KEY);
    if (value !== null) {
      return value;
    }
  } catch (e) {
    console.error('Error reading API URL from storage', e);
  }
  return DEFAULT_API_URL;
};

export const setStoredBaseUrl = async (url: string): Promise<void> => {
  try {
    // Add http:// if missing
    let formattedUrl = url.trim();
    if (formattedUrl && !formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `http://${formattedUrl}`;
    }
    // Remove trailing slash
    if (formattedUrl.endsWith('/')) {
      formattedUrl = formattedUrl.slice(0, -1);
    }
    await AsyncStorage.setItem(API_URL_KEY, formattedUrl);
  } catch (e) {
    console.error('Error saving API URL to storage', e);
  }
};
