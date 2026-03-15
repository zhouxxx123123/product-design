import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import http from '../services/http';

const AuthCallbackView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');

    if (!accessToken || !refreshToken) {
      setError('缺少认证令牌，请重新登录');
      return;
    }

    // Fetch user info using the access token
    http.get('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => {
        const user = res.data;
        useAuthStore.getState().setAuth(user, accessToken, refreshToken);

        // Redirect based on role
        if (user.role === 'ADMIN') {
          navigate('/admin/users', { replace: true });
        } else {
          navigate('/crm', { replace: true });
        }
      })
      .catch(() => {
        setError('认证失败，请重新登录');
      });
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg max-w-sm w-full mx-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">登录失败</h2>
          <p className="text-slate-500 text-sm mb-6">{error}</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="w-full px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
          >
            返回登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center p-8">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm font-medium">正在验证身份，请稍候...</p>
      </div>
    </div>
  );
};

export default AuthCallbackView;