import styles from './About.module.scss';
import { Header } from '@/components/Header';

export const AboutPage = () => {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <h1 className={styles.title}>О проекте KuSaFe Quiz</h1>
          <p className={styles.subtitle}>
            Проходите бесплатные викторины на время, сравнивайте результаты и делитесь успехами.
          </p>

          <div className={styles.authNote}>
            Для полноценного использования сайта нужна авторизация.
          </div>
        </section>

        <section className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Разработали</div>
            <ul className={styles.list}>
              <li>Самохвалов Андрей</li>
              <li>Кушнаренко Николай</li>
              <li>Фёдоров Арсений</li>
            </ul>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Основные функции</div>
            <ol className={styles.list}>
              <li>Лидерборд и сравнение результатов</li>
              <li>Управление викторинами для администраторов</li>
              <li>Трекинг времени и корректности ответов</li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
};
