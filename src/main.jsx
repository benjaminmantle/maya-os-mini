import React from 'react';
import ReactDOM from 'react-dom/client';
import Shell from './Shell.jsx';
import './styles/tokens.css';
import './styles/global.css';
import { ToastProvider } from './components/shared/Toast.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <Shell />
    </ToastProvider>
  </React.StrictMode>
);
