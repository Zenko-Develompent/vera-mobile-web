// app/page.tsx - Страница авторизации с проверками
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authenticateUser } from '@/app/data/users';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Проверка, что оба поля заполнены
  const isFormValid = login.trim().length > 0 && password.trim().length > 0;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Дополнительная проверка перед отправкой
    if (!isFormValid) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    setIsLoading(true);
    setError('');

    // Имитация задержки запроса к серверу
    setTimeout(() => {
      const user = authenticateUser(login.trim(), password.trim());
      
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
        router.push('/calls');
      } else {
        setError('Неверный логин или пароль');
      }
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-8">
        <div className="text-left mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Авторизация</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Логин</label>
            <input
              type="text"
              value={login}
              onChange={(e) => {
                setLogin(e.target.value);
                if (error) setError('');
              }}
              className={`w-full text-black px-4 py-3 border rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
                login.trim().length > 0 ? 'border-blue-500' : 'border-gray-300'
              }`}
              placeholder="Логин"
              disabled={isLoading}
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              className={`w-full px-4 text-black py-3 border rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
                password.trim().length > 0 ? 'border-blue-500' : 'border-gray-300'
              }`}
              placeholder="Пароль"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isFormValid) {
                  handleLogin(e);
                }
              }}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3">
              <p className="text-red-600 text-sm text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!isFormValid || isLoading}
            className={`w-full py-3 rounded-2xl  transition duration-200 flex items-center justify-center gap-2 ${
              !isFormValid || isLoading
                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                : 'bg-blue-600  text-white'
            }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Вход...
              </>
            ) : (
              'Войти'
            )}
          </button>
        </form>

        <div className="mt-6 text-left text-gray-400 text-xs flex items-center justify-between">
          <p className="font-medium text-gray-500 mb-1">Демо-данные:</p>
          <div className="flex justify-start gap-4">
            <span className="bg-gray-50 px-3 py-1 rounded-lg">
              <span className="font-medium">Логин:</span> feldsher
            </span>
            <span className="bg-gray-50 px-3 py-1 rounded-lg flex-1">
              <span className="font-medium">Пароль:</span> 123
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}