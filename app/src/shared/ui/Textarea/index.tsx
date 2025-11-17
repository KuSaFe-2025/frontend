import { Textarea, type TextareaProps } from '@chakra-ui/react';
import clsx from 'clsx';
import type { FC } from 'react';

import styles from './Textarea.module.scss';

export const MyTextarea: FC<TextareaProps> = ({ className, ...rest }) => {
  return <Textarea className={clsx(styles.textareaStyles, className)} {...rest} />;
};
