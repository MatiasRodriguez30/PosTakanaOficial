// Configuración de la API con endpoint dinámico para soportar entornos de producción, red local y túneles
export const getApiUrl = () => {
  // 1. Prioriza localStorage, 2. Variable de entorno Vite
  const stored = localStorage.getItem('TAKANA_API_URL') || import.meta.env.VITE_API_URL;
  if (stored) return stored;

  // 3. Si se accede desde el propio equipo, ir directo al backend en localhost
  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:8000';

  // 4. Acceso remoto (red local o túnel, ej. ngrok): usar el mismo origen.
  // El servidor de desarrollo de Vite reenvía /api y /static al backend (ver vite.config.js).
  return '';
};

export const setApiUrl = (url) => {
  let cleanedUrl = url.trim();
  if (cleanedUrl.endsWith('/')) {
    cleanedUrl = cleanedUrl.slice(0, -1);
  }
  localStorage.setItem('TAKANA_API_URL', cleanedUrl);
};

// Obtener el token de autorización
const getHeaders = (isMultipart = false) => {
  const token = localStorage.getItem('TAKANA_TOKEN');
  const headers = {};
  
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// Manejo centralizado de respuestas y errores
const handleResponse = async (response) => {
  if (response.status === 401) {
    // Si la sesión expira o el token es inválido, cerramos sesión
    localStorage.removeItem('TAKANA_TOKEN');
    localStorage.removeItem('TAKANA_USER_ROL');
    localStorage.removeItem('TAKANA_USERNAME');
    // Si no estamos ya en la pantalla de login, redirigimos recargando
    if (!window.location.hash.includes('login')) {
      window.dispatchEvent(new Event('auth-expired'));
    }
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.detail || 'Ha ocurrido un error en la solicitud';
    const error = new Error(errorMsg);
    error.status = response.status;
    // 5xx: el servidor está caído o no puede trabajar (túnel, base, etc.).
    error.sinConexion = response.status >= 500;
    throw error;
  }

  return data;
};

// Sin respuesta en este tiempo se trata como "sin conexión" (no deja el cobro colgado).
const TIEMPO_MAXIMO_MS = 15000;

// fetch que convierte los fallos de red (sin internet, servidor apagado,
// demora excesiva) en un error con sinConexion = true.
const pedir = async (endpoint, opciones) => {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);
  let response;
  try {
    response = await fetch(`${getApiUrl()}${endpoint}`, { ...opciones, signal: control.signal });
  } catch (e) {
    const error = new Error('Sin conexión con el servidor');
    error.sinConexion = true;
    throw error;
  } finally {
    clearTimeout(reloj);
  }
  return handleResponse(response);
};

export const api = {
  get: (endpoint) => pedir(endpoint, { method: 'GET', headers: getHeaders() }),

  post: (endpoint, body) => pedir(endpoint, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) }),

  put: (endpoint, body) => pedir(endpoint, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(body) }),

  delete: (endpoint) => pedir(endpoint, { method: 'DELETE', headers: getHeaders() }),

  // Método especial para enviar formularios con subidas de archivos (multipart/form-data).
  // Sin Content-Type para que el navegador lo ponga con el boundary correcto.
  upload: (endpoint, formData, isPut = false) =>
    pedir(endpoint, { method: isPut ? 'PUT' : 'POST', headers: getHeaders(true), body: formData })
};
