import { Button, type ButtonProps } from '@chakra-ui/react';
import clsx from 'clsx';
import type { FC } from 'react';

import styles from './Button.module.scss';

export const MyButton: FC<ButtonProps> = ({ children, className, ...rest }) => {
  return (
    <Button className={clsx(styles.buttonStyles, className)} {...rest}>
      {children}
    </Button>
  );
};
