import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { asrApi, AsrSegment } from '../services/asrApi';
import { transcriptApi, TranscriptSegmentInput } from '../services/transcriptApi';
import { sessionsApi } from '../services/sessionsApi';
import { SessionStatus } from '@shared/types/enums';
import { SessionsStackParamList } from '../navigation/index';

type Props = NativeStackScreenProps<SessionsStackParamList, 'Recording'>;

type RecordingStatus = 'idle' | 'recording' | 'processing' | 'success' | 'error';

const audioRecorderPlayer = new AudioRecorderPlayer();

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function mapSegments(asrSegments: AsrSegment[]): TranscriptSegmentInput[] {
  return asrSegments.map((seg) => ({
    text: seg.text,
    startMs: seg.begin_time,
    endMs: seg.end_time,
    speaker: String(seg.speaker_tag),
  }));
}

const SegmentRow = ({ seg }: { seg: TranscriptSegmentInput }): React.JSX.Element => (
  <View style={styles.segmentRow}>
    <Text style={styles.segmentSpeaker}>
      {seg.speaker !== undefined ? `说话人 ${seg.speaker}` : '—'}
    </Text>
    <Text style={styles.segmentTime}>
      {seg.startMs !== undefined ? formatMs(seg.startMs) : '--:--'}
    </Text>
    <Text style={styles.segmentText}>{seg.text}</Text>
  </View>
);

const RecordingScreen = ({ route }: Props): React.JSX.Element => {
  const { sessionId, title } = route.params;

  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [segments, setSegments] = useState<TranscriptSegmentInput[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);

  const stopTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      if (isRecordingRef.current) {
        void audioRecorderPlayer.stopRecorder();
      }
    };
  }, [stopTimer]);

  const handleStart = useCallback(async (): Promise<void> => {
    try {
      await audioRecorderPlayer.startRecorder();
      isRecordingRef.current = true;
      setElapsed(0);
      setStatus('recording');
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '无法启动录音';
      Alert.alert('录音失败', msg);
    }
  }, []);

  const handleStop = useCallback(async (): Promise<void> => {
    stopTimer();
    isRecordingRef.current = false;

    let filePath: string;
    try {
      filePath = await audioRecorderPlayer.stopRecorder();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '停止录音失败';
      Alert.alert('错误', msg);
      setStatus('error');
      return;
    }

    setStatus('processing');

    try {
      const asrResult = await asrApi.recognizeFile(filePath, 'recording.m4a');
      const mapped = mapSegments(asrResult.segments);
      await transcriptApi.bulkCreate(sessionId, mapped);
      await sessionsApi.updateStatus(sessionId, SessionStatus.COMPLETED);
      setSegments(mapped);
      setStatus('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '处理失败';
      Alert.alert('错误', msg);
      setStatus('error');
    }
  }, [sessionId, stopTimer]);

  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={2}>{title}</Text>

      {status === 'idle' && (
        <View style={styles.centered}>
          <TouchableOpacity style={styles.recordButton} onPress={() => void handleStart()}>
            <View style={styles.recordDot} />
          </TouchableOpacity>
          <Text style={styles.hint}>点击开始录音</Text>
        </View>
      )}

      {status === 'recording' && (
        <View style={styles.centered}>
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.timerText}>{formatElapsed(elapsed)}</Text>
          </View>
          <TouchableOpacity style={styles.stopButton} onPress={() => void handleStop()}>
            <Text style={styles.stopButtonText}>停止录音</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'processing' && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1a56db" />
          <Text style={styles.processingText}>处理中...</Text>
        </View>
      )}

      {status === 'success' && (
        <View style={styles.successContainer}>
          <Text style={styles.successTitle}>录音已完成</Text>
          <ScrollView style={styles.transcriptScroll}>
            {segments.map((seg, idx) => (
              <SegmentRow key={idx} seg={seg} />
            ))}
          </ScrollView>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>处理失败，请重试</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => setStatus('idle')}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa', padding: 20 },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 24, textAlign: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  recordButton: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#ef4444',
  },
  recordDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ef4444' },
  hint: { marginTop: 16, fontSize: 14, color: '#666' },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  recordingDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#ef4444', marginRight: 10 },
  timerText: { fontSize: 32, fontWeight: '700', color: '#1a1a1a' },
  stopButton: {
    paddingHorizontal: 36, paddingVertical: 14,
    backgroundColor: '#1a56db', borderRadius: 12,
  },
  stopButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  processingText: { marginTop: 16, fontSize: 16, color: '#666' },
  successContainer: { flex: 1 },
  successTitle: { fontSize: 16, fontWeight: '700', color: '#10b981', textAlign: 'center', marginBottom: 16 },
  transcriptScroll: { flex: 1 },
  segmentRow: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 8,
    padding: 12, marginBottom: 8, alignItems: 'flex-start',
  },
  segmentSpeaker: { fontSize: 12, color: '#1a56db', width: 64, fontWeight: '600' },
  segmentTime: { fontSize: 12, color: '#999', width: 48, marginLeft: 4 },
  segmentText: { fontSize: 14, color: '#1a1a1a', flex: 1, marginLeft: 8 },
  errorText: { fontSize: 15, color: '#e53e3e', marginBottom: 16, textAlign: 'center' },
  retryButton: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#1a56db', borderRadius: 8 },
  retryButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

export default RecordingScreen;
