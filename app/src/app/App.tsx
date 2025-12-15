import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { Header } from '@/components/Header';

import { HomePage, NotFound, Quizes, AboutPage, LoginPage } from '@/pages';
import '../shared/App.scss';

function App() {
  return (
    <BrowserRouter>
      <Header />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/quizes" element={<Quizes />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
