import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './QuizPlay.module.scss';
import { api, getAccessToken } from '@/shared/lib';

type OptionDto = { id: string; text: string };

type PublicTaskDto = {
  id: string;
  type: number;
  order: number;
  text: string;
  points: number;
  timeLimitMs: number;
  options: OptionDto[];
};

type StartResponse = {
  attemptId: string;
  questionToken: string;
  questionExpiresAtUtc: string;
  task: PublicTaskDto;
};

type AnswerRequest = {
  attemptId: string;
  questionToken: string;
  selectedOptionId?: string | null;
  textAnswer?: string | null;
  orderedOptionIds?: string[] | null;
};

type AnswerResponse = {
  finished: boolean;
  reason?: string | null;
  lastAnswerCorrect?: boolean | null;
  score: number;
  maxScore: number;
  correctAnswers: number;
  totalTasks: number;
  totalTimeMs: number;
  nextQuestionToken?: string | null;
  nextQuestionExpiresAtUtc?: string | null;
  nextTask?: PublicTaskDto | null;
};

type GameMetaLite = { tasksCount: number };

type ResultPayload = {
  finished: AnswerResponse;
  answers: (boolean | null)[];
};

const SUPPORT_PHRASES = [
  'Один шаг за раз.',
  'Темп хороший, продолжай.',
  'Спокойно. Следующая задача уже близко.',
  'Фокус на текущем ответе.',
  'Хорошая серия, держи ритм.',
  'Смешанные форматы тебе по плечу.',
];

function parseUtcMs(isoUtc: string) {
  const ms = Date.parse(isoUtc);
  return Number.isNaN(ms) ? null : ms;
}

function getServerOffsetMsFromHeaders(headers: any) {
  const dateHeader = headers?.date ?? headers?.Date;
  if (!dateHeader) return null;
  const serverMs = Date.parse(String(dateHeader));
  if (Number.isNaN(serverMs)) return null;
  return serverMs - Date.now();
}

function taskTypeLabel(type: number) {
  switch (type) {
    case 0:
      return 'Quiz';
    case 1:
      return 'True/False';
    case 2:
      return 'Puzzle';
    case 3:
      return 'Open-ended';
    case 4:
      return 'Poll';
    default:
      return 'Task';
  }
}

export const QuizPlayPage = () => {
  const params = useParams<{ gameId?: string; quizId?: string }>();
  const gameId = params.gameId ?? params.quizId;
  const navigate = useNavigate();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questionToken, setQuestionToken] = useState<string | null>(null);
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [task, setTask] = useState<PublicTaskDto | null>(null);

  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [locked, setLocked] = useState(false);
  const [finished, setFinished] = useState<AnswerResponse | null>(null);
  const [totalTasks, setTotalTasks] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(boolean | null)[]>([]);

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [orderedOptionIds, setOrderedOptionIds] = useState<string[]>([]);

  const rafRef = useRef<number | null>(null);

  const phrase = useMemo(
    () => SUPPORT_PHRASES[Math.abs((task?.order ?? 0) % SUPPORT_PHRASES.length)],
    [task?.order]
  );

  const secondsLeft = useMemo(() => Math.max(0, Math.ceil(remainingMs / 1000)), [remainingMs]);
  const progress = useMemo(() => {
    if (!task) return 0;
    return Math.max(0, Math.min(1, remainingMs / Math.max(1, task.timeLimitMs)));
  }, [remainingMs, task]);

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

      setRemainingMs(Math.max(0, expiresAtMs - nowServerMs()));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const resetTaskState = (nextTask: PublicTaskDto) => {
    setSelectedOptionId(null);
    setTextAnswer('');
    setOrderedOptionIds(nextTask.type === 2 ? nextTask.options.map(option => option.id) : []);
  };

  const loadStartPayload = async () => {
    if (!gameId) return;
    if (!getAccessToken()) {
      navigate('/login');
      return;
    }

    const key = `game:${gameId}:startPayload`;
    const raw = sessionStorage.getItem(key);

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StartResponse;
        const exp = parseUtcMs(parsed.questionExpiresAtUtc);

        setAnswers([]);
        setAttemptId(parsed.attemptId);
        setQuestionToken(parsed.questionToken);
        setTask(parsed.task);
        resetTaskState(parsed.task);
        setExpiresAtMs(exp);
        setRemainingMs(exp ? Math.max(0, exp - nowServerMs()) : parsed.task.timeLimitMs);
        return;
      } catch {
        sessionStorage.removeItem(key);
      }
    }

    const res = await api.post<StartResponse>(`/v1/games/${gameId}/start`, {});
    const off = getServerOffsetMsFromHeaders(res.headers);
    if (off != null) setServerOffsetMs(off);

    sessionStorage.setItem(key, JSON.stringify(res.data));

    const exp = parseUtcMs(res.data.questionExpiresAtUtc);
    setAnswers([]);
    setAttemptId(res.data.attemptId);
    setQuestionToken(res.data.questionToken);
    setTask(res.data.task);
    resetTaskState(res.data.task);
    setExpiresAtMs(exp);
    setRemainingMs(exp ? Math.max(0, exp - (Date.now() + (off ?? serverOffsetMs))) : res.data.task.timeLimitMs);
  };

  useEffect(() => {
    if (!gameId) return;

    api
      .get<GameMetaLite>(`/v1/games/${gameId}`)
      .then(r => setTotalTasks(r.data.tasksCount))
      .catch(() => setTotalTasks(null));
  }, [gameId]);

  useEffect(() => {
    void loadStartPayload();
    return () => stopTimer();
  }, [gameId]);

  useEffect(() => {
    if (!task || !expiresAtMs) return;
    setLocked(false);
    setFinished(null);
    runTimer();
    return () => stopTimer();
  }, [task?.id, expiresAtMs]);

  useEffect(() => {
    if (!gameId || !finished?.finished) return;

    sessionStorage.setItem(
      `game:${gameId}:resultPayload`,
      JSON.stringify({ finished, answers } satisfies ResultPayload)
    );
    sessionStorage.removeItem(`game:${gameId}:startPayload`);
    navigate(`/game/${gameId}/result`, { replace: true });
  }, [answers, finished, gameId, navigate]);

  const applyNext = (data: AnswerResponse, headers: any) => {
    const off = getServerOffsetMsFromHeaders(headers);
    if (off != null) setServerOffsetMs(off);

    if (task) {
      setAnswers(prev => {
        const next = prev.slice();
        next[task.order] = data.lastAnswerCorrect ?? null;
        return next;
      });
    }

    if (data.finished) {
      setFinished(data);
      setLocked(true);
      stopTimer();
      setTotalTasks(prev => prev ?? data.totalTasks);
      return;
    }

    if (!data.nextTask || !data.nextQuestionToken || !data.nextQuestionExpiresAtUtc) {
      setFinished({ ...data, finished: true, reason: data.reason ?? 'Completed' });
      setLocked(true);
      stopTimer();
      return;
    }

    const nextExp = parseUtcMs(data.nextQuestionExpiresAtUtc);
    setQuestionToken(data.nextQuestionToken);
    setTask(data.nextTask);
    resetTaskState(data.nextTask);
    setExpiresAtMs(nextExp);
    setRemainingMs(nextExp ? Math.max(0, nextExp - (Date.now() + (off ?? serverOffsetMs))) : data.nextTask.timeLimitMs);
  };

  const sendAnswer = async (overrideSelectedOptionId?: string) => {
    if (!gameId || !attemptId || !questionToken || !task || locked) return;

    const request: AnswerRequest = {
      attemptId,
      questionToken,
    };

    if (task.type === 0 || task.type === 1 || task.type === 4) {
      request.selectedOptionId = overrideSelectedOptionId ?? selectedOptionId;
      if (!request.selectedOptionId) {
        alert('Выберите вариант ответа.');
        return;
      }
    } else if (task.type === 2) {
      request.orderedOptionIds = orderedOptionIds;
    } else if (task.type === 3) {
      request.textAnswer = textAnswer.trim();
      if (!request.textAnswer) {
        alert('Введите ответ.');
        return;
      }
    }

    try {
      setLocked(true);
      const res = await api.post<AnswerResponse>(`/v1/games/${gameId}/answer`, request);
      applyNext(res.data, res.headers);
      setLocked(false);
    } catch (e: any) {
      alert(String(e?.response?.data ?? e?.message ?? 'Ошибка отправки ответа'));
      setLocked(false);
    }
  };

  const movePuzzleItem = (index: number, direction: -1 | 1) => {
    setOrderedOptionIds(prev => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  if (!task) {
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
  const options = task.options ?? [];
  const puzzleOptions = orderedOptionIds
    .map(id => options.find(option => option.id === id))
    .filter((option): option is OptionDto => !!option);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.stack}>
            <div className={styles.card}>
              <div className={styles.topRow}>
                {totalTasks ? (
                  <div className={styles.steps}>
                    {Array.from({ length: totalTasks }, (_, i) => (
                      <div
                        key={i}
                        className={[
                          styles.step,
                          i === task.order ? styles.stepActive : '',
                          answers[i] === true ? styles.stepOk : '',
                          answers[i] === false ? styles.stepBad : '',
                        ].join(' ')}
                      />
                    ))}
                  </div>
                ) : (
                  <div />
                )}
                <div className={styles.timerText}>Осталось {secondsLeft} сек</div>
              </div>

              <div className={styles.progressBar} aria-hidden="true">
                <div className={styles.progressFill} style={{ width: `${Math.round(progress * 1000) / 10}%` }} />
              </div>

              <div className={styles.center}>
                <div className={styles.titleRow}>
                  <div className={styles.metaLabel}>{taskTypeLabel(task.type)}</div>
                  <div className={styles.qTitle}>Задание №{task.order + 1}</div>
                  <div className={styles.points}>{task.points > 0 ? `${task.points} очков` : 'без оценки'}</div>
                </div>

                <div className={styles.qText}>{task.text}</div>
              </div>

              {task.type === 0 || task.type === 1 || task.type === 4 ? (
                <div className={options.length > 6 ? styles.optionsList : styles.optionsGrid}>
                  {options.map(option => (
                    <button
                      key={option.id}
                      className={styles.optionBtn}
                      onClick={() => void sendAnswer(option.id)}
                      disabled={locked}
                      type="button"
                    >
                      <span className={styles.optionText}>{option.text}</span>
                    </button>
                  ))}
                </div>
              ) : task.type === 2 ? (
                <div className={styles.optionsList}>
                  {puzzleOptions.map((option, index) => (
                    <div key={option.id} className={styles.puzzleRow}>
                      <div className={styles.optionText}>{option.text}</div>
                      <div className={styles.puzzleActions}>
                        <button className={styles.secondaryBtn} onClick={() => movePuzzleItem(index, -1)} type="button">
                          ↑
                        </button>
                        <button className={styles.secondaryBtn} onClick={() => movePuzzleItem(index, 1)} type="button">
                          ↓
                        </button>
                      </div>
                    </div>
                  ))}
                  <button className={styles.primaryBtn} onClick={() => void sendAnswer()} type="button" disabled={locked}>
                    Сохранить порядок
                  </button>
                </div>
              ) : (
                <div className={styles.optionsList}>
                  <textarea
                    className={styles.textAnswer}
                    value={textAnswer}
                    onChange={event => setTextAnswer(event.target.value)}
                    placeholder="Введите ответ"
                  />
                  <button className={styles.primaryBtn} onClick={() => void sendAnswer()} type="button" disabled={locked}>
                    Отправить ответ
                  </button>
                </div>
              )}

              {isTimedOut && (
                <div className={styles.timeoutNote}>
                  Время вышло. Отправьте текущий ответ, чтобы завершить попытку.
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
