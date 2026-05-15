import { type FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Login.module.scss';
import { api, setAccessToken } from '@/shared/lib';

type Mode = 'login' | 'register';

type AuthResponse = {
  userId: string;
  email: string;
  displayName: string;
  accessToken: string;
  expiresInSeconds: number;
};

export const LoginPage = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');

  const title = useMemo(() => (mode === 'login' ? 'Авторизация' : 'Регистрация'), [mode]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const displayName = String(formData.get('displayName') ?? '').trim();

    if (!email) return alert('Введите e-mail');
    if (!password.trim()) return alert('Введите пароль');
    if (mode === 'register' && !displayName) return alert('Введите отображаемый ник');

    try {
      const res = mode === 'login'
        ? await api.post<AuthResponse>('/v1/auth/login', { email, password })
        : await api.post<AuthResponse>('/v1/auth/register', { email, password, displayName });

      const token = res.data?.accessToken;
      if (!token) return alert('Ошибка: сервер не вернул accessToken');

      setAccessToken(token);
      navigate('/games');
    } catch (e: any) {
      console.error(e);
      alert('Ошибка: ' + (e?.response?.data ?? e?.message ?? 'unknown'));
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.top}>
            <h1 className={styles.title}>{title}</h1>

            <div className={styles.tabs} role="tablist" aria-label="Авторизация или регистрация">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={`${styles.tab} ${mode === 'login' ? styles.activeTab : ''}`}
                onClick={() => setMode('login')}
              >
                Авторизация
              </button>

              <span className={styles.tabSep}>/</span>

              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                className={`${styles.tab} ${mode === 'register' ? styles.activeTab : ''}`}
                onClick={() => setMode('register')}
              >
                Регистрация
              </button>
            </div>
          </div>

          <form className={styles.form} onSubmit={submit}>
            {mode === 'register' && (
              <label className={styles.field} htmlFor="login-display-name">
                <div className={styles.label}>Отображаемый ник</div>
                <input
                  id="login-display-name"
                  name="displayName"
                  data-testid="display-name-input"
                  className={styles.input}
                  placeholder="например: kolya"
                  autoComplete="nickname"
                />
              </label>
            )}

            <label className={styles.field} htmlFor="login-email">
              <div className={styles.label}>E-mail</div>
              <input
                id="login-email"
                name="email"
                data-testid="email-input"
                className={styles.input}
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
              />
            </label>

            <label className={styles.field} htmlFor="login-password">
              <div className={styles.label}>Пароль</div>
              <input
                id="login-password"
                name="password"
                data-testid="password-input"
                className={styles.input}
                type="password"
                placeholder="********"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>

            <button data-testid="auth-submit" className={styles.submit} type="submit">
              {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </button>

            <div className={styles.hint}>
              {mode === 'login' ? (
                <>
                  Нет аккаунта?{' '}
                  <button
                    className={styles.hintLink}
                    type="button"
                    onClick={() => setMode('register')}
                  >
                    Зарегистрироваться
                  </button>
                </>
              ) : (
                <>
                  Уже есть аккаунт?{' '}
                  <button
                    className={styles.hintLink}
                    type="button"
                    onClick={() => setMode('login')}
                  >
                    Войти
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
