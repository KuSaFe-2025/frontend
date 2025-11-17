import { Heading, Text } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { ShieldCheck, ExternalLink, Slash } from 'lucide-react';
import { useState, type ReactNode, type MouseEvent } from 'react';

import styles from './ProjectCard.module.scss';
import { MyButton } from '../Button';

interface ProjectCardInfo {
  title: string;
  description: ReactNode;
  sysname: string;
  showButton: boolean;
}

export const ProjectCard = ({ title, description, sysname, showButton }: ProjectCardInfo) => {
  const [flip, setFlip] = useState(false);

  const selectIcon = (sysnameProp: string) => {
    const iconsObject = {
      shield: ShieldCheck,
      web: ExternalLink,
    };

    return iconsObject[sysnameProp as keyof typeof iconsObject] || Slash;
  };

  const transferToCommunicate = (event: MouseEvent) => {
    event.stopPropagation();

    const message = encodeURIComponent('Hi! I want to buy VPN subscription.');
    const telegramUrl = `https://t.me/kusafe028?text=${message}`;

    window.open(telegramUrl, '_blank');
  };

  const Icon = selectIcon(sysname);

  return (
    <div className={styles.projectCardWrapper} onClick={() => setFlip(prev => !prev)}>
      <motion.div
        className={styles.projectCard}
        animate={{ rotateY: flip ? 180 : 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className={`${styles.cardFace} ${styles.front}`}>
          <Heading>{title}</Heading>
          <Icon />
        </div>
        <div className={`${styles.cardFace} ${styles.back}`}>
          <Text as="p">{description}</Text>
          <MyButton
            onClick={transferToCommunicate}
            className={styles.cardButton}
            hidden={!showButton}
          >
            Связаться
          </MyButton>
        </div>
      </motion.div>
    </div>
  );
};
