import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ListRenderItem,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { sessionsApi, Session } from '../services/sessionsApi';
import SessionCard, { SkeletonCard } from '../components/SessionCard';
import { SessionsStackParamList } from '../navigation/index';

type Props = NativeStackScreenProps<SessionsStackParamList, 'Sessions'>;

const SessionsScreen = ({ navigation }: Props): React.JSX.Element => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async (isRefresh = false): Promise<void> => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await sessionsApi.list({ page: 1, limit: 20 });
      setSessions(response.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const handleRefresh = useCallback((): void => {
    void fetchSessions(true);
  }, [fetchSessions]);

  const renderItem: ListRenderItem<Session> = useCallback(
    ({ item }) => (
      <SessionCard
        item={item}
        onPress={() => navigation.navigate('Recording', { sessionId: item.id, title: item.title })}
      />
    ),
    [navigation],
  );

  const keyExtractor = useCallback((item: Session): string => item.id, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  if (error !== null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void fetchSessions()}>
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={sessions}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={sessions.length === 0 ? styles.centered : styles.listContent}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      ListEmptyComponent={<Text style={styles.emptyText}>暂无会话</Text>}
    />
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    padding: 16,
  },
  listContent: {
    padding: 16,
    backgroundColor: '#f5f7fa',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  errorText: {
    fontSize: 15,
    color: '#e53e3e',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#1a56db',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SessionsScreen;
