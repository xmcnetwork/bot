import {
  type ButtonInteraction,
  ChannelType,
  PermissionFlagsBits,
  type GuildMember,
  EmbedBuilder,
} from "discord.js";
import { color } from "../util/meta";
import type { ApplicationEmbedPayload } from "./apply";
import { extractApplicationData } from "../util/minecraft";

module.exports = {
  customId: "apply:whitelist",
  async execute(interaction: ButtonInteraction) {
    if (
      !interaction.guildId ||
      interaction.channel?.type !== ChannelType.PrivateThread
    )
      return;
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: "You can't press this button!",
        ephemeral: true,
      });
      return;
    }

    let data: ApplicationEmbedPayload;
    try {
      data = extractApplicationData(interaction.message);
    } catch {
      await interaction.reply({
        content: "Failed to find the data in the thread.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const guild = await interaction.client.guilds.fetch(interaction.guildId);
    let member: GuildMember;
    try {
      member = await guild.members.fetch({ user: data.user });
    } catch {
      await interaction.editReply({
        content: "Could not fetch the member, are they still in the server?",
      });
      await interaction.channel.setArchived(
        true,
        "Applicant member was inaccessible",
      );
      return;
    }

    await interaction.editReply({
      content: `/whitelist add ${data.name}`,
      embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setTitle("Whitelist")
          .setDescription(
            "Copy and run the above command in Minecraft to whitelist the member.",
          )
          .addFields(
            data.id
              ? []
              : [
                  {
                    name: "Username not verified",
                    value: `The Minecraft account **${data.name}** may not exist.`,
                  },
                ],
          ),
      ],
      allowedMentions: {
        parse: [],
      },
    });

    // TODO: run server command through pterodactyl websocket

    if (
      process.env.MEMBER_ROLE_ID &&
      !member.roles.cache.has(process.env.MEMBER_ROLE_ID)
    ) {
      await member.roles.add(
        process.env.MEMBER_ROLE_ID,
        `Whitelisted by ${interaction.user.tag} (${interaction.user.id})`,
      );
    }

    await interaction.channel.send({
      content: `Congratulations **${data.name}**, you've been accepted! A moderator will whitelist your account shortly.`,
    });

    await interaction.channel.edit({
      name: `✅ ${data.name}`.slice(0, 100),
      archived: true,
      locked: true,
    });
  },
};
