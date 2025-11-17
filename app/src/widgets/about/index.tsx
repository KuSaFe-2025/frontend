import { Heading, Text } from '@chakra-ui/react';
import photo from '@shared/assets/icons/proeject_practicum_logo.jpg';
import { useNavigate } from 'react-router-dom';

import { aboutQuizes } from '@/shared/assets';
import { MyButton } from '@/shared/ui';

import styles from './About.module.scss';

export const About = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.aboutContainer}>
      <div className={styles.contentContainer}>
        <div className={styles.infoContainer}>
          <Heading as="h1" size="6xl">
            KuSaFe Quiz
          </Heading>
          <Text as="p" marginTop={5} textStyle="2xl">
            {aboutQuizes}
          </Text>
        </div>
        <div className={styles.photoContainer}>
          <img src={photo} />
        </div>
      </div>

      <MyButton
        onClick={() => {
          navigate('/quizes');
        }}
        className={styles.showMoreButton}
      >
        Перейти к викторинам
      </MyButton>
    </div>
  );
};
