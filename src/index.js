import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Admin from './Admin';

// Si la URL contiene /admin → muestra el panel de administración
// Si no → muestra la plataforma normal para usuarios
const isAdmin = window.location.pathname.startsWith('/admin');

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {isAdmin ? <Admin /> : <App />}
  </React.StrictMode>
);
