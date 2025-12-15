import { useMemo, useState } from 'react';
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const title = useMemo(() => (mode === 'login' ? 'Авторизация' : 'Регистрация'), [mode]);

  const submit = async () => {
    if (!email.trim()) return alert('Введите e-mail');
    if (!password.trim()) return alert('Введите пароль');
    if (mode === 'register' && !displayName.trim()) return alert('Введите отображаемый ник');

    try {
      let res;

      if (mode === 'login') {
        res = await api.post<AuthResponse>('/v1/auth/login', { email, password });
      } else {
        res = await api.post<AuthResponse>('/v1/auth/register', { email, password, displayName });
      }

      const token = res.data?.accessToken;
      if (!token) return alert('Ошибка: сервер не вернул accessToken');

      setAccessToken(token);

      // можно поменять куда редиректить
      navigate('/quizes');
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
              <span
                role="tab"
                aria-selected={mode === 'login'}
                className={`${styles.tab} ${mode === 'login' ? styles.activeTab : ''}`}
                onClick={() => setMode('login')}
              >
                Авторизация
              </span>

              <span className={styles.tabSep}>/</span>

              <span
                role="tab"
                aria-selected={mode === 'register'}
                className={`${styles.tab} ${mode === 'register' ? styles.activeTab : ''}`}
                onClick={() => setMode('register')}
              >
                Регистрация
              </span>
            </div>
          </div>

          <div className={styles.form}>
            {mode === 'register' && (
              <label className={styles.field}>
                <div className={styles.label}>Отображаемый ник</div>
                <input
                  className={styles.input}
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="например: kolya"
                  autoComplete="nickname"
                />
              </label>
            )}

            <label className={styles.field}>
              <div className={styles.label}>E-mail</div>
              <input
                className={styles.input}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
              />
            </label>

            <label className={styles.field}>
              <div className={styles.label}>Пароль</div>
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>

            <button className={styles.submit} onClick={submit}>
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
          </div>
        </div>
      </div>
    </div>
  );
};
