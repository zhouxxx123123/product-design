import { useCallback } from 'react';
import { useToastStore } from '../stores/toastStore';

export function useErrorHandler() {
  const addToast = useToastStore((s) => s.addToast);

  const handleError = useCallback(
    (error: unknown, fallbackMessage = '操作失败，请稍后重试') => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (error as { message?: string })?.message ??
        fallbackMessage;
      addToast(message, 'error');
    },
    [addToast],
  );

  return { handleError };
}