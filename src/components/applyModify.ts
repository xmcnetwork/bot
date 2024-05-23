import {
  ActionRowBuilder,
  ChannelType,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  type StringSelectMenuInteraction,
  Routes,
  type RESTPatchAPIGuildMemberJSONBody,
} from "discord.js";
import type { ApplicationEmbedPayload } from "./apply.js";
import {
  extractApplicationData,
  generateApplicationDataEmbed,
  getMinecraftPlayer,
  type PlayerInfo,
} from "../util/minecraft.js";

module.exports = {
  customId: "apply:modify",
  async execute(interaction: StringSelectMenuInteraction) {
    if (
      !interaction.guildId ||
      interaction.channel?.type !== ChannelType.PrivateThread
    ) {
      return;
    }
    // if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    //   await interaction.reply({
    //     content: "You can't press this button!",
    //     ephemeral: true,
    //   });
    //   return;
    // }

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

    const value = interaction.values[0];
    if (value === "ign") {
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId("application-modify-ign")
          .setTitle("Modify Application")
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setLabel("Change IGN")
                .setCustomId("ign")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("Your Minecraft Java Edition username")
                .setValue(data.name)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(25),
            ),
          ),
      );
      let mInteraction: ModalSubmitInteraction;
      try {
        mInteraction = await interaction.awaitModalSubmit({
          time: 600_000,
        });
      } catch {
        await interaction.followUp({
          content: "Timed out.",
          ephemeral: true,
        });
        return;
      }
      await mInteraction.deferUpdate();
      let playerInfo: PlayerInfo;
      try {
        playerInfo = await getMinecraftPlayer(
          mInteraction.fields.getTextInputValue("ign"),
        );
      } catch (e) {
        await mInteraction.editReply({
          // Reset the select menu
          embeds: [generateApplicationDataEmbed(data)],
        });
        await mInteraction.followUp({
          content: e.message || "Failed to retrieve your Minecraft profile.",
          ephemeral: true,
        });
        return;
      }

      const reason = `IGN change requested by ${interaction.user.tag} (${interaction.user.id})`;
      try {
        await interaction.client.rest.patch(
          Routes.guildMember(interaction.guildId, data.user),
          {
            body: {
              nick: playerInfo.name,
            } satisfies RESTPatchAPIGuildMemberJSONBody,
            reason,
          },
        );
      } catch {}

      await mInteraction.editReply({
        embeds: [
          generateApplicationDataEmbed({
            ...data,
            id: playerInfo.id,
            name: playerInfo.name,
          }),
        ],
      });

      const emoji = interaction.channel.name.split(" ")[0];
      await interaction.channel.edit({
        name: `${emoji} ${playerInfo.name}`.slice(0, 100),
        archived: false,
        reason,
      });
    }
  },
};
