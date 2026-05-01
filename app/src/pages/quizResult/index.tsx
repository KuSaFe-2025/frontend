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
  totalTasks: number;
  totalTimeMs: number;
};

type ResultPayload = {
  finished: AnswerResponse;
  answers: (boolean | null)[];
};

export const QuizResultPage = () => {
  const params = useParams<{ gameId?: string; quizId?: string }>();
  const gameId = params.gameId ?? params.quizId;
  const navigate = useNavigate();
  const [payload, setPayload] = useState<ResultPayload | null>(null);

  useEffect(() => {
    if (!gameId) return;

    const raw = sessionStorage.getItem(`game:${gameId}:resultPayload`);
    if (!raw) {
      navigate(`/game/${gameId}`, { replace: true });
      return;
    }

    try {
      setPayload(JSON.parse(raw) as ResultPayload);
    } catch {
      sessionStorage.removeItem(`game:${gameId}:resultPayload`);
      navigate(`/game/${gameId}`, { replace: true });
    }
  }, [gameId, navigate]);

  const isPerfect = useMemo(() => {
    if (!payload) return false;
    const f = payload.finished;
    return f.totalTasks > 0 && f.score === f.maxScore && f.maxScore > 0;
  }, [payload]);

  if (!gameId || !payload) return null;

  const total = payload.finished.totalTasks;
  const answers = Array.from({ length: total }, (_, i) => payload.answers[i] ?? null);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.grid}>
            <section className={styles.leftCard}>
              <div className={styles.head}>
                <div className={styles.title}>Результаты игры</div>
                <div className={styles.sub}>
                  Прохождение завершено: <b>{payload.finished.reason ?? 'Completed'}</b>
                </div>
              </div>

              <div className={styles.steps} aria-label="Результаты по заданиям">
                {answers.map((ok, i) => (
                  <div
                    key={i}
                    className={[
                      styles.step,
                      ok === true ? styles.stepOk : ok === false ? styles.stepBad : styles.step,
                    ].join(' ')}
                    aria-label={`Задание ${i + 1}`}
                  >
                    {ok === true ? '✓' : ok === false ? '×' : '•'}
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
                    {payload.finished.correctAnswers} / {payload.finished.totalTasks}
                  </b>
                </div>
                <div className={styles.statRow}>
                  <span>Время</span>
                  <b>{Math.round(payload.finished.totalTimeMs / 1000)} с</b>
                </div>
                <div className={styles.statRow}>
                  <span>Примечание</span>
                  <b>Open-ended и Poll не влияют на счёт</b>
                </div>
              </div>

              <div className={styles.actions}>
                <button className={styles.primaryBtn} onClick={() => navigate('/games')}>
                  К играм
                </button>
                <button className={styles.secondaryBtn} onClick={() => navigate(`/game/${gameId}`)}>
                  На страницу игры
                </button>
              </div>
            </section>

            <LeaderboardCard gameId={gameId} showMyPlaceIfPerfect={isPerfect} />
          </div>
        </div>
      </main>
    </div>
  );
};
