import { configureStore } from '@reduxjs/toolkit';
import auth from './authSlice.js';
import settings from './settingsSlice.js';

export default configureStore({ reducer: { auth, settings } });
