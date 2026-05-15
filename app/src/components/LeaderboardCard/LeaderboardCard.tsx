import { useEffect, useMemo, useState } from 'react';
import styles from './LeaderboardCard.module.scss';
import { api } from '@/shared/lib';
import { getCurrentUserId } from '@/shared/lib/authAdmin';

export type LeaderboardItem = {
  userId: string;
  displayName: string;
  totalTimeMs: number;
  finishedAtUtc: string;
  score: number;
  maxScore: number;
  correctAnswers: number;
  totalTasks: number;
};

function msToSec(ms: number) {
  return Math.round(ms / 1000);
}

export function LeaderboardCard(props: { gameId: string; showMyPlaceIfPerfect?: boolean }) {
  const { gameId, showMyPlaceIfPerfect } = props;
  const [lb, setLb] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const myId = useMemo(() => getCurrentUserId(), []);
  const myPlace = useMemo(() => {
    if (!showMyPlaceIfPerfect || !myId) return null;
    const idx = lb.findIndex(x => x.userId === myId);
    return idx >= 0 ? idx + 1 : null;
  }, [lb, myId, showMyPlaceIfPerfect]);

  useEffect(() => {
    if (!gameId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get<LeaderboardItem[]>(`/v1/games/${gameId}/leaderboard`);
        setLb(res.data ?? []);
      } catch {
        setLb([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [gameId]);

  return (
    <aside className={styles.card}>
      <div className={styles.titleRow}>
        <div className={styles.title}>Лидерборд</div>
        {myPlace && <div className={styles.myPlace}>Вы заняли {myPlace}-е место</div>}
      </div>
      {loading ? (
        <div className={styles.muted}>Загрузка...</div>
      ) : lb.length === 0 ? (
        <div className={styles.muted}>Пока нет результатов. Будьте первым.</div>
      ) : (
        <div className={styles.list}>
          {lb.slice(0, 20).map((x, i) => (
            <div className={styles.row} key={`${x.userId}-${i}`}>
              <div className={styles.left}>
                <div className={styles.place}>{i + 1}</div>
                <div className={styles.name}>
                  {x.displayName}
                  <span className={styles.meta}>{new Date(x.finishedAtUtc).toLocaleDateString()} · {x.score}/{x.maxScore} · {x.correctAnswers}/{x.totalTasks}</span>
                </div>
              </div>
              <div className={styles.time}>{msToSec(x.totalTimeMs)}с</div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
