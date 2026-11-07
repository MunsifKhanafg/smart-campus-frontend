import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { TOKEN_KEY, errorMessage } from '../api/axios.js';

export const login = createAsyncThunk('auth/login', async (creds, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/login', creds);
    localStorage.setItem(TOKEN_KEY, data.data.token);
    return data.data.user;
  } catch (e) {
    return rejectWithValue(errorMessage(e));
  }
});

// Runs on page refresh: if a token exists, ask the server who we are.
// The token is deleted ONLY when the server says it is invalid (401). If the server is just unreachable or the
// database is down (503), the person stays logged in and we show a "reconnecting" screen instead.
export const loadMe = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/auth/me');
    return data.data.user;
  } catch (e) {
    const unauthorized = e.response?.status === 401;
    if (unauthorized) localStorage.removeItem(TOKEN_KEY);
    return rejectWithValue({ unauthorized, message: errorMessage(e) });
  }
});

export const changePassword = createAsyncThunk('auth/changePassword', async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/change-password', body);
    localStorage.setItem(TOKEN_KEY, data.data.token); // old token is invalid after a password change
    return true;
  } catch (e) {
    return rejectWithValue(errorMessage(e));
  }
});

const slice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    status: localStorage.getItem(TOKEN_KEY) ? 'loading' : 'idle', // idle | loading | ready | offline
    loginLoading: false,
    error: null,
  },
  reducers: {
    logout(state) {
      localStorage.removeItem(TOKEN_KEY);
      state.user = null;
      state.status = 'idle';
    },
    clearError(state) {
      state.error = null;
    },
    passwordChanged(state) {
      if (state.user) state.user.mustChangePassword = false;
    },
  },
  extraReducers: (b) => {
    b.addCase(login.pending, (s) => { s.loginLoading = true; s.error = null; })
      .addCase(login.fulfilled, (s, a) => { s.loginLoading = false; s.user = a.payload; s.status = 'ready'; })
      .addCase(login.rejected, (s, a) => { s.loginLoading = false; s.error = a.payload; })
      .addCase(loadMe.fulfilled, (s, a) => { s.user = a.payload; s.status = 'ready'; })
      .addCase(loadMe.rejected, (s, a) => {
        s.user = null;
        s.status = a.payload?.unauthorized ? 'idle' : 'offline'; // idle = go to login, offline = server unreachable
      })
      .addCase(changePassword.fulfilled, (s) => { if (s.user) s.user.mustChangePassword = false; });
  },
});

export const { logout, clearError, passwordChanged } = slice.actions;
export default slice.reducer;
