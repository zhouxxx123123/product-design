import http from './http';
import { useQuery } from '@tanstack/react-query';

export interface DictionaryNode {
  id: string;
  tenantId: string;
  name: string;
  code: string | null;
  parentId: string | null;
  level: number;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDictionaryNodeDto {
  name: string;
  code?: string;
  parentId?: string;
  description?: string;
  sortOrder?: number;
}

export type UpdateDictionaryNodeDto = Partial<Omit<CreateDictionaryNodeDto, 'parentId'>>;

export const dictionaryApi = {
  list: (parentId?: string) =>
    http.get<DictionaryNode[]>('/dictionary', { params: parentId !== undefined ? { parentId } : {} }),
  create: (dto: CreateDictionaryNodeDto) => http.post<DictionaryNode>('/dictionary', dto),
  update: (id: string, dto: UpdateDictionaryNodeDto) =>
    http.patch<DictionaryNode>(`/dictionary/${id}`, dto),
  delete: (id: string) => http.delete<{ success: boolean }>(`/dictionary/${id}`),
};

// Helper functions to get dictionary children by parent code
export const useDictionaryChildren = (parentCode: string) => {
  // First get all top-level nodes to find the parent with matching code
  const { data: topLevel = [] } = useQuery({
    queryKey: ['dictionary', 'top-level'],
    queryFn: () => dictionaryApi.list().then(r => r.data),
  });

  const parent = topLevel.find(node => node.code === parentCode);
  const parentId = parent?.id;

  // Then get children of that parent
  const { data: children = [], isLoading, error } = useQuery({
    queryKey: ['dictionary', 'children', parentId],
    queryFn: () => dictionaryApi.list(parentId).then(r => r.data),
    enabled: !!parentId,
  });

  return {
    data: children,
    isLoading: isLoading || (!parentId && topLevel.length === 0),
    error
  };
};
