import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { BotClient } from "..";
import { color } from "../util/meta";

const prettyFileSize = (bytes: number, si = false, dp = 1) => {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return `${bytes} Bytes`;
  }

  const units = si
    ? ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
    : ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
  let u = -1;
  const r = 10 ** dp;

  let b = bytes;
  do {
    b /= thresh;
    ++u;
  } while (Math.round(Math.abs(b) * r) / r >= thresh && u < units.length - 1);

  return `${b.toFixed(dp)} ${units[u]}`;
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Check the status of the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as BotClient;
    if (!client.serverStats) {
      await interaction.reply({
        content: "No server stats are available yet.",
        ephemeral: true,
      });
      return;
    }

    const stat = client.serverStats;
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setTitle(`Server Stats (${stat.state})`)
          .setURL(
            `${process.env.PTERODACTYL_HOST}/server/${process.env.PTERODACTYL_SERVER_ID}`,
          )
          .addFields(
            {
              name: "Resource Usage",
              value: [
                `Disk: ${prettyFileSize(stat.disk_bytes)}`,
                `Network: 📥 ${prettyFileSize(
                  stat.network.rx_bytes,
                )} | 📤 ${prettyFileSize(stat.network.tx_bytes)}`,
              ].join("\n"),
              inline: true,
            },
            {
              name: "Machine Utilization",
              value: [
                `CPU: ${stat.cpu_absolute}`,
                `RAM: ${prettyFileSize(stat.memory_bytes)} / ${prettyFileSize(
                  stat.memory_limit_bytes,
                )}`,
              ].join("\n"),
              inline: true,
            },
            {
              name: "Uptime",
              value: `${stat.uptime}`,
              inline: true,
            },
          ),
      ],
    });
  },
};
