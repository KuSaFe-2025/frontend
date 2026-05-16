import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lightbulb } from 'lucide-react';
import styles from './QuizResult.module.scss';
import { LeaderboardCard } from '@/components/LeaderboardCard/LeaderboardCard';
import { api, getAccessToken } from '@/shared/lib';

type AnswerResponse = {
  finished: boolean;
  reason?: string | null;
  score: number;
  maxScore: number;
  correctAnswers: number;
  totalTasks: number;
  scoredTasks?: number;
  neutralTasks?: number;
  totalTimeMs: number;
};

type ResultPayload = {
  attemptId?: string;
  finished: AnswerResponse;
  answers: (boolean | null)[];
};

type AttemptReviewOption = {
  id: string;
  text: string;
};

type AttemptReviewItem = {
  answerId: string;
  taskId: string;
  type: number;
  order: number;
  taskText: string;
  points: number;
  timeSpentMs: number;
  isCorrect: boolean | null;
  options: AttemptReviewOption[];
  selectedOptionIds: string[];
  selectedOptionTexts: string[];
  textAnswer?: string | null;
  submittedOrderOptionIds: string[];
  submittedOrderTexts: string[];
  correctOptionIds: string[];
  correctOptionTexts: string[];
};

type AttemptReview = {
  attemptId: string;
  gameId: string;
  gameTitle: string;
  score: number;
  maxScore: number;
  totalTimeMs: number;
  startedAtUtc: string;
  finishedAtUtc: string;
  items: AttemptReviewItem[];
};

type ExplanationState = {
  loading?: boolean;
  text?: string;
  error?: string;
};

function taskTypeLabel(type: number) {
  switch (type) {
    case 0:
      return 'Викторина';
    case 1:
      return 'Верно/неверно';
    case 2:
      return 'Порядок';
    case 3:
      return 'Открытый ответ';
    case 4:
      return 'Опрос';
    case 5:
      return 'Множественный выбор';
    default:
      return 'Задача';
  }
}

function answerStatusLabel(value: boolean | null) {
  if (value === true) return 'Верно';
  if (value === false) return 'Неверно';
  return 'Без оценки';
}

export const QuizResultPage = () => {
  const params = useParams<{ gameId?: string; quizId?: string }>();
  const gameId = params.gameId ?? params.quizId;
  const navigate = useNavigate();
  const [payload, setPayload] = useState<ResultPayload | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewSaved, setReviewSaved] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewErr, setReviewErr] = useState<string | null>(null);
  const [attemptReview, setAttemptReview] = useState<AttemptReview | null>(null);
  const [answersBusy, setAnswersBusy] = useState(false);
  const [answersErr, setAnswersErr] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, ExplanationState>>({});

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
  const scoredTasks = payload.finished.scoredTasks ?? payload.finished.totalTasks;
  const neutralTasks = payload.finished.neutralTasks ?? Math.max(0, payload.finished.totalTasks - scoredTasks);
  const answers = Array.from({ length: total }, (_, i) => payload.answers[i] ?? null);
  const canLoadAnswers = !!payload.attemptId;

  const loadAnswers = async () => {
    if (!gameId || !payload.attemptId) {
      setAnswersErr('Не удалось найти идентификатор попытки.');
      return;
    }

    setAnswersBusy(true);
    setAnswersErr(null);
    try {
      const res = await api.get<AttemptReview>(`/v1/games/${gameId}/attempts/${payload.attemptId}/review`);
      setAttemptReview(res.data);
    } catch (e: any) {
      setAnswersErr(String(e?.response?.data ?? e?.message ?? 'Не удалось загрузить ответы'));
    } finally {
      setAnswersBusy(false);
    }
  };

  const explainAnswer = async (answerId: string) => {
    if (!gameId || !payload.attemptId) return;

    setExplanations(prev => ({ ...prev, [answerId]: { loading: true } }));
    try {
      const res = await api.post<{ explanation: string }>(`/v1/games/${gameId}/attempts/${payload.attemptId}/answers/${answerId}/explain`, {});
      setExplanations(prev => ({ ...prev, [answerId]: { text: res.data.explanation } }));
    } catch (e: any) {
      setExplanations(prev => ({
        ...prev,
        [answerId]: { error: String(e?.response?.data ?? e?.message ?? 'AI не смог объяснить ответ') },
      }));
    }
  };

  const submitReview = async () => {
    if (!getAccessToken()) {
      navigate('/login');
      return;
    }
    const text = reviewText.trim();
    if (!text) {
      setReviewErr('Введите текст отзыва.');
      return;
    }
    setReviewBusy(true);
    setReviewErr(null);
    try {
      await api.post(`/v1/games/${gameId}/reviews`, { rating, text });
      setReviewSaved(true);
      setReviewText('');
    } catch (e: any) {
      setReviewErr(String(e?.response?.data ?? e?.message ?? 'Не удалось сохранить отзыв'));
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.grid}>
            <section className={styles.leftCard}>
              <div className={styles.head}>
                <div className={styles.title}>Результаты игры</div>
                <div className={styles.sub}>Прохождение завершено: <b>{payload.finished.reason ?? 'Completed'}</b></div>
              </div>
              <div className={styles.steps} aria-label="Результаты по заданиям">
                {answers.map((ok, i) => (
                  <div key={i} className={[styles.step, ok === true ? styles.stepOk : ok === false ? styles.stepBad : styles.step].join(' ')} aria-label={`Задание ${i + 1}`}>
                    {ok === true ? '✓' : ok === false ? '×' : '•'}
                  </div>
                ))}
              </div>
              <div className={styles.stats}>
                <div className={styles.statRow}><span>Баллы</span><b>{payload.finished.score} / {payload.finished.maxScore}</b></div>
                <div className={styles.statRow}><span>Правильных</span><b>{payload.finished.correctAnswers} / {scoredTasks}</b></div>
                {neutralTasks > 0 && <div className={styles.statRow}><span>Не оцениваются</span><b>- {neutralTasks}</b></div>}
                <div className={styles.statRow}><span>Время</span><b>{Math.round(payload.finished.totalTimeMs / 1000)} с</b></div>
                <div className={styles.statRow}><span>Примечание</span><b>Open-ended и Poll не влияют на счёт</b></div>
              </div>
              <div className={styles.actions}>
                <button className={styles.primaryBtn} onClick={() => navigate('/games')}>К играм</button>
                <button className={styles.secondaryBtn} onClick={() => navigate(`/game/${gameId}`)}>На страницу игры</button>
                <button className={styles.secondaryBtn} disabled={!canLoadAnswers || answersBusy} onClick={loadAnswers} type="button">
                  {answersBusy ? 'Загрузка...' : 'Посмотреть мои ответы'}
                </button>
              </div>
              {answersErr && <div className={styles.reviewErr}>{answersErr}</div>}

              {attemptReview && (
                <section className={styles.answersReview} data-testid="attempt-review">
                  <div className={styles.reviewTitle}>Мои ответы</div>
                  {attemptReview.items.map(item => {
                    const explanation = explanations[item.answerId] ?? {};
                    const selectedTexts = item.type === 2 ? item.submittedOrderTexts : item.selectedOptionTexts;
                    return (
                      <article className={styles.answerCard} key={item.answerId} data-testid="attempt-review-item">
                        <div className={styles.answerHead}>
                          <div>
                            <div className={styles.answerKicker}>{taskTypeLabel(item.type)} · задание {item.order + 1}</div>
                            <h2>{item.taskText}</h2>
                          </div>
                          <span className={[
                            styles.answerStatus,
                            item.isCorrect === true ? styles.answerStatusOk : '',
                            item.isCorrect === false ? styles.answerStatusBad : '',
                          ].join(' ')}>
                            {answerStatusLabel(item.isCorrect)}
                          </span>
                        </div>

                        {item.options.length > 0 && (
                          <div className={styles.optionReadOnlyGrid}>
                            {item.options.map(option => {
                              const selected = item.selectedOptionIds.includes(option.id) || item.submittedOrderOptionIds.includes(option.id);
                              const correct = item.correctOptionIds.includes(option.id);
                              return (
                                <div
                                  key={option.id}
                                  className={[
                                    styles.optionReadOnly,
                                    selected ? styles.optionSelected : '',
                                    correct ? styles.optionCorrect : '',
                                  ].join(' ')}
                                  aria-readonly="true"
                                >
                                  <span>{option.text}</span>
                                  <small>{correct ? 'правильный' : selected ? 'выбран' : ''}</small>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {item.textAnswer && (
                          <label className={styles.readOnlyField}>
                            <span>Ваш ответ</span>
                            <textarea value={item.textAnswer} readOnly aria-readonly="true" />
                          </label>
                        )}

                        <div className={styles.answerMeta}>
                          <span>Ваш ответ: <b>{selectedTexts.length ? selectedTexts.join(' → ') : item.textAnswer || 'не указан'}</b></span>
                          <span>Правильный ответ: <b>{item.correctOptionTexts.length ? item.correctOptionTexts.join(' → ') : 'без правильного ответа'}</b></span>
                          <span>Время: <b>{Math.round(item.timeSpentMs / 1000)} с</b></span>
                        </div>

                        <button
                          className={styles.explainBtn}
                          disabled={!!explanation.loading}
                          onClick={() => void explainAnswer(item.answerId)}
                          type="button"
                        >
                          <Lightbulb size={17} />
                          {explanation.loading ? 'AI думает...' : 'Объяснить'}
                        </button>

                        {explanation.text && (
                          <div className={styles.explanationBox} data-testid="answer-explanation">
                            <Lightbulb size={20} />
                            <span>{explanation.text}</span>
                          </div>
                        )}
                        {explanation.error && <div className={styles.reviewErr}>{explanation.error}</div>}
                      </article>
                    );
                  })}
                </section>
              )}

              <div className={styles.reviewBox}>
                <div className={styles.reviewTitle}>Оставить отзыв</div>
                <div className={styles.stars}>
                  {[1, 2, 3, 4, 5].map(value => (
                    <button key={value} className={value <= rating ? styles.starActive : styles.star} type="button" onClick={() => setRating(value)}>
                      ★
                    </button>
                  ))}
                </div>
                <textarea className={styles.textarea} value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="Ваше впечатление от игры" />
                {reviewErr && <div className={styles.reviewErr}>{reviewErr}</div>}
                {reviewSaved && <div className={styles.reviewOk}>Отзыв сохранен.</div>}
                <button className={styles.primaryBtn} disabled={reviewBusy || reviewSaved} onClick={submitReview} type="button">
                  {reviewSaved ? 'Отзыв отправлен' : 'Оставить отзыв'}
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
