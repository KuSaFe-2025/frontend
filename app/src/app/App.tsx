import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { Header } from '@/components/Header';
import {
  AboutPage,
  AdminDashboard,
  AdminGuard,
  HomePage,
  LoginPage,
  NotFound,
  Quizes,
  QuizPage,
  QuizPlayPage,
  QuizResultPage,
  ReviewsPage,
} from '@/pages';
import '../shared/App.scss';

function App() {
  return (
    <BrowserRouter>
      <Header />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/games" element={<Quizes />} />
        <Route path="/quizes" element={<Quizes />} />
        <Route path="/game/:gameId" element={<QuizPage />} />
        <Route path="/quiz/:quizId" element={<QuizPage />} />
        <Route path="/game/:gameId/play" element={<QuizPlayPage />} />
        <Route path="/quiz/:quizId/play" element={<QuizPlayPage />} />
        <Route path="/game/:gameId/result" element={<QuizResultPage />} />
        <Route path="/quiz/:quizId/result" element={<QuizResultPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/my-games" element={<AdminDashboard mode="mine" />} />
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <AdminDashboard mode="admin" />
            </AdminGuard>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
