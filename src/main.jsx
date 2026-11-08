import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import store from './store/store.js';
import App from './App.jsx';
import { ConfirmProvider } from './components/ConfirmModal.jsx';
import { initTheme } from './theme.js';
import { initLogoTheme } from './logoTheme.js';
import LogoEffects from './components/LogoEffects.jsx';
import './index.css';
import './extra.css';
import './colors.css';
import './explorer.css';
import './modal.css';
import './polish.css';
import './schedule.css';
import './home.css';
import './home2.css';
import './finance.css';
import './timetable.css';
import './theme.css';
import './logo.css';
import './modern.css';

initTheme();
initLogoTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <LogoEffects />
      <BrowserRouter>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
