import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './QuizPlay.module.scss';
import { api, getAccessToken } from '@/shared/lib';

type OptionDto = { id: string; text: string };

type PublicQuestionDto = {
  id: string;
  order: number;
  text: string;
  points: number;
  timeLimitMs: number;
  correctOptionId?: string | null;
  options: OptionDto[];
};

type StartResponse = {
  attemptId: string;
  questionToken: string;
  questionExpiresAtUtc: string;
  question: PublicQuestionDto;
};

type AnswerRequest = {
  attemptId: string;
  questionToken: string;
  selectedOptionId: string;
};

type AnswerResponse = {
  finished: boolean;
  reason?: string | null;
  score: number;
  maxScore: number;
  correctAnswers: number;
  totalQuestions: number;
  totalTimeMs: number;
  nextQuestionToken?: string | null;
  nextQuestionExpiresAtUtc?: string | null;
  nextQuestion?: PublicQuestionDto | null;
};

type QuizMetaLite = { questionsCount: number };

type ResultPayload = {
  finished: AnswerResponse;
  answers: (boolean | null)[];
};

type Feedback = 'correct' | 'wrong' | null;

const SUPPORT_PHRASES = [
  'У тебя всё получится 🙂',
  'Ты справишься, я верю в тебя!',
  'Спокойно. Один вопрос за раз.',
  'Отличный темп — продолжай!',
  'Не торопись, думай уверенно.',
  'Даже сложные вопросы тебе по плечу.',
  'Супер! Держи фокус.',
  'Ошибки — часть пути. Идём дальше.',
  'Хорошая попытка. Следующий будет твой.',
  'Ты уже близко. Продолжай!',
  'Соберись — ты можешь.',
  'Сейчас будет красиво 🙂',
  'Дыши. Ты контролируешь игру.',
  'Отвечай смело — результат важнее сомнений.',
  'Ты молодец. Продолжаем!',
];

function pickPhrase(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % SUPPORT_PHRASES.length;
  return SUPPORT_PHRASES[idx];
}

function parseUtcMs(isoUtc: string) {
  const ms = Date.parse(isoUtc);
  return Number.isNaN(ms) ? null : ms;
}

function getServerOffsetMsFromHeaders(headers: any) {
  const dateHeader = headers?.date ?? headers?.Date;
  if (!dateHeader) return null;

  const serverMs = Date.parse(String(dateHeader));
  if (Number.isNaN(serverMs)) return null;

  const clientMs = Date.now();
  return serverMs - clientMs;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const QuizPlayPage = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questionToken, setQuestionToken] = useState<string | null>(null);
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [question, setQuestion] = useState<PublicQuestionDto | null>(null);

  const [serverOffsetMs, setServerOffsetMs] = useState<number>(0);

  const [remainingMs, setRemainingMs] = useState<number>(0);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const [finished, setFinished] = useState<AnswerResponse | null>(null);

  const [totalQuestions, setTotalQuestions] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(boolean | null)[]>([]);

  const rafRef = useRef<number | null>(null);

  function randomPhrase() {
    if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return SUPPORT_PHRASES[buf[0] % SUPPORT_PHRASES.length];
    }
    return SUPPORT_PHRASES[Math.floor(Math.random() * SUPPORT_PHRASES.length)];
  }

  const [phrase, setPhrase] = useState(() => randomPhrase());

  useEffect(() => {
    if (!question?.id) return;
    setPhrase(randomPhrase());
  }, [question?.id]);

  const secondsLeft = useMemo(() => Math.max(0, Math.ceil(remainingMs / 1000)), [remainingMs]);

  const options = question?.options ?? [];
  const isListLayout = options.length > 6;

  const progress = useMemo(() => {
    if (!question) return 0;
    const total = Math.max(1, question.timeLimitMs);
    return Math.max(0, Math.min(1, remainingMs / total));
  }, [question, remainingMs]);

  const nowServerMs = () => Date.now() + serverOffsetMs;

  const stopTimer = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const runTimer = () => {
    stopTimer();

    const tick = () => {
      if (!expiresAtMs) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const left = Math.max(0, expiresAtMs - nowServerMs());
      setRemainingMs(left);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const loadStartPayload = async () => {
    if (!quizId) return;

    if (!getAccessToken()) {
      navigate('/login');
      return;
    }

    const key = `quiz:${quizId}:startPayload`;
    const raw = sessionStorage.getItem(key);

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StartResponse;
        const exp = parseUtcMs(parsed.questionExpiresAtUtc);

        setAnswers([]);

        setAttemptId(parsed.attemptId);
        setQuestionToken(parsed.questionToken);
        setQuestion(parsed.question);
        setExpiresAtMs(exp);
        setRemainingMs(exp ? Math.max(0, exp - nowServerMs()) : parsed.question.timeLimitMs);
        return;
      } catch {
        sessionStorage.removeItem(key);
      }
    }

    const res = await api.post<StartResponse>(`/v1/quizzes/${quizId}/start`, {});
    const off = getServerOffsetMsFromHeaders(res.headers);
    if (off != null) setServerOffsetMs(off);

    sessionStorage.setItem(key, JSON.stringify(res.data));

    const exp = parseUtcMs(res.data.questionExpiresAtUtc);

    setAnswers([]);

    setAttemptId(res.data.attemptId);
    setQuestionToken(res.data.questionToken);
    setQuestion(res.data.question);
    setExpiresAtMs(exp);
    setRemainingMs(
      exp
        ? Math.max(0, exp - (Date.now() + (off ?? serverOffsetMs)))
        : res.data.question.timeLimitMs
    );
  };

  useEffect(() => {
    if (!quizId) return;

    api
      .get<QuizMetaLite>(`/v1/quizzes/${quizId}`)
      .then(r => setTotalQuestions(r.data.questionsCount))
      .catch(() => setTotalQuestions(null));
  }, [quizId]);

  useEffect(() => {
    (async () => {
      try {
        await loadStartPayload();
      } catch (e: any) {
        const msg = e?.response?.data ?? e?.message ?? 'Не удалось начать викторину';
        alert(String(msg));
        navigate(`/quizes/${quizId}`);
      }
    })();

    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  useEffect(() => {
    if (!question || !expiresAtMs) return;

    setLocked(false);
    setFeedback(null);
    setFinished(null);

    runTimer();
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, expiresAtMs]);

  useEffect(() => {
    if (!quizId || !finished?.finished) return;

    const payload: ResultPayload = { finished, answers };
    sessionStorage.setItem(`quiz:${quizId}:resultPayload`, JSON.stringify(payload));
    sessionStorage.removeItem(`quiz:${quizId}:startPayload`);

    navigate(`/quiz/${quizId}/result`, { replace: true });
  }, [quizId, finished?.finished, navigate, answers]);

  const applyNext = (data: AnswerResponse, headers: any) => {
    const off = getServerOffsetMsFromHeaders(headers);
    if (off != null) setServerOffsetMs(off);

    if (data.finished) {
      setFinished(data);
      stopTimer();
      setLocked(true);
      setTotalQuestions(prev => prev ?? data.totalQuestions);
      return;
    }

    if (!data.nextQuestion || !data.nextQuestionToken || !data.nextQuestionExpiresAtUtc) {
      setFinished({ ...data, finished: true, reason: data.reason ?? 'Completed' });
      stopTimer();
      setLocked(true);
      setTotalQuestions(prev => prev ?? data.totalQuestions);
      return;
    }

    const nextExp = parseUtcMs(data.nextQuestionExpiresAtUtc);

    setQuestionToken(data.nextQuestionToken);
    setQuestion(data.nextQuestion);
    setExpiresAtMs(nextExp);
    setRemainingMs(
      nextExp
        ? Math.max(0, nextExp - (Date.now() + (off ?? serverOffsetMs)))
        : data.nextQuestion.timeLimitMs
    );
  };

  const sendAnswer = async (selectedOptionId: string) => {
    if (!quizId || !attemptId || !questionToken || !question) return;
    if (locked) return;

    setLocked(true);

    const isCorrect =
      !isTimedOut && !!question.correctOptionId && selectedOptionId === question.correctOptionId;
    setFeedback(isCorrect ? 'correct' : 'wrong');

    setAnswers(prev => {
      const next = prev.slice();
      next[question.order] = isCorrect;
      return next;
    });

    const req: AnswerRequest = { attemptId, questionToken, selectedOptionId };

    try {
      const res = await api.post<AnswerResponse>(`/v1/quizzes/${quizId}/answer`, req);

      await sleep(520);

      applyNext(res.data, res.headers);
      setFeedback(null);
      setLocked(false);
    } catch (e: any) {
      const msg = e?.response?.data ?? e?.message ?? 'Ошибка отправки ответа';
      alert(String(msg));
      setLocked(false);
      setFeedback(null);
    }
  };

  if (!question) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.container}>
            <div className={styles.loading}>Загрузка…</div>
          </div>
        </main>
      </div>
    );
  }

  const isTimedOut = remainingMs <= 0 && !finished;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.stack}>
            <div
              className={[
                styles.card,
                feedback === 'correct' ? styles.goodShadow : '',
                feedback === 'wrong' ? styles.badShadow : '',
              ].join(' ')}
            >
              <div className={styles.topRow}>
                {totalQuestions ? (
                  <div className={styles.steps} aria-label="Прогресс по вопросам">
                    {Array.from({ length: totalQuestions }, (_, i) => {
                      const st = answers[i];
                      const isCurrent = i === question.order;

                      return (
                        <div
                          key={i}
                          className={[
                            styles.step,
                            isCurrent ? styles.stepActive : '',
                            st === true ? styles.stepOk : '',
                            st === false ? styles.stepBad : '',
                          ].join(' ')}
                          aria-hidden="true"
                        >
                          {st === true && (
                            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                              <path
                                fill="currentColor"
                                d="M9.0 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"
                              />
                            </svg>
                          )}
                          {st === false && (
                            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                              <path
                                fill="currentColor"
                                d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.71 2.88 18.29 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.3-6.3z"
                              />
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div />
                )}

                <div className={styles.timerText}>Осталось {secondsLeft} секунд</div>
              </div>

              <div className={styles.progressBar} aria-hidden="true">
                <div
                  className={styles.progressFill}
                  style={{ width: `${Math.round(progress * 1000) / 10}%` }}
                />
              </div>

              <div className={styles.center}>
                <div className={styles.titleRow}>
                  <div />
                  <div className={styles.qTitle}>Вопрос №{question.order + 1}</div>

                  <div
                    className={styles.points}
                    aria-label={`Стоимость вопроса: ${question.points} очков`}
                  >
                    ({question.points} очков)
                  </div>
                </div>

                <div className={styles.qText}>{question.text}</div>
              </div>

              {finished ? (
                <div className={styles.finish}>
                  <div className={styles.finishTitle}>Готово</div>
                  <div className={styles.finishStats}>
                    <div>
                      Счёт: <b>{finished.score}</b> / {finished.maxScore}
                    </div>
                    <div>
                      Правильных: <b>{finished.correctAnswers}</b> / {finished.totalQuestions}
                    </div>
                    <div>
                      Причина: <b>{finished.reason ?? 'Completed'}</b>
                    </div>
                  </div>

                  <div className={styles.finishActions}>
                    <button className={styles.primaryBtn} onClick={() => navigate('/quizes')}>
                      К викторинам
                    </button>
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => {
                        sessionStorage.removeItem(`quiz:${quizId}:startPayload`);
                        navigate(`/quizes/${quizId}`);
                      }}
                    >
                      На страницу викторины
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={isListLayout ? styles.optionsList : styles.optionsGrid}>
                    {options.map(o => (
                      <button
                        key={o.id}
                        className={styles.optionBtn}
                        onClick={() => sendAnswer(o.id)}
                        disabled={locked}
                        type="button"
                      >
                        <span className={styles.optionText}>{o.text}</span>
                      </button>
                    ))}
                  </div>

                  {isTimedOut && (
                    <div className={styles.timeoutNote}>
                      Время вышло. Выбери любой вариант ответа чтобы увидеть свой результат!
                    </div>
                  )}
                </>
              )}

              {feedback && (
                <div className={styles.feedback} aria-hidden="true">
                  <div className={feedback === 'correct' ? styles.badgeOk : styles.badgeBad}>
                    {feedback === 'correct' ? (
                      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M9.0 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.71 2.88 18.29 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.3-6.3z"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              )}
            </div>

            {!finished && <div className={styles.support}>{phrase}</div>}
          </div>
        </div>
      </main>
    </div>
  );
};
