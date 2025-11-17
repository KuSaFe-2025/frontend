import { Heading, Text } from '@chakra-ui/react';
import photo from '@shared/assets/me.png';
import { useNavigate } from 'react-router-dom';

import { aboutMe } from '@/shared/assets';
import { MyButton } from '@/shared/ui';

import styles from './About.module.scss';

export const About = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.aboutContainer}>
      <div className={styles.contentContainer}>
        <div className={styles.infoContainer}>
          <Heading as="h1" size="6xl">
            Привет! Я Андрей!
          </Heading>
          <Text as="p" marginTop={5} textStyle="2xl">
            {aboutMe}
          </Text>
        </div>
        <div className={styles.photoContainer}>
          <img src={photo} />
        </div>
      </div>

      <MyButton
        onClick={() => {
          navigate('/projects');
        }}
        className={styles.showMoreButton}
      >
        Показать проекты
      </MyButton>
    </div>
  );
};
