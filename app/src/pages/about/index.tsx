import styles from './About.module.scss';

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

        <section className={styles.contactSection}>
          <div className={styles.contactInfo}>
            <div className={styles.cardTitle}>Контакты</div>
            <h2 className={styles.contactTitle}>Офис и связь</h2>

            <dl className={styles.contactList}>
              <div>
                <dt>Адрес офиса</dt>
                <dd>ул. Левашова, 21, Раменское, Московская обл., 140105</dd>
              </div>

              <div>
                <dt>Почта для вопросов</dt>
                <dd>
                  <a href="mailto:kusafe@nk.ax">kusafe@nk.ax</a>
                </dd>
              </div>

              <div>
                <dt>Телефон для вопросов</dt>
                <dd>
                  <a href="tel:+79160000000">+7 916 000-00-00</a>
                </dd>
              </div>
            </dl>
          </div>

          <div className={styles.mapFrame}>
            <iframe
              title="Офис KuSaFe на карте"
              src="https://maps.google.com/maps?q=IKTeam%20HQ%2C%20%D1%83%D0%BB.%20%D0%9B%D0%B5%D0%B2%D0%B0%D1%88%D0%BE%D0%B2%D0%B0%2C%2021%2C%20%D0%A0%D0%B0%D0%BC%D0%B5%D0%BD%D1%81%D0%BA%D0%BE%D0%B5%2C%20%D0%9C%D0%BE%D1%81%D0%BA%D0%BE%D0%B2%D1%81%D0%BA%D0%B0%D1%8F%20%D0%BE%D0%B1%D0%BB.%2C%20140105&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </section>
      </div>
    </div>
  );
};
