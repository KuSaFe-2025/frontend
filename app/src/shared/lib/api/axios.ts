import axios from 'axios';

const ACCESS_TOKEN_KEY = 'kusafe_access_token';

export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const setAccessToken = (token: string) => localStorage.setItem(ACCESS_TOKEN_KEY, token);
export const clearAccessToken = () => localStorage.removeItem(ACCESS_TOKEN_KEY);

export const api = axios.create({
  baseURL: 'https://localhost:7267',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(config => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
