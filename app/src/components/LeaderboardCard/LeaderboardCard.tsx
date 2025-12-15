import { useEffect, useMemo, useState } from 'react';
import styles from './LeaderboardCard.module.scss';
import { api, getAccessToken } from '@/shared/lib';

export type LeaderboardItem = {
  userId: string;
  displayName: string;
  totalTimeMs: number;
  finishedAtUtc: string;
};

function msToSec(ms: number) {
  return Math.round(ms / 1000);
}

function getUserIdFromAccessToken() {
  const token = getAccessToken();
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);
    return typeof payload?.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export function LeaderboardCard(props: { quizId: string; showMyPlaceIfPerfect?: boolean }) {
  const { quizId, showMyPlaceIfPerfect } = props;

  const [lb, setLb] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(false);

  const myId = useMemo(() => getUserIdFromAccessToken(), []);
  const myPlace = useMemo(() => {
    if (!showMyPlaceIfPerfect || !myId) return null;
    const idx = lb.findIndex(x => x.userId === myId);
    return idx >= 0 ? idx + 1 : null;
  }, [lb, myId, showMyPlaceIfPerfect]);

  useEffect(() => {
    if (!quizId) return;

    (async () => {
      try {
        setLoading(true);
        const res = await api.get<LeaderboardItem[]>(`/v1/quizzes/${quizId}/leaderboard`);
        setLb(res.data ?? []);
      } catch {
        setLb([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [quizId]);

  return (
    <aside className={styles.card}>
      <div className={styles.titleRow}>
        <div className={styles.title}>Лидерборд</div>
        {myPlace && <div className={styles.myPlace}>Вы заняли {myPlace}-е место 🎉</div>}
      </div>

      {loading ? (
        <div className={styles.muted}>Загрузка…</div>
      ) : lb.length === 0 ? (
        <div className={styles.muted}>Пока нет результатов. Будь первым 🙂</div>
      ) : (
        <div className={styles.list}>
          {lb.slice(0, 20).map((x, i) => (
            <div className={styles.row} key={`${x.userId}-${i}`}>
              <div className={styles.left}>
                <div className={styles.place}>{i + 1}</div>
                <div className={styles.name}>{x.displayName}</div>
              </div>
              <div className={styles.time}>{msToSec(x.totalTimeMs)}с</div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
