import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Mail, Lock, ArrowRight, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/auth';
import { useAuthStore } from '../stores/authStore';
import { type UserRole } from '../types';

const LoginView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleWechatLogin = () => {
    // 获取当前域名作为回调地址
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
    // 跳转到后端微信登录接口
    window.location.href = `/api/auth/wechat?redirect_uri=${redirectUri}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await authApi.login({ email, password });
      // Normalize role to uppercase to match frontend RBAC
      const user = {
        ...data.user,
        role: data.user.role.toUpperCase() as UserRole,
      };
      setAuth(user, data.accessToken, data.refreshToken);
      // Navigate based on role
      if (user.role === 'ADMIN') navigate('/admin/users');
      else if (user.role === 'EXPERT') navigate('/crm');
      else navigate('/crm'); // SALES
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? '登录失败，请检查邮箱和密码';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/30 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200/30 rounded-full blur-3xl animate-pulse delay-700" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass rounded-[32px] p-10 shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 mb-6">
            <ShieldCheck className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">OpenClaw</h1>
          <p className="text-slate-500 mt-2 font-medium">企业级智能套件</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">电子邮箱</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white/50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                placeholder="name@company.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">密码</label>
              <button type="button" onClick={() => alert('请联系管理员重置密码：admin@openclaw.io')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">忘记密码？</button>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white/50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {loading ? '登录中...' : '登录控制台'}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>

        <div className="mt-10">
          <div className="relative flex items-center justify-center mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <span className="relative px-4 bg-white/50 text-xs font-bold text-slate-400 uppercase tracking-widest">或通过以下方式登录</span>
          </div>

          <button
            type="button"
            onClick={handleWechatLogin}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-[#07C160] text-white rounded-2xl hover:bg-[#06AD56] transition-all font-bold shadow-lg"
          >
            <MessageCircle className="w-5 h-5" />
            微信登录
          </button>
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          还没有账号？ <button type="button" onClick={() => alert('请发送邮件至 admin@openclaw.io 申请访问权限')} className="font-bold text-indigo-600 hover:text-indigo-700">申请访问权限</button>
        </p>
      </motion.div>
    </div>
  );
};

export default LoginView;
