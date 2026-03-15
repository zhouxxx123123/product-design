import http from './http';

export interface FeatureFlagItem {
  key: string;
  enabled: boolean;
}

export const featureFlagsApi = {
  list: () => http.get<FeatureFlagItem[]>('/feature-flags'),
  saveAll: (flags: FeatureFlagItem[]) =>
    http.patch<FeatureFlagItem[]>('/feature-flags', {
      flags: flags.map(f => ({ key: f.key, enabled: f.enabled })),
    }),
};
