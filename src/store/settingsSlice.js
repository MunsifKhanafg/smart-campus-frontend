import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api/axios.js';

// Public branding (name, logo...) is loaded once and shown everywhere: menu, login, landing page, browser tab title, tab icon.
// The last branding is also kept in the browser, so after a reload the CURRENT university name is shown at once
// instead of a flash of the default name while the settings are being fetched. (The logo picture itself is kept by logoCache.js.)
export const BRANDING_CACHE_KEY = 'sc_branding';

const readCache = () => {
  try { return JSON.parse(localStorage.getItem(BRANDING_CACHE_KEY)) || {}; } catch { return {}; }
};
const writeCache = (s) => {
  try {
    const { universityName, campusName, logoUrl } = s;
    localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify({ universityName, campusName, logoUrl }));
  } catch { /* private browsing: nothing is remembered, the name is simply fetched again */ }
};

// Called on start, after the head saves settings, and when the tab becomes active again, so a changed name or logo shows everywhere.
export const fetchPublicSettings = createAsyncThunk('settings/public', async () => {
  const { data } = await api.get('/settings/public');
  return data.data;
});

const slice = createSlice({
  name: 'settings',
  initialState: {
    universityName: 'Smart Campus',
    campusName: '',
    logoUrl: '',
    address: '',
    contactNumber: '',
    email: '',
    website: '',
    officeHours: '',
    currentAcademicYear: '',
    admissionPortal: null, // open / dates / external link, from the public settings
    ...readCache(),
    loaded: false,
    offline: false, // true while the last attempt to reach the server failed: the name and logo then come from the browser's saved copy
  },
  reducers: {
    setBranding: (state, a) => {
      const next = { ...state, ...a.payload };
      writeCache(next);
      return next;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchPublicSettings.fulfilled, (s, a) => {
      const next = { ...s, ...a.payload, loaded: true, offline: false };
      writeCache(next);
      return next;
    });
    b.addCase(fetchPublicSettings.rejected, (s) => { s.loaded = true; s.offline = true; });
  },
});

export const { setBranding } = slice.actions;
export default slice.reducer;
