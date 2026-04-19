import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Quizes.module.scss';
import { api } from '@/shared/lib';

type GameListItem = {
  id: string;
  title: string;
  description?: string | null;
  descriptionFormat?: number;
  tasksCount: number;
  themeColor?: string | null;
  status: number;
  ownerDisplayName: string;
  canEdit: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '').trim();
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(x => Number.isNaN(x))) return null;
  return { r, g, b };
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s, l };
}

function hslToCss(h: number, s: number, l: number) {
  return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}

function buildGradient(themeColor?: string | null) {
  const base = (themeColor || '#7C3AED').toUpperCase();
  const rgb = hexToRgb(base) ?? hexToRgb('#7C3AED');
  if (!rgb) return 'linear-gradient(135deg, #7C3AED 0%, #A855F7 45%, #C084FC 100%)';
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const c1 = hslToCss(h, clamp(s * 1.05, 0, 1), clamp(l * 0.85, 0, 1));
  const c2 = hslToCss((h + 18) % 360, clamp(s * 1.1, 0, 1), clamp(l * 1.05, 0, 1));
  const c3 = hslToCss((h + 40) % 360, clamp(s * 0.95, 0, 1), clamp(l * 1.2, 0, 1));
  return `linear-gradient(135deg, ${c1} 0%, ${c2} 45%, ${c3} 100%)`;
}

export const Quizes = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<GameListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get<GameListItem[]>('/v1/games');
        if (!alive) return;
        setItems(res.data ?? []);
      } catch (e: any) {
        if (!alive) return;
        setError(String(e?.response?.data ?? e?.message ?? 'Не удалось загрузить игры'));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const content = useMemo(() => {
    if (loading) return <div className={styles.state}>Загрузка…</div>;
    if (error) return <div className={styles.state}>Ошибка: {error}</div>;
    if (!items.length) return <div className={styles.state}>Доступных игр пока нет</div>;

    return (
      <div className={styles.grid}>
        {items.map(game => (
          <button
            key={game.id}
            className={styles.card}
            style={{ backgroundImage: buildGradient(game.themeColor) }}
            onClick={() => navigate(`/game/${game.id}`)}
            type="button"
          >
            <div className={styles.cardOverlay} />
            <div className={styles.cardBody}>
              <div className={styles.swap}>
                <div className={styles.title}>{game.title}</div>
                <div className={styles.qCount}>
                  {game.tasksCount} задач · {game.ownerDisplayName}
                </div>
                <div className={styles.desc}>
                  {(game.description ?? '').trim() || 'Описание отсутствует'}
                </div>
              </div>
              <div className={styles.hint}>
                {game.status === 1 ? 'Открыть игру' : game.canEdit ? 'Черновик автора' : 'Недоступно'}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }, [error, items, loading, navigate]);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.head}>
          <h1 className={styles.h1}>Игры</h1>
          <p className={styles.sub}>
            Выбирайте игры, проходите смешанные задания на время и сравнивайте результаты в
            лидерборде.
          </p>
        </div>
        {content}
      </div>
    </div>
  );
};
