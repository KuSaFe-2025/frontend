import { ButtonGroup, Heading, Text } from '@chakra-ui/react';
import { useEffect, useState } from 'react';

import { blogText } from '@/shared/assets';
import { api } from '@/shared/lib';
import { MyButton, Post } from '@/shared/ui';

import styles from './Blog.module.scss';

interface Post {
  id: number;
  title: string;
  content: string;
  createdAt: string;
}

const POSTS_PER_PAGE = 6;

export const Blog = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchBlogsData = async () => {
      try {
        const response = await api.get<Post[]>('posts');
        setPosts(response.data);
      } catch (error) {
        console.error('Ошибка при получении постов:', error);
      }
    };

    fetchBlogsData();
  }, []);

  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
  const currentPosts = posts.slice(startIndex, startIndex + POSTS_PER_PAGE);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className={styles.blogContainer}>
      <Heading as="h1" size="5xl">
        Блог
      </Heading>
      <Text as="p" mb={10} textStyle="2xl">
        {blogText}
      </Text>

      {currentPosts && currentPosts.length > 0 ? (
        currentPosts.map(post => (
          <Post
            key={post.id}
            title={post.title}
            content={post.content}
            createdAt={post.createdAt}
          />
        ))
      ) : (
        <Text>Постов пока нет</Text>
      )}

      {totalPages > 1 && (
        <ButtonGroup
          className={styles.paginationButtonGroup}
          mt={8}
          justifyContent="center"
          display="flex"
        >
          <MyButton onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
            ← Назад
          </MyButton>

          {Array.from({ length: totalPages }, (_, i) => (
            <MyButton
              key={i + 1}
              onClick={() => handlePageChange(i + 1)}
              className={
                currentPage === i + 1 ? styles.activePageButton : styles.notActivePageButton
              }
            >
              {i + 1}
            </MyButton>
          ))}

          <MyButton
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Вперёд →
          </MyButton>
        </ButtonGroup>
      )}
    </div>
  );
};
