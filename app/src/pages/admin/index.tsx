import { Navigate } from 'react-router-dom';
import { getAccessToken } from '@/shared/lib';
import { isAdmin } from '@/shared/lib/authAdmin';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  if (!getAccessToken()) return <Navigate to="/login" replace />;
  if (!isAdmin()) return <Navigate to="/" replace />;
  return <>{children}</>;
}
