import {
  type ButtonInteraction,
  ChannelType,
  PermissionFlagsBits,
  type GuildMember,
} from "discord.js";
import type { ApplicationEmbedPayload } from "./apply.js";
import { extractApplicationData } from "../util/minecraft.js";

module.exports = {
  customId: "apply:reject",
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
    } catch (e) {
      console.error(e);
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

    await interaction.editReply({ content: "OK" });

    if (
      process.env.APPLICANT_ROLE_ID &&
      member.roles.cache.has(process.env.APPLICANT_ROLE_ID)
    ) {
      await member.roles.remove(
        process.env.APPLICANT_ROLE_ID,
        `Rejected by ${interaction.user.tag} (${interaction.user.id})`,
      );
    }

    await interaction.channel.send({
      content: `Sorry **${data.name}**, your application has not been accepted.`,
    });

    await interaction.channel.edit({
      name: `❌ ${data.name}`.slice(0, 100),
      archived: true,
    });
  },
};
