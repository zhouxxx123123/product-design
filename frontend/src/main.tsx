import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import App from './App';
import { useToastStore } from './stores/toastStore';
import './index.css';

function getErrorMessage(error: unknown): string {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (error as { message?: string })?.message ??
    '请求失败，请稍后重试'
  );
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      useToastStore.getState().addToast(getErrorMessage(error), 'error');
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      useToastStore.getState().addToast(getErrorMessage(error), 'error');
    },
  }),
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, throwOnError: false },
    mutations: { throwOnError: false },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
