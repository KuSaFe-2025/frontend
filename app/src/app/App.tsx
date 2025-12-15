import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { Header } from '@/components/Header';

import {
  HomePage,
  NotFound,
  Quizes,
  AboutPage,
  LoginPage,
  QuizPage,
  QuizPlayPage,
  QuizResultPage,
  AdminDashboard,
  AdminGuard,
} from '@/pages';
import '../shared/App.scss';

function App() {
  return (
    <BrowserRouter>
      <Header />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/quizes" element={<Quizes />} />
        <Route path="/quiz/:quizId" element={<QuizPage />} />
        <Route path="/quiz/:quizId/play" element={<QuizPlayPage />} />
        <Route path="/quiz/:quizId/result" element={<QuizResultPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <AdminDashboard />
            </AdminGuard>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
