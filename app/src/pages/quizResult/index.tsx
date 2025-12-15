import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './QuizResult.module.scss';
import { LeaderboardCard } from '@/components/LeaderboardCard/LeaderboardCard';

type AnswerResponse = {
  finished: boolean;
  reason?: string | null;
  score: number;
  maxScore: number;
  correctAnswers: number;
  totalQuestions: number;
  totalTimeMs: number;
};

type ResultPayload = {
  finished: AnswerResponse;
  answers: (boolean | null)[];
};

export const QuizResultPage = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [payload, setPayload] = useState<ResultPayload | null>(null);

  useEffect(() => {
    if (!quizId) return;

    const raw = sessionStorage.getItem(`quiz:${quizId}:resultPayload`);
    if (!raw) {
      navigate(`/quizes/${quizId}`, { replace: true });
      return;
    }

    try {
      setPayload(JSON.parse(raw) as ResultPayload);
    } catch {
      sessionStorage.removeItem(`quiz:${quizId}:resultPayload`);
      navigate(`/quizes/${quizId}`, { replace: true });
    }
  }, [quizId, navigate]);

  const isPerfect = useMemo(() => {
    if (!payload) return false;
    const f = payload.finished;
    return f.totalQuestions > 0 && f.correctAnswers === f.totalQuestions && f.score === f.maxScore;
  }, [payload]);

  if (!quizId || !payload) return null;

  const total = payload.finished.totalQuestions;
  const answers = Array.from({ length: total }, (_, i) => payload.answers[i] ?? false);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.grid}>
            <section className={styles.leftCard}>
              <div className={styles.head}>
                <div className={styles.title}>Результаты</div>
                <div className={styles.sub}>
                  Викторина завершена: <b>{payload.finished.reason ?? 'Completed'}</b>
                </div>
              </div>

              <div className={styles.steps} aria-label="Результаты по вопросам">
                {answers.map((ok, i) => (
                  <div
                    key={i}
                    className={[styles.step, ok ? styles.stepOk : styles.stepBad].join(' ')}
                    aria-label={`Вопрос ${i + 1}: ${ok ? 'правильно' : 'неверно'}`}
                  >
                    {ok ? (
                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M9.0 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.71 2.88 18.29 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.3-6.3z"
                        />
                      </svg>
                    )}
                  </div>
                ))}
              </div>

              <div className={styles.stats}>
                <div className={styles.statRow}>
                  <span>Баллы</span>
                  <b>
                    {payload.finished.score} / {payload.finished.maxScore}
                  </b>
                </div>
                <div className={styles.statRow}>
                  <span>Правильных</span>
                  <b>
                    {payload.finished.correctAnswers} / {payload.finished.totalQuestions}
                  </b>
                </div>
              </div>

              <div className={styles.actions}>
                <button className={styles.primaryBtn} onClick={() => navigate('/quizes')}>
                  К викторинам
                </button>
                <button className={styles.secondaryBtn} onClick={() => navigate(`/quiz/${quizId}`)}>
                  На страницу викторины
                </button>
              </div>
            </section>

            <LeaderboardCard quizId={quizId} showMyPlaceIfPerfect={isPerfect} />
          </div>
        </div>
      </main>
    </div>
  );
};
