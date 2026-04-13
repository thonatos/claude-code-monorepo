import { ScopeEnum } from '@artusx/core';

export enum InjectEnum {
  SessionManager = 'ARTUSX_ACP_SESSION_MANAGER',
  HistoryManager = 'ARTUSX_ACP_HISTORY_MANAGER',
  ProcessManager = 'ARTUSX_ACP_PROCESS_MANAGER',
}

export const DEFAULT_SCOPE = ScopeEnum.SINGLETON;