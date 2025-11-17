import { quizInfoArray } from '@/shared/assets/textFiles/quizesInfo';
import { QuizCard } from '@/shared/ui';
import { Header } from '@/widgets';

import styles from './Quizes.module.scss';

export const Quizes = () => {
  return (
    <div>
      <Header />
      <div className={styles.quizGridContainer}>
        <div className={styles.quizsContainer}>
          {quizInfoArray.map((quizInfo, index) => (
            <QuizCard
              key={index}
              title={quizInfo.title}
              description={quizInfo.description}
              sysname={quizInfo.sysname}
              showButton={quizInfo.showButton}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
