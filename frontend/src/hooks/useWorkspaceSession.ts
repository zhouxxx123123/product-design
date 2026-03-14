import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionsApi, Session } from '../services/sessions';
import { transcriptApi, TranscriptSegment, CreateSegmentDto } from '../services/transcript';

export function useWorkspaceSession(sessionId: string | undefined) {
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => sessionsApi.get(sessionId!).then(r => r.data),
    enabled: !!sessionId,
  });

  const segmentsQuery = useQuery({
    queryKey: ['transcript', sessionId],
    queryFn: () => transcriptApi.listBySession(sessionId!).then(r => r.data),
    enabled: !!sessionId,
  });

  const endSessionMutation = useMutation({
    mutationFn: () => sessionsApi.updateStatus(sessionId!, 'completed').then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  const persistSegments = async (segs: CreateSegmentDto[]) => {
    if (!sessionId || segs.length === 0) return;
    await transcriptApi.bulkCreate(sessionId, segs);
    queryClient.invalidateQueries({ queryKey: ['transcript', sessionId] });
  };

  return {
    session: sessionQuery.data as Session | undefined,
    segments: (segmentsQuery.data ?? []) as TranscriptSegment[],
    isLoadingSession: sessionQuery.isLoading,
    isLoadingSegments: segmentsQuery.isLoading,
    endSessionMutation,
    persistSegments,
  };
}
