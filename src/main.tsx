import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import App from './App.tsx';
import DebugEnv from './pages/DebugEnv.tsx';  // 👈 import your new page
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <Routes>
        {/* your main app */}
        <Route path="/*" element={<App />} />
        {/* debug page */}
        <Route path="/debug-env" element={<DebugEnv />} />
      </Routes>
    </Router>
  </React.StrictMode>
);
