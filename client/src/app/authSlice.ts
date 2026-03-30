import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { me } from "../services/authService";
import { clearStoredToken, getStoredToken, setStoredToken } from "../services/authStorage";
import type { User } from "../types/auth";

type AuthState = {
  token: string | null;
  user: User | null;
  loading: boolean;
};

const initialState: AuthState = {
  token: getStoredToken(),
  user: null,
  loading: Boolean(getStoredToken())
};

export const bootstrapAuth = createAsyncThunk("auth/bootstrap", async () => {
  const token = getStoredToken();
  if (!token) {
    return { token: null, user: null as User | null };
  }

  const user = await me();
  return { token, user };
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setSession: (state, action: PayloadAction<{ token: string; user: User }>) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
      setStoredToken(action.payload.token);
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      clearStoredToken();
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapAuth.pending, (state) => {
        state.loading = true;
      })
      .addCase(bootstrapAuth.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
      })
      .addCase(bootstrapAuth.rejected, (state) => {
        state.loading = false;
        state.token = null;
        state.user = null;
        clearStoredToken();
      });
  }
});

export const { setSession, logout, setUser } = authSlice.actions;
export default authSlice.reducer;
