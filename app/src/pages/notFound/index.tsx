import { Heading, Text } from '@chakra-ui/react';
import { Frown } from 'lucide-react';

import { Header } from '@/widgets';

import styles from './NotFound.module.scss';

export const NotFound = () => {
  return (
    <div className={styles.notFoundContainer}>
      <Header />
      <div className={styles.notFoundInfoContainer}>
        <Heading size="7xl">404</Heading>
        <Text textStyle="3xl">Страница не найдена или не существует</Text>
        <Frown size={40} />
      </div>
    </div>
  );
};
