import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import dayjs from 'dayjs';
import { SessionStatus } from '@shared/types/enums';
import { Session } from '../services/sessionsApi';

const STATUS_LABELS: Record<SessionStatus, string> = {
  [SessionStatus.DRAFT]: '草稿',
  [SessionStatus.IN_PROGRESS]: '进行中',
  [SessionStatus.COMPLETED]: '已完成',
  [SessionStatus.PROCESSED]: '已处理',
  [SessionStatus.ARCHIVED]: '已归档',
};

const STATUS_COLORS: Record<SessionStatus, string> = {
  [SessionStatus.DRAFT]: '#9ca3af',
  [SessionStatus.IN_PROGRESS]: '#3b82f6',
  [SessionStatus.COMPLETED]: '#10b981',
  [SessionStatus.PROCESSED]: '#8b5cf6',
  [SessionStatus.ARCHIVED]: '#6b7280',
};

interface Props {
  item: Session;
  onPress: () => void;
}

const SessionCard = ({ item, onPress }: Props): React.JSX.Element => {
  const statusColor = STATUS_COLORS[item.status] ?? '#9ca3af';
  const statusLabel = STATUS_LABELS[item.status] ?? item.status;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}22` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>
      {item.clientName !== undefined && item.clientName.length > 0 && (
        <Text style={styles.clientName}>{item.clientName}</Text>
      )}
      <Text style={styles.dateText}>{dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}</Text>
    </TouchableOpacity>
  );
};

export const SkeletonCard = (): React.JSX.Element => (
  <View style={styles.skeletonCard}>
    <View style={styles.skeletonTitle} />
    <View style={styles.skeletonMeta} />
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  clientName: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  skeletonCard: {
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    height: 80,
    justifyContent: 'space-around',
  },
  skeletonTitle: {
    height: 16,
    backgroundColor: '#d1d5db',
    borderRadius: 4,
    width: '70%',
  },
  skeletonMeta: {
    height: 12,
    backgroundColor: '#d1d5db',
    borderRadius: 4,
    width: '40%',
  },
});

export default SessionCard;
