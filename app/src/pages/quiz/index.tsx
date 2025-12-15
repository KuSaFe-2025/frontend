import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './Quiz.module.scss';
import { api } from '@/shared/lib';
import { getAccessToken } from '@/shared/lib';
import { LeaderboardCard } from '@/components/LeaderboardCard/LeaderboardCard';

type QuizMeta = {
  id: string;
  title: string;
  description?: string | null;
  descriptionFormat: number;
  createdAtUtc: string;
  questionsCount: number;
  themeColor?: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hexToRgb(hex: string) {
  const v = hex.replace('#', '').trim();
  if (v.length !== 6) return null;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  if ([r, g, b].some(x => Number.isNaN(x))) return null;
  return { r, g, b };
}

function mix(a: number, b: number, t: number) {
  return Math.round(a * (1 - t) + b * t);
}

function buildGradient(themeColor?: string | null) {
  const base = hexToRgb(themeColor ?? '');
  if (!base) {
    return `linear-gradient(135deg, rgba(124,58,237,0.18), rgba(168,85,247,0.14), rgba(124,58,237,0.10))`;
  }

  const light = {
    r: mix(base.r, 255, 0.55),
    g: mix(base.g, 255, 0.55),
    b: mix(base.b, 255, 0.55),
  };

  const dark = {
    r: mix(base.r, 0, 0.15),
    g: mix(base.g, 0, 0.15),
    b: mix(base.b, 0, 0.15),
  };

  return `linear-gradient(135deg, rgba(${light.r},${light.g},${light.b},0.55), rgba(${base.r},${base.g},${base.b},0.22), rgba(${dark.r},${dark.g},${dark.b},0.18))`;
}

export const QuizPage = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<QuizMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const bg = useMemo(() => buildGradient(quiz?.themeColor), [quiz?.themeColor]);

  useEffect(() => {
    if (!quizId) return;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const res = await api.get<QuizMeta>(`/v1/quizzes/${quizId}`);
        setQuiz(res.data);
      } catch (e: any) {
        setErr(e?.response?.data ?? e?.message ?? 'Ошибка загрузки викторины');
      } finally {
        setLoading(false);
      }
    })();
  }, [quizId]);

  const start = async () => {
    if (!getAccessToken()) {
      navigate('/login');
      return;
    }

    try {
      const res = await api.post(`/v1/quizzes/${quizId}/start`, {});
      sessionStorage.setItem(`quiz:${quizId}:startPayload`, JSON.stringify(res.data));
      navigate(`/quiz/${quizId}/play`);
    } catch (e: any) {
      alert('Не удалось начать: ' + (e?.response?.data ?? e?.message ?? 'unknown'));
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.container}>
            <div className={styles.loading}>Загрузка…</div>
          </div>
        </main>
        <div className={styles.pattern} aria-hidden="true" />
      </div>
    );
  }

  if (err || !quiz) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.container}>
            <div className={styles.error}>
              <div className={styles.errorTitle}>Не удалось открыть викторину</div>
              <div className={styles.errorText}>{String(err ?? 'Not found')}</div>
              <button className={styles.backBtn} onClick={() => navigate('/quizes')}>
                ← Назад к викторинам
              </button>
            </div>
          </div>
        </main>
        <div className={styles.pattern} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.grid}>
            {/* LEFT */}
            <section className={styles.leftCard} style={{ backgroundImage: bg }}>
              <div className={styles.leftInner}>
                <div className={styles.title}>{quiz.title}</div>

                <div className={styles.desc}>
                  {quiz.description?.trim() ? quiz.description : 'Описание отсутствует.'}
                </div>

                <div className={styles.metaRow}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Количество вопросов:</span>{' '}
                    <span className={styles.metaValue}>{quiz.questionsCount}</span>
                  </div>
                </div>

                <button className={styles.startBtn} onClick={start}>
                  Начать
                </button>
              </div>
            </section>

            {/* RIGHT */}
            {quizId && <LeaderboardCard quizId={quizId} />}
          </div>
        </div>
      </main>
    </div>
  );
};
