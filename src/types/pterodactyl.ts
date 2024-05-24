export enum PterodactylWebsocketMessageEvent {
  AuthSuccess = "auth success",
  Status = "status",
  ConsoleOutput = "console output",
  Stats = "stats",
  TokenExpiring = "token expiring",
  TokenExpired = "token expired",
}

// export enum PterodactylWebsocketCommandEvent {
//   Auth = "auth",
//   SendStats = "send stats",
//   SendLogs = "send logs",
//   SetState = "set state",
//   SendCommand = "send command",
// }

export interface PterodactylWebsocketMessageAuthSuccess {
  event: PterodactylWebsocketMessageEvent.AuthSuccess;
}

export interface PterodactylWebsocketMessageStatus {
  event: PterodactylWebsocketMessageEvent.Status;
  args: string[];
}

export interface PterodactylWebsocketMessageConsoleOutput {
  event: PterodactylWebsocketMessageEvent.ConsoleOutput;
  args: string[];
}

export interface PterodactylStats {
  /** Percentage, can be over 100 */
  cpu_absolute: number;
  disk_bytes: number;
  memory_bytes: number;
  memory_limit_bytes: number;
  network: { rx_bytes: number; tx_bytes: number };
  state: "running" | "stopping";
  /** Uptime in milliseconds */
  uptime: number;
}

export interface PterodactylGetServerUsages {
  current_state: Pick<PterodactylStats, "state">;
  is_suspended: boolean;
  resources: {
    memory_bytes: number;
    cpu_absolute: number;
    disk_bytes: number;
    network_rx_bytes: number;
    network_tx_bytes: number;
    uptime: number;
  };
}

export interface PterodactylWebsocketMessageStats {
  event: PterodactylWebsocketMessageEvent.Stats;
  /** The single arg is deserializable as `PterodactylStats` */
  args: [string];
}

export interface PterodactylWebsocketMessageTokenExpiring {
  event: PterodactylWebsocketMessageEvent.TokenExpiring;
}

export interface PterodactylWebsocketMessageTokenExpired {
  event: PterodactylWebsocketMessageEvent.TokenExpired;
}

export type PterodactylWebsocketMessage =
  | PterodactylWebsocketMessageAuthSuccess
  | PterodactylWebsocketMessageStatus
  | PterodactylWebsocketMessageConsoleOutput
  | PterodactylWebsocketMessageStats
  | PterodactylWebsocketMessageTokenExpiring
  | PterodactylWebsocketMessageTokenExpired;
