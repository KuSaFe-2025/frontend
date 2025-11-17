import { Heading, Text } from '@chakra-ui/react';
import DOMPurify from 'dompurify';

import styles from './Post.module.scss';

interface PostProps {
  title: string;
  content: string;
  createdAt: string;
}

export const Post = ({ title, content, createdAt }: PostProps) => {
  const formattedDate = new Date(createdAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const sanitizedContent = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['br'],
    ALLOWED_ATTR: [],
  });

  return (
    <div className={styles.postContainer}>
      <Heading as="h2" size="lg" mb={2}>
        {title}
      </Heading>
      <Text fontSize="sm" color="gray.600" mb={4}>
        {formattedDate}
      </Text>
      <Text fontSize="md" as="div" dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
    </div>
  );
};
