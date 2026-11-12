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
import { initResponsiveTables } from './components/useResponsiveTables.js';
import './index.css';
import './extra.css';
import './colors.css';
import './explorer.css';
import './modal.css';
import './modal2.css';
import './polish.css';
import './schedule.css';
import './home.css';
import './home2.css';
import './finance.css';
import './timetable.css';
import './theme.css';
import './logo.css';
import './modern.css';
import './profile.css';
import './ui2.css'; // modern modals, profile sheet, chat on phones, leave and Class IV staff pages
import './mobile.css'; // keep this LAST: the phone layout must win over every other stylesheet

initTheme();
initLogoTheme();
initResponsiveTables(); // table -> card labels for phones, on every page

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
