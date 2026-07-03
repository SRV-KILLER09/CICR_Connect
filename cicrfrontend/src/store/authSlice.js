import { createSlice } from '@reduxjs/toolkit';
import { getMe } from '../api';

const initialState = {
  user: null,
  loading: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    logoutUser: (state) => {
      state.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('profile');
    }
  },
});

export const { setUser, setLoading, logoutUser } = authSlice.actions;

export const loadUser = () => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const { data } = await getMe();
    const userData = data?.result || data;
    if (userData) {
      dispatch(setUser(userData));
      localStorage.setItem('profile', JSON.stringify(userData));
    } else {
      dispatch(setUser(null));
      localStorage.removeItem('profile');
    }
  } catch (error) {
    console.error('Failed to authenticate user session:', error);
    dispatch(setUser(null));
    localStorage.removeItem('profile');
  } finally {
    dispatch(setLoading(false));
  }
};

export default authSlice.reducer;
