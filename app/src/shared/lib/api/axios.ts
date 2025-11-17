import axios from 'axios';

export const api = axios.create({
  baseURL: 'https://kusafe.ru:3443/api/',
  withCredentials: true,
});
