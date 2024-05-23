import {
  ActionRowBuilder,
  type AutocompleteInteraction,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  time,
} from "discord.js";
import {
  autocompletePlayerName,
  getMinecraftPlayerSkinUrl,
  hyphenateUUID,
  type PlayerInfo,
  resolvePlayerValue,
} from "../util/minecraft.js";
import {
  getSftpClient,
  type MinecraftServerBan,
  type MinecraftServerWhitelistItem,
} from "../util/sftp.js";
import { color, getEmoji } from "../util/meta.js";
import type { BotClient } from "../index.js";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("player")
    .setDescription("Get player info")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("ign")
        .setDescription("The player's in-game username")
        // .setMaxLength(25)
        .setRequired(true)
        .setAutocomplete(true),
    ),
  async autocomplete(interaction: AutocompleteInteraction) {
    return await autocompletePlayerName(interaction, "ign");
  },
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as BotClient;
    await interaction.deferReply();

    let playerInfo: PlayerInfo;
    try {
      playerInfo = await resolvePlayerValue(
        interaction.options.getString("ign", true),
      );
    } catch (e) {
      await interaction.editReply(e.message || "An error occurred");
      return;
    }

    // For new values as well as potentially stale usernames
    client.players.set(playerInfo.id, {
      uuid: playerInfo.id,
      name: playerInfo.name,
    });

    const hyphenated = hyphenateUUID(playerInfo.id);
    const whitelisted = !!client.serverWhitelist.find(
      (item) => item.uuid === hyphenated,
    );
    const banned = !!client.serverBans.find((item) => item.uuid === hyphenated);
    const possibleMember = interaction.guild?.members.cache.find(
      (m) => m.displayName.toLowerCase() === playerInfo.name.toLowerCase(),
    );

    const embed = new EmbedBuilder()
      .setTitle(playerInfo.name)
      .setColor(color)
      .setThumbnail(
        getMinecraftPlayerSkinUrl(playerInfo.id, { render: "body" }),
      )
      .addFields(
        {
          name: "Whitelisted",
          value: getEmoji(whitelisted),
          inline: true,
        },
        {
          name: "Banned",
          value: getEmoji(banned),
          inline: true,
        },
      )
      .setFooter({ text: `ID: ${hyphenated}` });
    if (possibleMember) {
      embed.addFields({
        name: "Possible Member",
        value: `<@${possibleMember.id}>`,
      });
    }

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

    // We still do this in case of stale cache. We'll remove this once we
    // start receiving live logs from the server.
    const sftp = await getSftpClient();
    try {
      const whitelist = JSON.parse(
        (await sftp.get("/whitelist.json")) as string,
      ) as MinecraftServerWhitelistItem[];
      client.serverWhitelist = whitelist;
      const bans = JSON.parse(
        (await sftp.get("/banned-players.json")) as string,
      ) as MinecraftServerBan[];
      client.serverBans = bans;

      const ban = bans.find((item) => item.uuid === hyphenated);
      const newWhitelisted = !!whitelist.find(
        (item) => item.uuid === hyphenated,
      );
      if (newWhitelisted !== whitelisted || !!ban !== banned) {
        // Only do anything if the new data differs
        embed.setFields(
          {
            name: "Whitelisted",
            value: getEmoji(newWhitelisted),
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
        if (possibleMember) {
          embed.addFields({
            name: "Possible Member",
            value: `<@${possibleMember.id}>`,
          });
        }

        await interaction.editReply({
          embeds: [embed],
        });
      }
    } catch (e) {
      console.error(e);
      await sftp.end();
    } finally {
      await sftp.end();
    }
  },
};
