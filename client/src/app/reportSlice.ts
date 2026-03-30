import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { fetchReport } from "../services/reportService";
import type { Report } from "../types/report";

export const getReport = createAsyncThunk("report/get", async (reportId: string) => {
  return fetchReport(reportId);
});

type ReportState = {
  data: Report | null;
  loading: boolean;
  error: string | null;
};

const initialState: ReportState = {
  data: null,
  loading: false,
  error: null
};

const reportSlice = createSlice({
  name: "report",
  initialState,
  reducers: {
    resetReport: (state) => {
      state.data = null;
      state.loading = false;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(getReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getReport.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(getReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? "Failed to fetch report";
      });
  }
});

export const { resetReport } = reportSlice.actions;
export default reportSlice.reducer;
