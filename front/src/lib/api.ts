// Determinamos la URL base según el hostname del navegador
const getBaseUrl = (): string => {
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return 'http://localhost:3001/api'; // Backend local
  }
  return 'https://dopamine-gym-aaf5.vercel.app/api'; // Backend en producción
};

const API_BASE_URL = getBaseUrl();

// Función base privada para centralizar la inyección de headers, JWT y errores
async function customFetch<T = any>(
  endpoint: string,
  options: RequestInit = {},
  params?: Record<string, string>
): Promise<T> {
  // 1. Armar URL con query params
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  // 2. Obtener Token de localStorage e inyectar en los Headers
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 3. Ejecutar Petición
  const response = await fetch(url.toString(), {
    ...options,
    headers,
  });

  // 4. Manejar expiración de Token o falta de autenticación
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Sesión expirada o token no válido');
  }

  // 5. Parsear respuesta del backend
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Error HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

// Objeto exportado con la misma interfaz para tus componentes
export const api = {
  get: <T = any>(endpoint: string, params?: Record<string, string>): Promise<T> =>
    customFetch<T>(endpoint, { method: 'GET' }, params),

  post: <T = any>(endpoint: string, body?: any): Promise<T> =>
    customFetch<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = any>(endpoint: string, body?: any): Promise<T> =>
    customFetch<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(endpoint: string): Promise<T> =>
    customFetch<T>(endpoint, { method: 'DELETE' }),
};