import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { HomePage, NotFound, Projects } from '@/pages';
import '../shared/App.scss';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
