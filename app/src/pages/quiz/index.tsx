import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './Quiz.module.scss';
import { api, getAccessToken } from '@/shared/lib';
import { LeaderboardCard } from '@/components/LeaderboardCard/LeaderboardCard';

type TaskTypeCount = { type: number; count: number };

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
  return ['Quiz', 'True/False', 'Puzzle', 'Open-ended', 'Poll'][type] ?? 'Task';
}

function statusLabel(status: number) {
  return ['UNVERIFIED', 'VERIFIED', 'PENDING', 'REJECTED'][status] ?? 'UNVERIFIED';
}

export const QuizPage = () => {
  const params = useParams<{ gameId?: string; quizId?: string }>();
  const gameId = params.gameId ?? params.quizId;
  const navigate = useNavigate();
  const [game, setGame] = useState<GameMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const bg = useMemo(() => buildGradient(game?.themeColor), [game?.themeColor]);

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

  useEffect(() => {
    void loadGame();
  }, [gameId]);

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
                <div className={styles.desc}>{game.description?.trim() || 'Описание отсутствует.'}</div>

                <div className={styles.metaRow}>
                  <div className={styles.metaItem}><span className={styles.metaLabel}>Автор</span><span className={styles.metaValue}>{game.ownerDisplayName}</span></div>
                  <div className={styles.metaItem}><span className={styles.metaLabel}>Статус</span><span className={styles.metaValue}>{statusLabel(game.status)}</span></div>
                  <div className={styles.metaItem}><span className={styles.metaLabel}>Задач</span><span className={styles.metaValue}>{game.tasksCount}</span></div>
                </div>

                <div className={styles.metaRow}>
                  {game.taskTypeCounts.map(item => (
                    <div className={styles.metaItem} key={`${item.type}-${item.count}`}>
                      <span className={styles.metaLabel}>{taskTypeLabel(item.type)}</span>
                      <span className={styles.metaValue}>{item.count}</span>
                    </div>
                  ))}
                </div>

                {game.moderationDecision && (
                  <div className={styles.desc}>
                    {game.moderationDecision} YES {game.moderationYesVotes} / NO {game.moderationNoVotes}
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
        </div>
      </main>
    </div>
  );
};
