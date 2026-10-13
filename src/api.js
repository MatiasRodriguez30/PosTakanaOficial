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
    throw new Error(errorMsg);
  }

  return data;
};

export const api = {
  get: async (endpoint) => {
    const url = `${getApiUrl()}${endpoint}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  post: async (endpoint, body) => {
    const url = `${getApiUrl()}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    return handleResponse(response);
  },

  put: async (endpoint, body) => {
    const url = `${getApiUrl()}${endpoint}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    return handleResponse(response);
  },

  delete: async (endpoint) => {
    const url = `${getApiUrl()}${endpoint}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  // Método especial para enviar formularios con subidas de archivos (multipart/form-data)
  upload: async (endpoint, formData, isPut = false) => {
    const url = `${getApiUrl()}${endpoint}`;
    const response = await fetch(url, {
      method: isPut ? 'PUT' : 'POST',
      headers: getHeaders(true), // Indica que no añada Content-Type para que el navegador lo ponga con el boundary correcto
      body: formData
    });
    return handleResponse(response);
  }
};
