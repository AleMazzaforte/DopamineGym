// URL base del backend
const API_BASE_URL = 'http://localhost:3001/api';

// Helper para hacer requests
export const api = {
  get: async (endpoint: string, params?: Record<string, string>) => {
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Error ${response.status}`);
    return response.json();
  },

  post: async (endpoint: string, body: any) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    return response.json();
  },

  put: async (endpoint: string, body: any) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    return response.json();
  },

  delete: async (endpoint: string) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    return response.json();
  },
};