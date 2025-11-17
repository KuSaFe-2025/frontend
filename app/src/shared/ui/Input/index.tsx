import { Input, type InputProps } from '@chakra-ui/react';
import clsx from 'clsx';
import type { FC } from 'react';

import styles from './Input.module.scss';

export const MyInput: FC<InputProps> = ({ className, ...rest }) => {
  return <Input className={clsx(styles.inputStyles, className)} {...rest} />;
};
