import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Reviews.module.scss';
import { api, getAccessToken } from '@/shared/lib';

type Review = {
  id: string;
  gameId?: string | null;
  gameTitle?: string | null;
  displayName: string;
  rating: number;
  text: string;
  createdAtUtc: string;
  canDelete: boolean;
};

type Page<T> = {
  items: T[];
  total: number;
  skip: number;
  take: number;
  hasMore: boolean;
};

const TAKE = 10;

export const ReviewsPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState('new');
  const [skip, setSkip] = useState(0);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const authed = !!getAccessToken();

  const load = async (nextSkip = skip) => {
    const res = await api.get<Page<Review>>('/v1/reviews', { params: { skip: nextSkip, take: TAKE, sort } });
    setItems(res.data.items ?? []);
    setTotal(res.data.total);
    setSkip(nextSkip);
  };

  useEffect(() => {
    void load(0).catch(e => setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось загрузить отзывы')));
  }, [sort]);

  const submit = async () => {
    if (!authed) return navigate('/login');
    const body = text.trim();
    if (!body) return setErr('Введите текст отзыва.');
    setBusy(true);
    setErr(null);
    try {
      await api.post('/v1/reviews/site', { rating, text: body });
      setText('');
      setRating(5);
      await load(0);
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось сохранить отзыв'));
    } finally {
      setBusy(false);
    }
  };

  const deleteReview = async (id: string) => {
    setBusy(true);
    setErr(null);
    try {
      await api.delete(`/v1/admin/reviews/${id}`);
      await load(skip);
    } catch (e: any) {
      setErr(String(e?.response?.data ?? e?.message ?? 'Не удалось удалить отзыв'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.panel}>
          <div className={styles.head}>
            <div>
              <div className={styles.kicker}>Отзывы</div>
              <h1>Отзывы KuSaFe</h1>
            </div>
            <select className={styles.select} value={sort} onChange={e => setSort(e.target.value)}>
              <option value="new">Сначала новые</option>
              <option value="rating_desc">Высокая оценка</option>
              <option value="rating_asc">Низкая оценка</option>
            </select>
          </div>

          <div className={styles.form}>
            <div className={styles.formTitle}>Отзыв к сайту KuSaFe</div>
            <div className={styles.stars}>
              {[1, 2, 3, 4, 5].map(value => (
                <button
                  key={value}
                  className={value <= rating ? styles.starActive : styles.star}
                  type="button"
                  onClick={() => setRating(value)}
                  aria-label={`${value} из 5`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea className={styles.textarea} value={text} onChange={e => setText(e.target.value)} placeholder="Что стоит улучшить или что понравилось?" />
            <button className={styles.primary} disabled={busy} type="button" onClick={submit}>
              Оставить отзыв
            </button>
          </div>

          {err && <div className={styles.error}>{err}</div>}

          <div className={styles.list}>
            {items.map(review => (
              <article className={styles.card} key={review.id}>
                <div className={styles.cardTop}>
                  <div>
                    <div className={styles.author}>{review.displayName}</div>
                    <div className={styles.meta}>{new Date(review.createdAtUtc).toLocaleString('ru-RU')}</div>
                  </div>
                  <div className={styles.rating}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>
                </div>
                {review.gameId && review.gameTitle && (
                  <button className={styles.gameLink} type="button" onClick={() => navigate(`/game/${review.gameId}`)}>
                    {review.gameTitle}
                  </button>
                )}
                <p>{review.text}</p>
                {review.canDelete && (
                  <button className={styles.deleteBtn} disabled={busy} type="button" onClick={() => deleteReview(review.id)}>
                    Удалить
                  </button>
                )}
              </article>
            ))}
          </div>

          <div className={styles.pager}>
            <button className={styles.secondary} disabled={skip <= 0 || busy} onClick={() => load(Math.max(0, skip - TAKE))}>Назад</button>
            <span>{items.length ? `${skip + 1}-${skip + items.length}` : '0'} из {total}</span>
            <button className={styles.secondary} disabled={skip + TAKE >= total || busy} onClick={() => load(skip + TAKE)}>Дальше</button>
          </div>
        </section>
      </main>
    </div>
  );
};
