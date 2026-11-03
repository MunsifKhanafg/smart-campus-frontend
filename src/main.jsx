import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import store from './store/store.js';
import App from './App.jsx';
import { ConfirmProvider } from './components/ConfirmModal.jsx';
import './index.css';
import './extra.css';
import './explorer.css';
import './modal.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
