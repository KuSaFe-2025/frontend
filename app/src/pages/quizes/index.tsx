import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import styles from './Quizes.module.scss';
import { api } from '@/shared/lib';

type GameListItem = {
  id: string;
  title: string;
  description?: string | null;
  descriptionFormat: number;
  tasksCount: number;
  attemptsCount: number;
  averageRating: number;
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
  const rgb = hexToRgb((themeColor || '#7C3AED').toUpperCase()) ?? hexToRgb('#7C3AED');
  if (!rgb) return 'linear-gradient(135deg, #7C3AED 0%, #A855F7 45%, #C084FC 100%)';
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const c1 = hslToCss(h, clamp(s * 1.05, 0, 1), clamp(l * 0.85, 0, 1));
  const c2 = hslToCss((h + 18) % 360, clamp(s * 1.1, 0, 1), clamp(l * 1.05, 0, 1));
  const c3 = hslToCss((h + 40) % 360, clamp(s * 0.95, 0, 1), clamp(l * 1.2, 0, 1));
  return `linear-gradient(135deg, ${c1} 0%, ${c2} 45%, ${c3} 100%)`;
}

function statusHint(game: GameListItem) {
  if (game.status === 1) return 'Открыть игру';
  if (game.status === 2) return 'На проверке';
  if (game.status === 3) return 'Отклонена';
  return game.canEdit ? 'Черновик автора' : 'Недоступно';
}

function renderDescription(game: GameListItem) {
  const description = (game.description ?? '').trim();
  if (!description) return 'Описание отсутствует';
  if (game.descriptionFormat !== 1) return description;
  return DOMPurify.sanitize(marked.parse(description, { async: false }) as string);
}

function attemptsLabel(count: number) {
  const n = Math.max(0, count);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} прохождение`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} прохождения`;
  return `${n} прохождений`;
}

function ratingStars(value: number) {
  const rounded = clamp(Math.round(value || 0), 0, 5);
  return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
}

function ratingLabel(value: number) {
  const rating = Number.isFinite(value) ? value : 0;
  return `рейтинг ${rating.toFixed(1)} звезды ${ratingStars(rating)}`;
}

export const Quizes = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<GameListItem[]>([]);
  const [recommended, setRecommended] = useState<GameListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [allRes, recommendedRes] = await Promise.all([
          api.get<GameListItem[]>('/v1/games'),
          api.get<GameListItem[]>('/v1/games/recommended'),
        ]);
        if (alive) {
          setItems(allRes.data ?? []);
          setRecommended(recommendedRes.data ?? []);
        }
      } catch (e: any) {
        if (alive) setError(String(e?.response?.data ?? e?.message ?? 'Не удалось загрузить игры'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const renderGameCard = (game: GameListItem, className = '') => (
    <button data-testid="game-card" key={game.id} className={`${styles.card} ${className}`} style={{ backgroundImage: buildGradient(game.themeColor) }} onClick={() => navigate(`/game/${game.id}`)} type="button">
      <div className={styles.cardOverlay} />
      <div className={styles.cardBody}>
        <div className={styles.swap}>
          <div className={styles.title}>{game.title}</div>
          <div className={styles.qCount}>{game.tasksCount} задач · {game.ownerDisplayName}</div>
          {game.descriptionFormat === 1 ? (
            <div className={`${styles.desc} ${styles.markdownDesc}`} dangerouslySetInnerHTML={{ __html: renderDescription(game) }} />
          ) : (
            <div className={styles.desc}>{renderDescription(game)}</div>
          )}
        </div>
        <div className={styles.cardFooter}>
          <span className={styles.hint}>{statusHint(game)}</span>
          <span>{attemptsLabel(game.attemptsCount)}</span>
          <span>{ratingLabel(game.averageRating)}</span>
        </div>
      </div>
    </button>
  );

  const content = useMemo(() => {
    if (loading) return <div className={styles.state}>Загрузка...</div>;
    if (error) return <div className={styles.state}>Ошибка: {error}</div>;
    if (!items.length) return <div className={styles.state}>Доступных игр пока нет</div>;

    return (
      <div className={styles.sections}>
        <section className={styles.section} data-testid="recommended-games">
          <div className={styles.sectionHead}>
            <h2>Рекомендуемые игры</h2>
            <span>Самые проходимые игры с высоким рейтингом</span>
          </div>
          <div className={styles.recommendedGrid}>
            {recommended.length
              ? recommended.map(game => renderGameCard(game, styles.recommendedCard))
              : <div className={styles.state}>Рекомендаций пока нет</div>}
          </div>
        </section>

        <div className={styles.divider} aria-hidden="true" />

        <section className={styles.section} data-testid="all-games">
          <div className={styles.sectionHead}>
            <h2>Все игры</h2>
            <span>{items.length} доступно</span>
          </div>
          <div className={styles.grid}>
            {items.map(game => renderGameCard(game))}
          </div>
        </section>
      </div>
    );
  }, [error, items, loading, navigate, recommended]);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.head}>
          <h1 className={styles.h1}>Игры</h1>
          <p className={styles.sub}>Выбирайте игры, проходите смешанные задания на время и сравнивайте результаты в лидерборде.</p>
        </div>
        {content}
      </div>
    </div>
  );
};
