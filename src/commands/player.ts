import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  inlineCode,
  SlashCommandBuilder,
  time,
} from "discord.js";
import {
  type GetAPIUsernameToUUIDResult,
  getMinecraftPlayer,
  getMinecraftPlayerSkinUrl,
  hyphenateUUID,
} from "../util/minecraft";
import {
  getSftpClient,
  type MinecraftServerBan,
  type MinecraftServerWhitelistItem,
} from "../util/sftp";
import { color, getEmoji } from "../util/meta";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("player")
    .setDescription("Get player info")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("ign")
        .setDescription("The player's in-game username")
        .setMaxLength(30)
        .setRequired(true),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    let playerInfo: GetAPIUsernameToUUIDResult;
    try {
      playerInfo = await getMinecraftPlayer(
        interaction.options.getString("ign", true),
      );
    } catch (e) {
      await interaction.editReply(e.message || "An error occurred");
      return;
    }

    const hyphenated = hyphenateUUID(playerInfo.id);
    const embed = new EmbedBuilder()
      .setTitle(playerInfo.name)
      .setColor(color)
      .setThumbnail(
        getMinecraftPlayerSkinUrl(playerInfo.id, { render: "body" }),
      )
      .addFields(
        {
          name: "Whitelisted",
          value: getEmoji("loading"),
          inline: true,
        },
        {
          name: "Banned",
          value: getEmoji("loading"),
          inline: true,
        },
      )
      .setFooter({ text: `ID: ${hyphenated}` });

    await interaction.editReply({
      embeds: [embed],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setURL(`https://mine.ly/${playerInfo.name}`)
            .setLabel("NameMC"),
        ),
      ],
    });

    const sftp = await getSftpClient();
    try {
      const whitelist = JSON.parse(
        (await sftp.get("/whitelist.json")) as string,
      ) as MinecraftServerWhitelistItem[];
      const bans = JSON.parse(
        (await sftp.get("/banned-players.json")) as string,
      ) as MinecraftServerBan[];

      const ban = bans.find((item) => item.uuid === hyphenated);

      embed.setFields(
        {
          name: "Whitelisted",
          value: getEmoji(!!whitelist.find((item) => item.uuid === hyphenated)),
          inline: true,
        },
        {
          name: "Banned",
          value: ban
            ? [
                `Since: ${time(new Date(ban.created))}`,
                `Until: ${
                  ban.expires === "forever"
                    ? "forever"
                    : time(new Date(ban.expires))
                }`,
                `By: ${ban.source}`,
                ban.reason ? `Reason:\n> ${ban.reason}` : "",
              ].join("\n")
            : getEmoji(false),
          inline: !ban,
        },
      );

      await interaction.editReply({
        embeds: [embed],
      });
    } catch (e) {
      console.error(e);
      await sftp.end();
    } finally {
      await sftp.end();
    }
  },
};
