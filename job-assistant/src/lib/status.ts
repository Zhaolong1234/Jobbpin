export type GlobalStatus = "loading" | "success" | "parse_failed" | "empty";

export interface GlobalStatusState {
  status: GlobalStatus;
  message: string;
}

export function createStatus(status: GlobalStatus, message: string): GlobalStatusState {
  return { status, message };
}

export const EMPTY_STATUS: GlobalStatusState = {
  status: "empty",
  message: "No data yet.",
};
