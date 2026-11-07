import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api/axios.js';

// Public branding (name, logo...) is loaded once and shown everywhere.
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
    loaded: false,
  },
  reducers: {
    // Called after the head saves settings so the header updates instantly.
    setBranding: (state, a) => ({ ...state, ...a.payload }),
  },
  extraReducers: (b) => {
    b.addCase(fetchPublicSettings.fulfilled, (s, a) => ({ ...s, ...a.payload, loaded: true }));
    b.addCase(fetchPublicSettings.rejected, (s) => { s.loaded = true; });
  },
});

export const { setBranding } = slice.actions;
export default slice.reducer;
