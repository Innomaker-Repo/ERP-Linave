import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { ErpProvider } from './app/context/ErpContext';
import { clearLegacyCommercialLocalStorage } from './app/services/workspaceStorage';
import './index.css';

clearLegacyCommercialLocalStorage();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErpProvider>
      <App />
    </ErpProvider>
  </React.StrictMode>
);
