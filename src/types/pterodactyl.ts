enum PterodactylWebsocketMessageEvent {
  AuthSuccess = "auth success",
  Status = "status",
  ConsoleOutput = "console output",
  Stats = "stats",
  TokenExpiring = "token expiring",
  TokenExpired = "token expired",
}

interface PterodactylWebsocketMessageAuthSuccess {
  event: PterodactylWebsocketMessageEvent.AuthSuccess;
}

interface PterodactylWebsocketMessageStatus {
  event: "status";
  args: string[];
}

interface PterodactylWebsocketMessageConsoleOutput {
  event: "console output";
  args: string[];
}

interface PterodactylStats {
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

interface PterodactylWebsocketMessageStats {
  event: "stats";
  /** The single arg is deserializable as `PterodactylStats` */
  args: [string];
}

interface PterodactylWebsocketMessageTokenExpiring {
  event: "token expiring";
}

interface PterodactylWebsocketMessageTokenExpired {
  event: "token expired";
}

type PterodactylWebsocketMessage =
  | PterodactylWebsocketMessageAuthSuccess
  | PterodactylWebsocketMessageStatus
  | PterodactylWebsocketMessageConsoleOutput
  | PterodactylWebsocketMessageStats
  | PterodactylWebsocketMessageTokenExpiring
  | PterodactylWebsocketMessageTokenExpired;
