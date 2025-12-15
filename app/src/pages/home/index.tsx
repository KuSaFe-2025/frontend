import { useNavigate } from 'react-router-dom';
import styles from './Home.module.scss';
import { getAccessToken } from '@/shared/lib';

export const HomePage = () => {
  const navigate = useNavigate();

  const isAuthed = !!getAccessToken();

  const goAuth = () => navigate(isAuthed ? '/quizes' : '/login');

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.title}>KuSaFe Quiz</h1>
          <p className={styles.subtitle}>Бесплатная платформа для проведения викторин</p>

          <button className={styles.startBtn} onClick={goAuth}>
            НАЧАТЬ
          </button>
        </section>
      </main>
      <div className={styles.pattern} aria-hidden="true" />
    </div>
  );
};
