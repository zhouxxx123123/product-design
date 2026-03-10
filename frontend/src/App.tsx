import { FC } from 'react';

const App: FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">
            中科琉光调研工具
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-gray-600">
            欢迎使用中科琉光调研工具。项目初始化完成。
          </p>
        </div>
      </main>
    </div>
  );
};

export default App;
