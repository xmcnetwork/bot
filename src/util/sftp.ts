import SftpClient from "ssh2-sftp-client";

export interface MinecraftServerWhitelistItem {
  /** With hyphens */
  uuid: string;
  name: string;
}

export interface MinecraftServerBan {
  /** With hyphens */
  uuid: string;
  name: string;
  /** ISO8601 */
  created: string;
  source: string;
  /** ISO8601 or `forever` */
  expires: string;
  reason?: string;
}

export interface MinecraftServerUserCacheItem {
  name: string;
  /** With hyphens */
  uuid: string;
  /** ISO8601 */
  expiresOn: string;
}

export const getSftpClient = async () => {
  const sftp = new SftpClient();
  await sftp.connect({
    host: process.env.SFTP_HOST,
    port: process.env.SFTP_PORT ? Number(process.env.SFTP_PORT) : 7767,
    username: process.env.SFTP_USERNAME,
    password: process.env.SFTP_PASSWORD,
    // debug: console.log,
  });
  return sftp;
};

export const getSftpFile = async (path: string) => {
  const sftp = await getSftpClient();
  const data = await sftp.get(path);
  await sftp.end();
  return data;
};
