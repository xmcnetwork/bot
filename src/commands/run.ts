import {
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("run")
    .setDescription("Run a server command")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup((option) =>
      option
        .setName("whitelist")
        .setDescription("Whitelist management")
        .addSubcommand((option) =>
          option
            .setName("add")
            .setDescription("Add a player to the whitelist")
            .addStringOption((option) =>
              option
                .setName("name")
                .setDescription("The player's IGN")
                .setMaxLength(25)
                .setRequired(true),
            ),
        )
        .addSubcommand((option) =>
          option
            .setName("remove")
            .setDescription("Remove a player from the whitelist")
            .addStringOption((option) =>
              option
                .setName("name")
                .setDescription("The player's IGN")
                .setMaxLength(25)
                .setRequired(true),
            ),
        )
        .addSubcommand((option) =>
          option.setName("off").setDescription("Disable the whitelist"),
        )
        .addSubcommand((option) =>
          option.setName("on").setDescription("Enable the whitelist"),
        )
        .addSubcommand((option) =>
          option
            .setName("reload")
            .setDescription("Manually reload the whitelist"),
        ),
    )
    .addSubcommandGroup((option) =>
      option
        .setName("bans")
        .setDescription("Ban management")
        .addSubcommand((option) =>
          option
            .setName("add")
            .setDescription("Ban a player")
            .addStringOption((option) =>
              option
                .setName("name")
                .setDescription("The player's IGN")
                .setMaxLength(25)
                .setRequired(true),
            )
            .addStringOption((option) =>
              option
                .setName("reason")
                .setDescription("The ban reason")
                .setRequired(false),
            ),
        )
        .addSubcommand((option) =>
          option
            .setName("pardon")
            .setDescription("Unban a player")
            .addStringOption((option) =>
              option
                .setName("name")
                .setDescription("The player's IGN")
                .setMaxLength(25)
                .setRequired(true),
            ),
        )
        .addSubcommand((option) =>
          option
            .setName("add-ip")
            .setDescription("Ban an IP")
            .addStringOption((option) =>
              option
                .setName("ip")
                .setDescription("The IP to ban")
                .setRequired(true),
            )
            .addStringOption((option) =>
              option
                .setName("reason")
                .setDescription("The ban reason")
                .setRequired(false),
            ),
        )
        .addSubcommand((option) =>
          option
            .setName("pardon-ip")
            .setDescription("Unban an IP")
            .addStringOption((option) =>
              option
                .setName("ip")
                .setDescription("The IP to unban")
                .setRequired(true),
            ),
        ),
    )
    .addSubcommand((option) =>
      option
        .setName("raw")
        .setDescription("Run a raw command (be careful!)")
        .addStringOption((option) =>
          option
            .setName("command")
            .setDescription("The command to run")
            .setRequired(true),
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    let commandValue: string;
    if (interaction.options.getSubcommand() === "raw") {
      commandValue = interaction.options.getString("raw", true);
    } else {
      commandValue = "";
    }
    await interaction.reply({ content: "OK", ephemeral: true });
  },
};
