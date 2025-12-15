import axios from 'axios';

const ACCESS_TOKEN_KEY = 'kusafe_access_token';
const REFRESH_ENDPOINT = '/v1/auth/refresh';

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

const refreshClient = axios.create({
  baseURL: 'https://localhost:7267',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post(REFRESH_ENDPOINT, {})
      .then(res => {
        const next = res.data?.accessToken as string | undefined;
        if (!next) {
          clearAccessToken();
          return null;
        }
        setAccessToken(next);
        return next;
      })
      .catch(() => {
        clearAccessToken();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.response.use(
  res => res,
  async err => {
    const status = err?.response?.status;
    const original = err?.config as any;

    if (!original || status !== 401) return Promise.reject(err);

    const isRefreshCall =
      typeof original.url === 'string' && original.url.includes(REFRESH_ENDPOINT);

    if (isRefreshCall) {
      clearAccessToken();
      return Promise.reject(err);
    }

    if (original._retry) return Promise.reject(err);
    original._retry = true;

    const next = await refreshAccessToken();
    if (!next) return Promise.reject(err);

    original.headers = original.headers ?? {};
    original.headers.Authorization = `Bearer ${next}`;

    return api(original);
  }
);
