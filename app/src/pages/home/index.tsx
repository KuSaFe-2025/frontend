import { About, Blog, Header, Contacts } from '@/widgets';

import styles from './Home.module.scss';

export const HomePage = () => {
  return (
    <div className={styles.homePage}>
      <Header />
      <div className={styles.informationContainer}>
        <div className={styles.leftColumn}>
          <About />
          <Contacts />
        </div>
        <Blog />
      </div>
    </div>
  );
};
