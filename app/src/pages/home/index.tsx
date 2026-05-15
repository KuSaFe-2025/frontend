import { useNavigate } from 'react-router-dom';
import styles from './Home.module.scss';
import { getAccessToken } from '@/shared/lib';

const features = [
  {
    title: 'Создание игр',
    text: 'Собирайте викторины, опросы, задания на порядок и открытые ответы в одном кабинете автора.',
  },
  {
    title: 'Проверка и безопасность',
    text: 'Отправляйте игры на модерацию и публикуйте только проверенный образовательный контент.',
  },
  {
    title: 'Прохождение и рейтинг',
    text: 'Игроки проходят задания в удобном интерфейсе, видят результат и попадают в таблицу лидеров.',
  },
  {
    title: 'Статистика и экспорт',
    text: 'Отслеживайте ответы, точность, попытки и выгружайте результаты для дальнейшего анализа.',
  },
];

export const HomePage = () => {
  const navigate = useNavigate();

  const isAuthed = !!getAccessToken();

  const goAuth = () => navigate(isAuthed ? '/quizes' : '/login');

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.kicker}>образовательный игровой портал</div>
          <h1 className={styles.title}>KuSaFe</h1>
          <p className={styles.subtitle}>
            Платформа для создания, проверки, прохождения и анализа интерактивных образовательных игр.
          </p>

          <div className={styles.actions}>
            <button className={styles.startBtn} onClick={goAuth}>
              {isAuthed ? 'Открыть игры' : 'Начать'}
            </button>
            <button className={styles.secondaryBtn} onClick={() => navigate('/games')}>
              Смотреть каталог
            </button>
          </div>

          <div className={styles.featureGrid}>
            {features.map(feature => (
              <article className={styles.featureBox} data-testid="home-feature-box" key={feature.title}>
                <h2>{feature.title}</h2>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
