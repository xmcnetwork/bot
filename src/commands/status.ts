import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { BotClient } from "..";
import { color } from "../util/meta";
import type { PterodactylGetServerUsages } from "../types/pterodactyl";

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

    const stat: PterodactylGetServerUsages = await client.ptero.getServerUsages(
      process.env.PTERODACTYL_SERVER_ID,
    );
    // TODO: also get maximums

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setTitle(`Server Status (${stat.current_state})`)
          .setURL(
            `${process.env.PTERODACTYL_HOST}/server/${process.env.PTERODACTYL_SERVER_ID}`,
          )
          .addFields(
            {
              name: "Resource Usage",
              value: [
                `Disk: ${prettyFileSize(stat.resources.disk_bytes)}`,
                `Net: 📥 ${prettyFileSize(
                  stat.resources.network_rx_bytes,
                )} 📤 ${prettyFileSize(stat.resources.network_tx_bytes)}`,
              ].join("\n"),
              inline: true,
            },
            {
              name: "Machine Utilization",
              value: [
                `CPU: ${stat.resources.cpu_absolute.toFixed(2)}%`,
                `RAM: ${prettyFileSize(stat.resources.memory_bytes)}`,
              ].join("\n"),
              inline: true,
            },
            // TODO: pretty time display
            // {
            //   name: "Uptime",
            //   value: `${stat.resources.uptime}`,
            //   inline: true,
            // },
          ),
      ],
    });
  },
};
