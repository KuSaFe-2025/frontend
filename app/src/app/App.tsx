import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { HomePage, NotFound, Quizes } from '@/pages';
import '../shared/App.scss';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/quizes" element={<Quizes />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
