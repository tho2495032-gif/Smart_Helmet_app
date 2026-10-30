export type HistoryEvent = {
  id: string;
  helmet_id?: string;
  type?: string;
  severity?: string;
  timestamp?: number;
  lat?: number;
  lng?: number;
  impact_force?: number | string;
  value?: number | string;
  sensor?: string;
  message?: string;
};
