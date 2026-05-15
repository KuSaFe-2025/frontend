import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import styles from './Quiz.module.scss';
import { api, getAccessToken } from '@/shared/lib';
import { LeaderboardCard } from '@/components/LeaderboardCard/LeaderboardCard';

type TaskTypeCount = { type: number; count: number };
type DetailsTab = 'attempts' | 'reviews';

type Page<T> = {
  items: T[];
  total: number;
  skip: number;
  take: number;
  hasMore: boolean;
};

type AttemptItem = {
  attemptId: string;
  displayName: string;
  totalTimeMs: number;
  finishedAtUtc: string;
  score: number;
  maxScore: number;
};

type ReviewItem = {
  id: string;
  displayName: string;
  rating: number;
  text: string;
  createdAtUtc: string;
};

type GameMeta = {
  id: string;
  title: string;
  description?: string | null;
  descriptionFormat: number;
  createdAtUtc: string;
  tasksCount: number;
  themeColor?: string | null;
  status: number;
  lastModeratedAtUtc?: string | null;
  moderationDecision?: string | null;
  moderationYesVotes: number;
  moderationNoVotes: number;
  ownerDisplayName: string;
  canEdit: boolean;
  taskTypeCounts: TaskTypeCount[];
};

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
  if (!base) return 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(168,85,247,0.14), rgba(124,58,237,0.10))';
  const light = { r: mix(base.r, 255, 0.55), g: mix(base.g, 255, 0.55), b: mix(base.b, 255, 0.55) };
  const dark = { r: mix(base.r, 0, 0.15), g: mix(base.g, 0, 0.15), b: mix(base.b, 0, 0.15) };
  return `linear-gradient(135deg, rgba(${light.r},${light.g},${light.b},0.55), rgba(${base.r},${base.g},${base.b},0.22), rgba(${dark.r},${dark.g},${dark.b},0.18))`;
}

function taskTypeLabel(type: number) {
  return ['Викторина', 'Верно/неверно', 'Порядок', 'Открытый ответ', 'Опрос', 'Множественный выбор'][type] ?? 'Задача';
}

function statusLabel(status: number) {
  return ['Черновик', 'Проверена', 'На проверке', 'Отклонена'][status] ?? 'Черновик';
}

function localizeModerationDecision(decision?: string | null) {
  if (!decision) return '';

  const reasonMatch = decision.match(/Reason:\s*(.+)$/i);
  const reason = localizeModerationReason(reasonMatch?.[1]?.trim());

  if (/Rejected by local AI moderation/i.test(decision)) {
    return reason
      ? `Отклонено локальной AI-модерацией: ${reason}`
      : 'Отклонено локальной AI-модерацией.';
  }

  if (/Approved by local AI moderation/i.test(decision)) {
    return 'Одобрено локальной AI-модерацией.';
  }

  if (/Rejected by deterministic E2E moderation/i.test(decision)) {
    return reason
      ? `Отклонено тестовой модерацией: ${reason}`
      : 'Отклонено тестовой модерацией.';
  }

  if (/Approved by deterministic E2E moderation/i.test(decision)) {
    return 'Одобрено тестовой модерацией.';
  }

  return decision
    .replace(/\bYES\b/g, 'да')
    .replace(/\bNO\b/g, 'нет')
    .replace(/\bReason:\s*/i, 'Причина: ');
}

function localizeModerationReason(reason?: string) {
  if (!reason) return '';

  const normalized = reason.replace(/\s+/g, ' ').trim();
  const knownReasons: Record<string, string> = {
    'This content contains hate speech and profanity that is not suitable for a public educational platform.':
      'Контент содержит ненавистнические высказывания и ненормативную лексику, поэтому не подходит для публичной образовательной платформы.',
    'Content contains a blocked word.':
      'Контент содержит запрещённое слово.',
    'The content did not meet KuSaFe safety rules.':
      'Контент не соответствует правилам безопасности KuSaFe.',
  };

  return knownReasons[normalized] ?? normalized;
}

export const QuizPage = () => {
  const params = useParams<{ gameId?: string; quizId?: string }>();
  const gameId = params.gameId ?? params.quizId;
  const navigate = useNavigate();
  const [game, setGame] = useState<GameMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [detailsTab, setDetailsTab] = useState<DetailsTab>('attempts');
  const [attempts, setAttempts] = useState<Page<AttemptItem> | null>(null);
  const [reviews, setReviews] = useState<Page<ReviewItem> | null>(null);
  const [attemptSort, setAttemptSort] = useState('date_desc');
  const [reviewSort, setReviewSort] = useState('new');

  const bg = useMemo(() => buildGradient(game?.themeColor), [game?.themeColor]);
  const description = game?.description?.trim();
  const markdownDescription = useMemo(() => {
    if (!description || game?.descriptionFormat !== 1) return null;
    return DOMPurify.sanitize(marked.parse(description, { async: false }) as string);
  }, [description, game?.descriptionFormat]);

  const loadGame = async () => {
    if (!gameId) return;
    try {
      setLoading(true);
      setErr(null);
      const res = await api.get<GameMeta>(`/v1/games/${gameId}`);
      setGame(res.data);
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Ошибка загрузки игры'));
    } finally {
      setLoading(false);
    }
  };

  const loadAttempts = async (skip = 0) => {
    if (!gameId) return;
    const res = await api.get<Page<AttemptItem>>(`/v1/games/${gameId}/attempts`, {
      params: { skip, take: 10, sort: attemptSort },
    });
    setAttempts(res.data);
  };

  const loadReviews = async (skip = 0) => {
    if (!gameId) return;
    const res = await api.get<Page<ReviewItem>>(`/v1/games/${gameId}/reviews`, {
      params: { skip, take: 10, sort: reviewSort },
    });
    setReviews(res.data);
  };

  useEffect(() => {
    void loadGame();
  }, [gameId]);

  useEffect(() => {
    void loadAttempts(0).catch(() => setAttempts(null));
  }, [gameId, attemptSort]);

  useEffect(() => {
    void loadReviews(0).catch(() => setReviews(null));
  }, [gameId, reviewSort]);

  const start = async () => {
    if (!getAccessToken()) {
      navigate('/login');
      return;
    }
    try {
      const res = await api.post(`/v1/games/${gameId}/start`, {});
      sessionStorage.setItem(`game:${gameId}:startPayload`, JSON.stringify(res.data));
      navigate(`/game/${gameId}/play`);
    } catch (e: any) {
      alert(`Не удалось начать игру: ${String(e?.response?.data ?? e?.message ?? 'unknown')}`);
    }
  };

  const submitForVerification = async () => {
    if (!game?.canEdit) return;
    try {
      setSubmitting(true);
      await api.post(`/v1/my/games/${game.id}/submit-for-verification`, {});
      await loadGame();
    } catch (e: any) {
      alert(String(e?.response?.data ?? e?.message ?? 'Не удалось отправить игру на проверку'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.container}><div className={styles.loading}>Загрузка...</div></div>
        </main>
        <div className={styles.pattern} aria-hidden="true" />
      </div>
    );
  }

  if (err || !game) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.container}>
            <div className={styles.error}>
              <div className={styles.errorTitle}>Не удалось открыть игру</div>
              <div className={styles.errorText}>{String(err ?? 'Not found')}</div>
              <button className={styles.backBtn} onClick={() => navigate('/games')}>Назад к играм</button>
            </div>
          </div>
        </main>
        <div className={styles.pattern} aria-hidden="true" />
      </div>
    );
  }

  const canPlay = game.status === 1 || game.canEdit;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.grid}>
            <section className={styles.leftCard} style={{ backgroundImage: bg }}>
              <div className={styles.leftInner}>
                <div className={styles.title}>{game.title}</div>
                {description ? (
                  markdownDescription ? (
                    <div className={`${styles.desc} ${styles.markdown}`} dangerouslySetInnerHTML={{ __html: markdownDescription }} />
                  ) : (
                    <div className={styles.desc}>{description}</div>
                  )
                ) : (
                  <div className={styles.desc}>Описание отсутствует.</div>
                )}

                <div className={styles.metaDivider} aria-hidden="true" />

                <div className={styles.metaRow}>
                  <div className={styles.metaItem}><span className={styles.metaLabel}>Автор</span><span className={styles.metaValue}>{game.ownerDisplayName}</span></div>
                  <div className={styles.metaItem}><span className={styles.metaLabel}>Статус</span><span className={styles.metaValue}>{statusLabel(game.status)}</span></div>
                  <div className={styles.metaItem}><span className={styles.metaLabel}>Задач</span><span className={styles.metaValue}>{game.tasksCount}</span></div>
                </div>

                <div className={`${styles.metaRow} ${styles.typeCountsRow}`}>
                  {game.taskTypeCounts.map(item => (
                    <div className={styles.metaItem} key={`${item.type}-${item.count}`}>
                      <span className={styles.metaLabel}>{taskTypeLabel(item.type)}</span>
                      <span className={styles.metaValue}>{item.count}</span>
                    </div>
                  ))}
                </div>

                {game.status === 1 && (
                  <div className={styles.approvedBadge}>
                    <span className={styles.approvedDot} aria-hidden="true" />
                    <span>Проверено KuSaFe</span>
                  </div>
                )}

                {game.status === 3 && game.moderationDecision && (
                  <div className={styles.rejectedBadge}>
                    <span className={styles.rejectedDot} aria-hidden="true" />
                    <span>{localizeModerationDecision(game.moderationDecision)}</span>
                  </div>
                )}

                {canPlay ? (
                  <button className={styles.startBtn} onClick={start}>Начать</button>
                ) : (
                  <button className={styles.startBtn} disabled>Игра недоступна</button>
                )}

                {game.canEdit && game.status !== 1 && game.status !== 2 && (
                  <>
                    <button className={styles.backBtn} onClick={() => navigate('/my-games')}>Открыть кабинет автора</button>
                    <button className={styles.backBtn} disabled={submitting} onClick={submitForVerification}>Отправить на проверку</button>
                  </>
                )}
              </div>
            </section>
            <LeaderboardCard gameId={game.id} />
          </div>
          <section className={styles.detailsPanel}>
            <div className={styles.detailsHead}>
              <div className={styles.detailsTabs} role="tablist">
                <button className={detailsTab === 'attempts' ? styles.detailsTabActive : styles.detailsTab} onClick={() => setDetailsTab('attempts')} type="button">
                  Все прохождения
                </button>
                <button className={detailsTab === 'reviews' ? styles.detailsTabActive : styles.detailsTab} onClick={() => setDetailsTab('reviews')} type="button">
                  Отзывы
                </button>
              </div>
              {detailsTab === 'attempts' ? (
                <select className={styles.sortSelect} value={attemptSort} onChange={e => setAttemptSort(e.target.value)}>
                  <option value="date_desc">Сначала новые</option>
                  <option value="date_asc">Сначала старые</option>
                  <option value="score_desc">Баллы по убыванию</option>
                  <option value="score_asc">Баллы по возрастанию</option>
                  <option value="time_asc">Время быстрее</option>
                  <option value="time_desc">Время дольше</option>
                </select>
              ) : (
                <select className={styles.sortSelect} value={reviewSort} onChange={e => setReviewSort(e.target.value)}>
                  <option value="new">Сначала новые</option>
                  <option value="rating_desc">Высокая оценка</option>
                  <option value="rating_asc">Низкая оценка</option>
                </select>
              )}
            </div>

            {detailsTab === 'attempts' ? (
              <>
                <div className={styles.table}>
                  <div className={styles.tableHead}>
                    <span>Игрок</span>
                    <span>Время</span>
                    <span>Дата</span>
                    <span>Баллы</span>
                  </div>
                  {(attempts?.items ?? []).map(item => (
                    <div className={styles.tableRow} key={item.attemptId}>
                      <span>{item.displayName}</span>
                      <span>{Math.round(item.totalTimeMs / 1000)} с</span>
                      <span>{new Date(item.finishedAtUtc).toLocaleString('ru-RU')}</span>
                      <span>{item.score} / {item.maxScore}</span>
                    </div>
                  ))}
                </div>
                {(attempts?.items.length ?? 0) === 0 && <div className={styles.emptyState}>Прохождений пока нет.</div>}
                <div className={styles.pager}>
                  <button className={styles.backBtn} disabled={!attempts || attempts.skip <= 0} onClick={() => loadAttempts(Math.max(0, (attempts?.skip ?? 0) - 10))}>Назад</button>
                  <span>{attempts ? `${attempts.skip + (attempts.items.length ? 1 : 0)}-${attempts.skip + attempts.items.length} из ${attempts.total}` : '0 из 0'}</span>
                  <button className={styles.backBtn} disabled={!attempts?.hasMore} onClick={() => loadAttempts((attempts?.skip ?? 0) + 10)}>Дальше</button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.reviewsList}>
                  {(reviews?.items ?? []).map(review => (
                    <article className={styles.reviewCard} key={review.id}>
                      <div className={styles.reviewTop}>
                        <div>
                          <b>{review.displayName}</b>
                          <div>{new Date(review.createdAtUtc).toLocaleString('ru-RU')}</div>
                        </div>
                        <span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                      </div>
                      <p>{review.text}</p>
                    </article>
                  ))}
                </div>
                {(reviews?.items.length ?? 0) === 0 && <div className={styles.emptyState}>Отзывов пока нет.</div>}
                <div className={styles.pager}>
                  <button className={styles.backBtn} disabled={!reviews || reviews.skip <= 0} onClick={() => loadReviews(Math.max(0, (reviews?.skip ?? 0) - 10))}>Назад</button>
                  <span>{reviews ? `${reviews.skip + (reviews.items.length ? 1 : 0)}-${reviews.skip + reviews.items.length} из ${reviews.total}` : '0 из 0'}</span>
                  <button className={styles.backBtn} disabled={!reviews?.hasMore} onClick={() => loadReviews((reviews?.skip ?? 0) + 10)}>Дальше</button>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};
