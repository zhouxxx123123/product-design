export class FeatureFlagEnrichedResponseDto {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string; // 'sales' | 'expert' | 'ai' | 'system'
  iconName: string;
  sortOrder: number;
  enabled: boolean;
}
