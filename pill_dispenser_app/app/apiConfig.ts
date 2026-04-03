// apiConfig.ts
// Centralized API configuration for the app
import axios from 'axios';

// ── Skip ngrok browser warning for ALL requests ───────────────────────────────
axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';
axios.defaults.headers.common['Content-Type'] = 'application/json';

export const API_BASE_URL = "http://192.168.110.105:8000";
export const MEDICATIONS_ENDPOINT = `${API_BASE_URL}/api/medications/`;
export const TOKEN_REFRESH_ENDPOINT = `${API_BASE_URL}/api/token/refresh/`;
export const LOGIN_ENDPOINT = `${API_BASE_URL}/api/token/`;
export const REGISTER_ENDPOINT = `${API_BASE_URL}/api/register/`;
// Add other endpoints as needed
