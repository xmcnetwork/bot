import {
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { BotClient } from "..";

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
        .setName("say")
        .setDescription(
          "Broadcast a message in chat to all players on the server",
        )
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription("The message to say")
            .setMaxLength(256)
            .setRequired(true),
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
    let commandValue: string | undefined;

    if (interaction.options.getSubcommandGroup()) {
      switch (interaction.options.getSubcommandGroup()) {
        case "whitelist": {
          commandValue = `whitelist ${interaction.options.getSubcommand()} ${
            interaction.options.getString("name") ?? ""
          }`;
          break;
        }
        case "bans": {
          const reason = interaction.options.getString("reason") ?? "";
          switch (interaction.options.getSubcommand()) {
            case "add": {
              commandValue = `ban ${interaction.options.getString(
                "name",
                true,
              )} ${reason}`;
              break;
            }
            case "pardon": {
              commandValue = `pardon ${interaction.options.getString(
                "name",
                true,
              )}`;
              break;
            }
            case "add-ip": {
              commandValue = `ban-ip ${interaction.options.getString(
                "ip",
                true,
              )} ${reason}`;
              break;
            }
            case "pardon-ip": {
              commandValue = `pardon-ip ${interaction.options.getString(
                "ip",
                true,
              )}`;
              break;
            }
            default:
              break;
          }
          break;
        }
        default:
          break;
      }
    } else {
      switch (interaction.options.getSubcommand()) {
        case "raw": {
          commandValue = interaction.options.getString("command", true);
          break;
        }
        case "say": {
          commandValue = `say ${interaction.options.getString(
            "message",
            true,
          )}`;
          break;
        }
        default:
          break;
      }
    }

    if (!commandValue) {
      await interaction.reply({
        content: "No command could be formed from the arguments.",
        ephemeral: true,
      });
      return;
    }

    const client = interaction.client as BotClient;
    await client.sendMinecraftCommand(commandValue);
    await interaction.reply({
      content: "Command sent. Check logs for details.",
      ephemeral: true,
    });
  },
};
