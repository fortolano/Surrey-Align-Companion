import { QueryClient } from "@tanstack/react-query";

/**
 * Gets the base URL for the Express API server (e.g., "http://localhost:3000")
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin + '/';
  }

  let host = process.env.EXPO_PUBLIC_DOMAIN;

  if (host) {
    return new URL(`https://${host}`).href;
  }

  throw new Error("EXPO_PUBLIC_DOMAIN is not set");
}




export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
