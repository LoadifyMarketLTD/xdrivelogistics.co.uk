export type GitHistoryReadResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  status: number | null;
};

export type GitHistoryReader = (
  paths?: string[],
  pattern?: string,
) => GitHistoryReadResult;

export type AuditCheckResult = {
  id: string;
  pass: boolean | null;
  note: string;
};

export const GIT_SECRET_HISTORY_PATHS: string[];
export function checkGitSecrets(readHistory?: GitHistoryReader): AuditCheckResult[];
