import { useNavigate } from 'react-router-dom';
import styles from './Header.module.scss';
import { getAccessToken } from '@/shared/lib';
import { isAdmin } from '@/shared/lib/authAdmin';
import { NavLink } from 'react-router-dom';

type HeaderProps = {
  onAuthClick?: () => void;
};

export const Header = ({ onAuthClick }: HeaderProps) => {
  const navigate = useNavigate();

  const goAuth = onAuthClick ?? (() => navigate(isAuthed ? '/quizes' : '/login'));

  const admin = isAdmin();

  const isAuthed = !!getAccessToken();

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.left}>
          <button className={styles.logo} onClick={() => navigate('/')}>
            KuSaFe
          </button>

          <span className={styles.sep} />

          <button className={styles.navLink} onClick={() => navigate('/')}>
            Главная
          </button>

          <span className={styles.sep} />

          <button className={styles.navLink} onClick={() => navigate('/about')}>
            О нас
          </button>

          {isAuthed && (
            <>
              <span className={styles.sep} />
              <button className={styles.navLink} onClick={() => navigate('/quizes')}>
                Викторины
              </button>
            </>
          )}
        </div>

        {admin && (
          <NavLink className={styles.adminBtn} to="/admin">
            ADMIN
          </NavLink>
        )}

        <button
          className={styles.iconBtn}
          onClick={goAuth}
          aria-label="Войти или зарегистрироваться"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"
            />
          </svg>
        </button>
      </div>
    </header>
  );
};
