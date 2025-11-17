import { SquareDashedBottomCode } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { MTUCIIcon, TelegramIcon, VKIcon } from '@/shared/assets/icons';

import styles from './Header.module.scss';

export const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className={styles.headerContainer}>
      <SquareDashedBottomCode size={30} className={styles.logo} />

      <div onClick={() => navigate('/')} className={styles.linkContainer}>
        <Link className={`${styles.link} ${isActive('/') ? styles.activeLink : ''}`} to="/">
          Главная
        </Link>
      </div>
      <div onClick={() => navigate('/projects')} className={styles.linkContainer}>
        <Link
          className={`${styles.link} ${isActive('/projects') ? styles.activeLink : ''}`}
          to="/projects"
        >
          Викторины
        </Link>
      </div>
      <div className={styles.socialNetworksContainer}>
        <div className={styles.mtuciLinkContainer}>
          <a href="https://mtuci.ru/" target="_blank" rel="noopener noreferrer" aria-label="MTUCI">
            <MTUCIIcon size={30} />
          </a>
        </div>
      </div>
    </div>
  );
};
