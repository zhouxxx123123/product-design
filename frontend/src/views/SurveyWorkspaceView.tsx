import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { recognizeAudioFile } from '../services/asr';
import { llmApi } from '../services/llm';
import { outlineApi } from '../services/outline';
import { clientsApi } from '../services/clients';
import { sessionCollabApi } from '../services/sessions-collab';
import { casesApi } from '../services/cases';
import { uploadFile, type UploadedFileInfo } from '../services/storage';
import { useInsightExtract } from '../hooks/useInsightExtract';
import { useWorkspaceSession } from '../hooks/useWorkspaceSession';
import { useToastStore } from '../stores/toastStore';
import {
  ArrowLeft,
  Mic,
  MicOff,
  MessageSquare,
  FileText,
  Settings,
  MoreHorizontal,
  Send,
  Sparkles,
  Clock,
  Users,
  ChevronRight,
  Plus,
  Upload,
  Paperclip,
  Link,
  X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { ViewType, OutlineSection } from '../types';

interface SurveyWorkspaceProps {
  onBack: () => void;
  onViewChange: (view: ViewType) => void;
}

const SurveyWorkspaceView: React.FC<SurveyWorkspaceProps> = ({ onBack, onViewChange: _onViewChange }) => {
  const { id: sessionId } = useParams<{ id: string }>();
  const { session, segments, isLoadingSession, endSessionMutation, persistSegments } = useWorkspaceSession(sessionId);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { data: clientData } = useQuery({
    queryKey: ['client', session?.clientId],
    queryFn: () => clientsApi.get(session!.clientId).then((r) => r.data),
    enabled: !!session?.clientId,
  });

  // Fetch case links for this session
  const { data: caseLinks } = useQuery({
    queryKey: ['session-case-links', sessionId],
    queryFn: () => sessionCollabApi.listCaseLinks(sessionId!).then((r) => r.data),
    enabled: !!sessionId,
  });

  // Fetch case details for linked cases
  const { data: linkedCases } = useQuery({
    queryKey: ['linked-cases', caseLinks?.map(link => link.caseId)],
    queryFn: async () => {
      if (!caseLinks || caseLinks.length === 0) return [];
      const casePromises = caseLinks.map(link =>
        casesApi.get(link.caseId).then(res => res.data)
      );
      return Promise.all(casePromises);
    },
    enabled: !!caseLinks && caseLinks.length > 0,
  });

  const [asrLoading, setAsrLoading] = useState(false);
  const [asrError, setAsrError] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'transcript' | 'notes' | 'files'>('chat');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [aiSuggestions, _setAiSuggestions] = useState<{ id: number; type: string; text: string; icon: React.ComponentType<{ className?: string }> }[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<{uid: string, name: string, size: string, type: string, uploadedInfo?: UploadedFileInfo}[]>([]);
  const [transcript, setTranscript] = useState<{time: string, speaker: string, text: string}[]>([]);

  const [noteInput, setNoteInput] = useState('');
  const [outline, setOutline] = useState<OutlineSection[]>([]);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const { isLoading: isExtractingInsight, result: insightResult, extract } = useInsightExtract();

  // 实时录音
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        setRecordingSeconds(0);
        setAsrLoading(true);
        setAsrError(null);
        setActiveTab('transcript');
        try {
          const result = await recognizeAudioFile(audioFile);
          const newSegments = result.segments.map((seg) => ({
            time: new Date(seg.begin_time).toISOString().slice(14, 19),
            speaker: seg.speaker_tag === 0 ? '识别结果' : `说话人 ${seg.speaker_tag}`,
            text: seg.text,
          }));
          setTranscript((prev) => [...prev, ...newSegments]);
          await persistSegments(
            result.segments.map((seg) => ({
              text: seg.text,
              startMs: seg.begin_time,
              endMs: seg.end_time,
              speaker: seg.speaker_tag === 0 ? '识别结果' : `说话人 ${seg.speaker_tag}`,
            }))
          );
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : '识别失败';
          setAsrError(errorMsg);
          useToastStore.getState().addToast(`语音识别失败: ${errorMsg}`, 'error');
        } finally {
          setAsrLoading(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      setAsrError('无法访问麦克风，请检查浏览器权限');
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
  };

  // 清理定时器
  useEffect(() => () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }, []);

  // outline 使用 ref 防止 React StrictMode 及父组件重渲染导致重复请求
  const outlineRequestedRef = useRef(false);
  useEffect(() => {
    if (!sessionId || outlineRequestedRef.current) return;
    outlineRequestedRef.current = true;
    setOutlineLoading(true);
    outlineApi.generate({ sessionId })
      .then(res => setOutline(res.data.sections))
      .catch(() => {/* silently fail, outline is optional */})
      .finally(() => setOutlineLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (segments.length === 0) return;
    setTranscript(segments.map(seg => ({
      time: seg.startMs != null
        ? new Date(seg.startMs).toISOString().slice(14, 19)
        : '--:--',
      speaker: seg.speaker ?? '说话人',
      text: seg.text,
    })));
  }, [segments]);

  const handleNoteSend = async () => {
    if (!noteInput.trim()) return;
    const userText = noteInput.trim();
    setNoteInput('');
    try {
      const res = await llmApi.chat([{ role: 'user', content: userText }]);
      setTranscript(prev => [...prev, {
        time: new Date().toISOString().slice(14, 19),
        speaker: 'AI 助手',
        text: res.content,
      }]);
      setActiveTab('transcript');
    } catch {
      // silently fail — ASR error display pattern already exists
    }
  };

  const handleGenerateSummary = async () => {
    if (!sessionId) return;
    const transcriptText = transcript
      .map(t => `[${t.time}] ${t.speaker}: ${t.text}`)
      .join('\n');
    const result = await extract({ sessionId, transcript: transcriptText });
    if (result) {
      setTranscript(prev => [...prev, {
        time: new Date().toISOString().slice(14, 19),
        speaker: 'AI 洞察',
        text: result.summary,
      }]);
      setActiveTab('transcript');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 hover:text-slate-600 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-slate-900">
                  {isLoadingSession ? '加载中...' : (session?.title ?? '访谈工作区')}
                </h1>
                <span className={`px-2 py-0.5 border rounded-full text-[10px] font-bold ${
                  session?.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : session?.status === 'in_progress'
                    ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                    : 'bg-amber-50 text-amber-600 border-amber-100'
                }`}>
                  {session?.status === 'completed' ? '已完成' : session?.status === 'in_progress' ? '进行中' : '已预约'}
                </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {session?.createdAt ? new Date(session.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {clientData ? `客户: ${clientData.companyName}` : session?.clientId ? '客户: 加载中...' : ''}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={async () => {
              await endSessionMutation.mutateAsync();
              onBack();
            }}
            disabled={endSessionMutation.isPending}
            className="px-6 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-bold hover:bg-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {endSessionMutation.isPending ? '结束中...' : '结束访谈'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Video & Transcript */}
        <div className="flex-1 flex flex-col p-6 gap-6 overflow-hidden">
          {/* Participants */}
          <div className="flex items-center gap-6 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-[50px] h-[50px] relative bg-indigo-100 rounded-xl overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                <span className="text-indigo-700 font-bold text-lg">专</span>
              </div>
              <div className="text-sm font-bold text-slate-700">
                专家
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-[50px] h-[50px] relative bg-emerald-100 rounded-xl overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                <span className="text-emerald-700 font-bold text-lg">客</span>
              </div>
              <div className="text-sm font-bold text-slate-700">
                {clientData?.companyName ?? (clientData === undefined && session?.clientId ? '加载中...' : '客户')}
              </div>
            </div>
          </div>

          {/* Transcript Area */}
          <div className="flex-1 bg-white rounded-[32px] border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex gap-1 p-1 bg-slate-100/50 rounded-xl">
                {[
                  { id: 'chat', label: '实时对话', icon: MessageSquare },
                  { id: 'transcript', label: '完整转录', icon: FileText },
                  { id: 'notes', label: '访谈笔记', icon: Sparkles },
                  { id: 'files', label: '参考资料', icon: Paperclip },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as 'chat' | 'transcript' | 'notes' | 'files')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                      activeTab === tab.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-600" />
                  上传附件
                </button>
                <button 
                  onClick={() => setActiveTab('files')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                >
                  <Link className="w-3.5 h-3.5 text-indigo-600" />
                  引用附件
                </button>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    e.target.value = '';
                    // Use a stable uid so concurrent uploads with same filename don't collide
                    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                    const localEntry = {
                      uid,
                      name: file.name,
                      size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
                      type: file.name.split('.').pop() ?? 'file',
                    };
                    setUploadedFiles((prev) => [...prev, localEntry]);
                    setActiveTab('files');
                    try {
                      const uploaded = await uploadFile(file);
                      // Update the entry by stable uid (immutable replace)
                      setUploadedFiles((prev) =>
                        prev.map((f) => (f.uid === uid ? { ...f, uploadedInfo: uploaded } : f))
                      );
                    } catch (err) {
                      console.error('文件上传失败:', err);
                      // Remove failed entry by stable uid
                      setUploadedFiles((prev) => prev.filter((f) => f.uid !== uid));
                    }
                  }}
                />
                <div className="w-px h-4 bg-slate-200 mx-1" />
                {/* 音频文件上传 → ASR 识别 */}
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    e.target.value = '';
                    setAsrLoading(true);
                    setAsrError(null);
                    setActiveTab('transcript');
                    try {
                      const result = await recognizeAudioFile(file);
                      const newSegments = result.segments.map((seg) => ({
                        time: new Date(seg.begin_time).toISOString().slice(14, 19),
                        speaker: seg.speaker_tag === 0 ? '识别结果' : `说话人 ${seg.speaker_tag}`,
                        text: seg.text,
                      }));
                      setTranscript((prev) => [...prev, ...newSegments]);
                      await persistSegments(result.segments.map(seg => ({
                        text: seg.text,
                        startMs: seg.begin_time,
                        endMs: seg.end_time,
                        speaker: seg.speaker_tag === 0 ? '识别结果' : `说话人 ${seg.speaker_tag}`,
                      })));
                    } catch (err) {
                      const errorMsg = err instanceof Error ? err.message : '识别失败';
                      setAsrError(errorMsg);
                      useToastStore.getState().addToast(`语音识别失败: ${errorMsg}`, 'error');
                    } finally {
                      setAsrLoading(false);
                    }
                  }}
                />
                {/* 实时麦克风录音按钮 */}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={asrLoading}
                  title={isRecording ? '停止录音并识别' : '开始实时录音'}
                  className={cn(
                    'flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all border',
                    asrLoading
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                      : isRecording
                      ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 animate-pulse'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                  )}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="w-3.5 h-3.5" />
                      <span className="tabular-nums">{formatDuration(recordingSeconds)}</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 text-indigo-600" />
                      实时录音
                    </>
                  )}
                </button>
                <button
                  onClick={() => audioInputRef.current?.click()}
                  disabled={asrLoading || isRecording}
                  className={cn(
                    'flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all',
                    asrLoading || isRecording
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100',
                  )}
                >
                  <div className={cn('w-2 h-2 rounded-full', asrLoading ? 'bg-slate-400 animate-pulse' : 'bg-indigo-500')} />
                  {asrLoading ? 'AI 识别中…' : '上传音频识别'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {activeTab === 'files' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {uploadedFiles.map((file) => (
                    <div key={file.uid} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-4 group hover:border-indigo-200 transition-all cursor-pointer">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{file.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{file.size} · {file.type}</div>
                      </div>
                      <button className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="p-4 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-xs font-bold">添加更多文件</span>
                  </button>
                </div>
              ) : transcript.map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="text-[10px] font-mono text-slate-400 mt-1 shrink-0">{item.time}</div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 mb-1">{item.speaker}</div>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.text}</p>
                  </div>
                </div>
              ))}
              {asrError && activeTab !== 'files' && (
                <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span>{asrError}</span>
                  <button
                    onClick={() => setAsrError(null)}
                    className="ml-2 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                  >
                    重试
                  </button>
                </div>
              )}
              {asrLoading && activeTab !== 'files' && (
                <div className="flex gap-4 animate-pulse">
                  <div className="text-[10px] font-mono text-slate-400 mt-1 shrink-0">--:--</div>
                  <div>
                    <div className="text-xs font-bold text-indigo-600 mb-1">AI 语音识别中…</div>
                    <div className="h-4 w-64 bg-indigo-50 rounded"></div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="输入笔记或发送指令给 AI..."
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleNoteSend(); }}
                    className="w-full pl-4 pr-12 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                  <button
                    onClick={handleNoteSend}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <button 
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm"
                  title="添加附件"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Assistant */}
        <div className="w-96 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              AI 访谈助手
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            <section className="space-y-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">实时建议</h3>
              <div className="space-y-3">
                {aiSuggestions.map(suggestion => (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={suggestion.id} 
                    className={cn(
                      "p-4 rounded-2xl border transition-all cursor-pointer group",
                      suggestion.type === 'question' ? "bg-indigo-50 border-indigo-100 hover:border-indigo-300" :
                      suggestion.type === 'insight' ? "bg-emerald-50 border-emerald-100 hover:border-emerald-300" :
                      "bg-amber-50 border-amber-100 hover:border-amber-300"
                    )}
                  >
                    <div className="flex gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        suggestion.type === 'question' ? "bg-white text-indigo-600 shadow-sm" :
                        suggestion.type === 'insight' ? "bg-white text-emerald-600 shadow-sm" :
                        "bg-white text-amber-600 shadow-sm"
                      )}>
                        <suggestion.icon className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-medium text-slate-700 leading-relaxed">
                        {suggestion.text}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">关联案例</h3>
              {!caseLinks || caseLinks.length === 0 ? (
                <div className="text-xs text-slate-400 p-4 text-center">
                  暂无关联案例
                </div>
              ) : linkedCases?.map((linkedCase) => (
                <div key={linkedCase.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-all cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold text-slate-900">{linkedCase.title}</div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    {linkedCase.summary || linkedCase.content || '暂无详细描述'}
                  </p>
                  {linkedCase.tags && linkedCase.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {linkedCase.tags.slice(0, 3).map((tag, tagIndex) => (
                        <span key={tagIndex} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] rounded-md">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </section>

            <section className="space-y-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">访谈大纲</h3>
              {outlineLoading ? (
                <div className="space-y-2 animate-pulse">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-slate-100 rounded-2xl" />
                  ))}
                </div>
              ) : outline.length === 0 ? (
                <p className="text-xs text-slate-400">暂无提纲数据</p>
              ) : (
                <div className="space-y-2">
                  {outline.map(section => (
                    <div key={section.id} className="rounded-2xl border border-slate-100 overflow-hidden">
                      <button
                        onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50 transition-colors"
                      >
                        <span className="text-xs font-bold text-slate-700">{section.title}</span>
                        <ChevronRight className={cn('w-3.5 h-3.5 text-slate-300 transition-transform', expandedSection === section.id && 'rotate-90')} />
                      </button>
                      {expandedSection === section.id && section.questions.length > 0 && (
                        <div className="px-3 pb-3 space-y-1.5 border-t border-slate-100 pt-2">
                          {section.questions.map((q, qi) => (
                            <button
                              key={qi}
                              onClick={() => navigator.clipboard.writeText(q).catch(() => {})}
                              className="w-full text-left text-[11px] text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl px-2 py-1 transition-colors"
                              title="点击复制到剪贴板"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {insightResult && (
              <section className="space-y-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI 洞察</h3>
                <div className="space-y-2">
                  {insightResult.insights.slice(0, 3).map(insight => (
                    <div key={insight.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700 leading-relaxed">
                      {insight.content}
                      {insight.quote && (
                        <p className="mt-1 text-[10px] text-slate-400 italic">"{insight.quote}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="p-6 border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={handleGenerateSummary}
              disabled={isExtractingInsight}
              className={cn(
                "w-full py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2",
                isExtractingInsight
                  ? "bg-indigo-400 text-white cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              )}
            >
              <Sparkles className={cn("w-4 h-4", isExtractingInsight && "animate-pulse")} />
              {isExtractingInsight ? '生成中…' : '生成访谈摘要'}
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-2xl font-bold text-slate-900">会话设置</h2>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-slate-600 shadow-sm"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-700">录音设置</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-2">录音质量</label>
                      <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                        <option>高质量 (48kHz)</option>
                        <option>标准 (22kHz)</option>
                        <option>低质量 (16kHz)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-2">语言模式</label>
                      <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                        <option>中文普通话</option>
                        <option>英文</option>
                        <option>粤语</option>
                        <option>其他方言</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-700">AI 助手设置</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        defaultChecked
                      />
                      <span className="text-sm text-slate-700">实时分析建议</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        defaultChecked
                      />
                      <span className="text-sm text-slate-700">自动生成洞察</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700">保存聊天记录</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                >
                  保存设置
                </button>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SurveyWorkspaceView;
