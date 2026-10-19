// Vite replaces these public values at build time. Containers use nginx's /api proxy.
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'
