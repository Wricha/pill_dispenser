import axios from 'axios';
import { getStoredBaseUrl, setStoredBaseUrl, DEFAULT_API_URL } from './storage';

// Create a centralized axios instance
export const api = axios.create({
  baseURL: DEFAULT_API_URL,
});

// Initialize the baseURL from storage as soon as possible
getStoredBaseUrl().then(url => {
  api.defaults.baseURL = url;
});

// Helper to update the baseURL globally at runtime
export const updateBaseUrl = async (newUrl: string) => {
  api.defaults.baseURL = newUrl;
  await setStoredBaseUrl(newUrl);
};

// Endpoints (Relative paths)
export const MEDICATIONS_PATH = '/api/medications/';
export const TOKEN_REFRESH_PATH = '/api/token/refresh/';
export const LOGIN_PATH = '/api/token/';
export const REGISTER_PATH = '/api/register/';
export const PRESCRIPTION_PROCESS_PATH = '/api/prescriptions/process/';

// For code that still needs the raw string, we'll export a function
export const getBaseUrl = () => api.defaults.baseURL || DEFAULT_API_URL;
