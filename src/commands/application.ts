import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("send-application-message")
    .setDescription("Sends a message with a button that members can apply with")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel to send to")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel("channel", true, [
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
    ]);
    await channel.send({
      content: [
        "Be sure to read the welcome message! If you just skipped by it, that's fine, press the button to get started.",
        "",
        "If you have questions, <#911031775302672424> is the place to ask. You can also DM <@404380636833644557> for a potentially quicker response.",
      ].join("\n"),
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Primary)
            .setLabel("Apply")
            .setCustomId("persistent:apply:1"),
        ),
      ],
      allowedMentions: {
        users: [],
      },
    });

    await interaction.reply({ content: "OK", ephemeral: true });
  },
};
