import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  sessionsApi,
  type Session,
  type CreateSessionDto,
  type UpdateSessionDto,
} from '../services/sessions';

export function useSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => sessionsApi.get(sessionId!).then((r) => r.data),
    enabled: !!sessionId,
    staleTime: 30_000,
  });
}

export function useSessions(params?: Parameters<typeof sessionsApi.list>[0]) {
  return useQuery({
    queryKey: ['sessions', params],
    queryFn: () => sessionsApi.list(params).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSessionDto) =>
      sessionsApi.create(dto).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });
}

export function useUpdateSession(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateSessionDto) =>
      sessionsApi.update(sessionId, dto).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
    },
  });
}

export type { Session, CreateSessionDto, UpdateSessionDto };
