import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transcriptApi, TranscriptSegment as ApiSegment } from '../services/transcript';
import { useToastStore } from '../stores/toastStore';
import { insightsApi, Insight as ApiInsight } from '../services/insights';
import { reportApi } from '../services/report';
import { casesApi, Case, SimilarCase } from '../services/cases';
import { sessionsApi } from '../services/sessions';
import {
  FileText,
  Play,
  Pause,
  Search,
  Download,
  Sparkles,
  CheckCircle2,
  MessageSquare,
  Clock,
  Briefcase,
  Edit3,
  Save,
  Volume2,
  Loader2,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Local UI types ────────────────────────────────────────────────────────────

interface TranscriptSegment {
  id: string;
  time: string;
  speaker: string;
  text: string;
  isHighlight: boolean;
}

interface Insight {
  id: string;
  layer: 1 | 2 | 3;
  title: string;
  content: string;
  department: string;
}

// ── Mapping helpers ────────────────────────────────────────────────────────────

function formatMs(ms: number | null): string {
  if (ms === null) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function mapSegment(seg: ApiSegment): TranscriptSegment {
  return {
    id: seg.id,
    time: formatMs(seg.startMs),
    speaker: seg.speaker ?? '未知',
    text: seg.text,
    isHighlight: false,
  };
}

function mapInsight(api: ApiInsight): Insight {
  const c = api.content;
  const title =
    typeof c['title'] === 'string' ? c['title'] : `洞察 #${api.id.slice(-4)}`;
  const content =
    typeof c['text'] === 'string'
      ? c['text']
      : typeof c['content'] === 'string'
      ? c['content']
      : '';
  const department = typeof c['department'] === 'string' ? c['department'] : '';
  return {
    id: api.id,
    layer: (api.layer as 1 | 2 | 3),
    title,
    content,
    department,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

const SurveyInsightsView: React.FC = () => {
  const { id: sessionId } = useParams<{ id: string }>();

  const [activeTab, setActiveTab] = useState<'transcript' | 'insights' | 'cases'>('insights');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(80);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [editingInsight, setEditingInsight] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const queryClient = useQueryClient();

  // ── Data queries ───────────────────────────────────────────────────────────

  const { data: sessionData } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => sessionId ? sessionsApi.get(sessionId).then((r) => r.data) : Promise.resolve(null),
    enabled: !!sessionId,
  });

  const { data: rawTranscript = [] } = useQuery({
    queryKey: ['transcript', sessionId],
    queryFn: () =>
      sessionId
        ? transcriptApi.listBySession(sessionId).then((r) => r.data)
        : Promise.resolve([]),
    enabled: !!sessionId,
  });

  const { data: rawInsights = [] } = useQuery({
    queryKey: ['insights', sessionId],
    queryFn: () =>
      sessionId
        ? insightsApi.listBySession(sessionId).then((r) => r.data)
        : Promise.resolve([]),
    enabled: !!sessionId,
  });

  const transcript: TranscriptSegment[] = rawTranscript.map(mapSegment);
  const insights: Insight[] = rawInsights.map(mapInsight);

  // Build the query text from all insights combined — memoized to prevent unnecessary re-fetches
  const similarQueryText = useMemo(
    () =>
      insights.length > 0
        ? insights
            .filter((i) => i.layer === 3 || i.layer === 2)
            .map((i) => `${i.title}: ${i.content}`)
            .join('\n')
            .slice(0, 2000)
        : null,
    [insights],
  );

  const { data: similarCases = [], isLoading: isSimilarLoading } = useQuery({
    queryKey: ['cases-similar', similarQueryText],
    queryFn: () =>
      casesApi.similar({ text: similarQueryText!, limit: 10 }).then((r) => r.data.data),
    enabled: !!similarQueryText && activeTab === 'cases',
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // ── Audio wiring ───────────────────────────────────────────────────────────

  // Wire audio source when session data arrives
  useEffect(() => {
    if (sessionData?.recordingUrl && audioRef.current) {
      audioRef.current.src = sessionData.recordingUrl;
    }
  }, [sessionData?.recordingUrl]);

  // Wire timeupdate event for playback progress
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
  }, []);

  // Wire volume control
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: Record<string, unknown> }) =>
      insightsApi.update(id, { content }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['insights', sessionId] }),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSaveInsight = (insightId: string) => {
    const draft = editDrafts[insightId];
    if (draft !== undefined && sessionId) {
      // Preserve existing content fields, overwrite text
      const original = rawInsights.find((i) => i.id === insightId);
      const merged: Record<string, unknown> = { ...(original?.content ?? {}), text: draft };
      updateMutation.mutate({ id: insightId, content: merged });
    }
    setEditingInsight(null);
  };

  const handlePlaySegment = (time: string) => {
    const [minutes, seconds] = time.split(':').map(Number);
    const totalSeconds = minutes * 60 + seconds;
    setCurrentTime(totalSeconds);
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.currentTime = totalSeconds;
      audioRef.current.play().catch(() => {
        // Audio element has no src yet — seek stored in state, play deferred
      });
    }
  };

  const handleExportPDF = async () => {
    if (!sessionId || isExporting) return;
    setIsExporting(true);
    try {
      const { data: job } = await reportApi.startExport(sessionId);

      // Poll until done or failed — iterative loop (avoids call-stack overflow)
      const maxAttempts = 30;
      const pollInterval = 2000;
      let jobDone = false;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let jobDetail;
        try {
          const res = await reportApi.pollJobStatus(job.jobId);
          jobDetail = res.data;
        } catch {
          // Network error during poll — wait and retry rather than aborting
          await new Promise<void>((resolve) => setTimeout(resolve, pollInterval));
          continue;
        }
        if (jobDetail.status === 'done') { jobDone = true; break; }
        if (jobDetail.status === 'failed') {
          throw new Error(jobDetail.error ?? '报告生成失败');
        }
        await new Promise<void>((resolve) => setTimeout(resolve, pollInterval));
      }

      if (!jobDone) throw new Error('报告生成超时，请稍后重试');

      // Download the report
      const { data: blob } = await reportApi.download(sessionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${sessionId}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF导出失败', err);
      useToastStore.getState().addToast(
        err instanceof Error ? err.message : '报告导出失败，请稍后重试',
        'error'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerateInsights = async () => {
    if (!sessionId || transcript.length === 0 || isGenerating) return;
    setIsGenerating(true);
    try {
      await insightsApi.extractFromSession(sessionId);
      await queryClient.invalidateQueries({ queryKey: ['insights', sessionId] });
    } catch (err) {
      console.error('生成洞察失败', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const filteredTranscript = transcript.filter(
    (t) =>
      t.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.speaker.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const layer3 = insights.filter((i) => i.layer === 3);
  const layer2 = insights.filter((i) => i.layer === 2);
  const layer1 = insights.filter((i) => i.layer === 1);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-slate-900">调研洞察分析</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                sessionData?.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  : sessionData?.status === 'in_progress'
                  ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                  : 'bg-amber-50 text-amber-600 border-amber-100'
              }`}>
                {sessionData?.status === 'completed' ? '已完成' : sessionData?.status === 'in_progress' ? '进行中' : sessionData ? '已预约' : '—'}
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <span>{sessionData?.title ?? '—'}</span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {sessionId || '—'}
              </span>
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" />
                {transcript.length} 条转写 · {insights.length} 条洞察
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateInsights}
              disabled={isGenerating || !sessionId || transcript.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isGenerating ? '生成中...' : '✨ 生成洞察'}
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExporting || !sessionId}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isExporting ? '导出中...' : '导出 PDF 报告'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-8 mt-6 border-b border-slate-200">
          {[
            { id: 'insights', label: '三层洞察', icon: Sparkles },
            { id: 'transcript', label: '转写稿回溯', icon: FileText },
            { id: 'cases', label: '相似案例', icon: Briefcase },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'transcript' | 'insights' | 'cases')}
              className={cn(
                'flex items-center gap-2 pb-4 text-sm font-medium transition-all border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-y-auto p-8">

          {/* ── Insights tab ── */}
          {activeTab === 'insights' && (
            <div className="max-w-4xl mx-auto space-y-6">

              {/* Layer 3 — Executive Summary */}
              {layer3.length > 0 ? (
                layer3.map((insight) => (
                  <motion.div
                    key={insight.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl border border-emerald-200 p-8"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-emerald-900">第三层：执行摘要</h3>
                        <span className="text-sm text-emerald-600">
                          {insight.department || '决策层'} · 一页纸摘要
                        </span>
                      </div>
                    </div>
                    <div className="bg-white/60 rounded-2xl p-6">
                      {editingInsight === insight.id ? (
                        <textarea
                          className="w-full p-4 bg-white border border-emerald-200 rounded-xl text-slate-700 leading-relaxed resize-none focus:ring-2 focus:ring-emerald-500"
                          rows={6}
                          value={editDrafts[insight.id] ?? insight.content}
                          onChange={(e) =>
                            setEditDrafts((prev) => ({ ...prev, [insight.id]: e.target.value }))
                          }
                        />
                      ) : (
                        <p className="text-slate-700 leading-relaxed">{insight.content}</p>
                      )}
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      {editingInsight === insight.id ? (
                        <>
                          <button
                            onClick={() => setEditingInsight(null)}
                            className="px-4 py-2 text-slate-600 hover:bg-white/50 rounded-xl transition-all"
                          >
                            取消
                          </button>
                          <button
                            onClick={() => handleSaveInsight(insight.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-all"
                          >
                            <Save className="w-4 h-4" />
                            保存
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditingInsight(insight.id)}
                          className="flex items-center gap-2 px-4 py-2 text-emerald-700 bg-white/60 rounded-xl font-medium hover:bg-white transition-all"
                        >
                          <Edit3 className="w-4 h-4" />
                          编辑摘要
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))
              ) : (
                insights.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                    <Sparkles className="w-16 h-16 mb-4 opacity-30" />
                    <p className="text-lg font-medium">暂无洞察数据</p>
                    <p className="text-sm mt-1">点击「✨ 生成洞察」按钮生成分析结果</p>
                  </div>
                )
              )}

              {/* Layer 2 — Structured Pain Points */}
              {layer2.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <span className="text-lg font-bold text-indigo-600">L2</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">第二层：结构化痛点</h3>
                      <span className="text-sm text-slate-500">按部门提炼的痛点清单</span>
                    </div>
                  </div>
                  <div className="grid gap-4">
                    {layer2.map((insight) => (
                      <motion.div
                        key={insight.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white rounded-2xl border border-slate-200 p-6"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {insight.department && (
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium">
                                {insight.department}
                              </span>
                            )}
                            <h4 className="font-bold text-slate-900">{insight.title}</h4>
                          </div>
                          <button
                            onClick={() =>
                              setEditingInsight(editingInsight === insight.id ? null : insight.id)
                            }
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                        {editingInsight === insight.id ? (
                          <>
                            <textarea
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 resize-none focus:ring-2 focus:ring-indigo-500"
                              rows={3}
                              value={editDrafts[insight.id] ?? insight.content}
                              onChange={(e) =>
                                setEditDrafts((prev) => ({ ...prev, [insight.id]: e.target.value }))
                              }
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <button
                                onClick={() => setEditingInsight(null)}
                                className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                              >
                                取消
                              </button>
                              <button
                                onClick={() => handleSaveInsight(insight.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-all"
                              >
                                <Save className="w-3.5 h-3.5" />
                                保存
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="text-slate-600 text-sm leading-relaxed">{insight.content}</p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Layer 1 — Raw Excerpts */}
              {layer1.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                      <span className="text-lg font-bold text-slate-600">L1</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">第一层：原始摘录</h3>
                      <span className="text-sm text-slate-500">从转写稿标注的关键语句</span>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {layer1.map((insight) => (
                      <motion.div
                        key={insight.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-start gap-3"
                      >
                        <div className="w-6 h-6 bg-slate-200 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-slate-600">1</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {insight.department && (
                              <>
                                <span className="text-xs text-slate-400">{insight.department}</span>
                                <span className="text-xs text-slate-300">·</span>
                              </>
                            )}
                            <span className="text-xs text-slate-400">{insight.title}</span>
                          </div>
                          <p className="text-slate-600 text-sm italic">"{insight.content}"</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Transcript tab ── */}
          {activeTab === 'transcript' && (
            <div className="max-w-4xl mx-auto">
              {/* Audio Player */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 sticky top-0 z-10 shadow-sm">
                {sessionData?.recordingUrl ? (
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white hover:bg-indigo-700 transition-all"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <div className="flex-1">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all"
                          style={{ width: `${(currentTime / 3600) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-slate-500">
                        <span>
                          {Math.floor(currentTime / 60)}:{String(currentTime % 60).padStart(2, '0')}
                        </span>
                        <span>
                          {rawTranscript.length > 0
                            ? (() => {
                                const lastMs = rawTranscript[rawTranscript.length - 1]?.endMs ?? 0;
                                const totalSec = Math.floor(lastMs / 1000);
                                return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, '0')}`;
                              })()
                            : '--:--'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-5 h-5 text-slate-400" />
                      <input
                        type="range"
                        className="w-24"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => {
                          const newVolume = Number(e.target.value);
                          setVolume(newVolume);
                          if (audioRef.current) {
                            audioRef.current.volume = newVolume / 100;
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-4 text-slate-400">
                    <Volume2 className="w-5 h-5 mr-2 opacity-40" />
                    <span className="text-sm">暂无录音文件</span>
                  </div>
                )}
              </div>

              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索转写内容..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              {/* Transcript segments */}
              {filteredTranscript.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                  <FileText className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-lg font-medium">暂无转写内容</p>
                  <p className="text-sm mt-1">
                    {sessionId ? '该会话暂无转写记录' : '请先选择会话'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTranscript.map((segment) => (
                    <motion.div
                      key={segment.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => setSelectedSegment(segment.id)}
                      className={cn(
                        'p-4 rounded-2xl border transition-all cursor-pointer',
                        selectedSegment === segment.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 bg-white hover:border-indigo-200',
                        segment.isHighlight && 'border-l-4 border-l-amber-400',
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlaySegment(segment.time);
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-lg text-xs font-medium text-slate-600 hover:bg-indigo-100 hover:text-indigo-600 transition-all"
                        >
                          <Play className="w-3 h-3" />
                          {segment.time}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-slate-500">
                              {segment.speaker}
                            </span>
                          </div>
                          <p className="text-slate-700">{segment.text}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Cases tab ── */}
          {activeTab === 'cases' && (
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">相似案例推荐</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {similarQueryText
                      ? '基于本次调研洞察，通过语义向量相似度推荐的案例'
                      : '生成洞察后自动推荐相似案例'}
                  </p>
                </div>
                {isSimilarLoading && (
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    搜索中...
                  </div>
                )}
              </div>

              {!similarQueryText ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                  <Sparkles className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-lg font-medium">请先生成洞察</p>
                  <p className="text-sm mt-1">洞察内容将用于语义匹配相似案例</p>
                </div>
              ) : similarCases.length === 0 && !isSimilarLoading ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                  <Briefcase className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-lg font-medium">暂无相似案例</p>
                  <p className="text-sm mt-1">案例库尚未收录相关内容，可以创建新案例</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {similarCases.map((c, index) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {c.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {c.industry && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg text-xs font-medium">
                                {c.industry}
                              </span>
                            )}
                            {c.tags?.map((tag) => (
                              <span key={tag} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                          {/* Similarity score badge */}
                          <div className="flex flex-col items-center">
                            <span className="text-xs text-slate-400 mb-0.5">相似度</span>
                            <div className={cn(
                              "px-2 py-1 rounded-lg text-xs font-bold",
                              c.similarity >= 0.8
                                ? "bg-emerald-50 text-emerald-600"
                                : c.similarity >= 0.6
                                ? "bg-indigo-50 text-indigo-600"
                                : "bg-slate-100 text-slate-500"
                            )}>
                              {Math.round(c.similarity * 100)}%
                            </div>
                          </div>
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold",
                            c.status === 'published' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                          )}>
                            {c.status === 'published' ? '已发布' : c.status}
                          </span>
                        </div>
                      </div>
                      {c.summary && (
                        <p className="text-sm text-slate-600 leading-relaxed line-clamp-2 mb-3">
                          {c.summary}
                        </p>
                      )}
                      {c.content && (
                        <div className="pt-3 border-t border-slate-100">
                          <p className="text-xs text-slate-400 mb-1">详细内容</p>
                          <p className="text-sm text-slate-700 line-clamp-2">{c.content}</p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hidden audio element for future use */}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
};

export default SurveyInsightsView;
