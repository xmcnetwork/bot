import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ComponentType,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { getMinecraftPlayerSkinUrl } from "../util/minecraft";

const getSizeSelect = (current: number) => {
  const sizes = [512, 256, 128, 64, 32, 16];
  return new StringSelectMenuBuilder()
    .setCustomId("size")
    .setPlaceholder("Image size")
    .addOptions(
      sizes.map((size) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${size}x${size}`)
          .setValue(String(size))
          .setDefault(size === current),
      ),
    );
};

const getOpenUrlButtonRow = (url: string) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setURL(url)
      .setLabel("Open URL"),
  );

module.exports = {
  customId: "face",
  async execute(interaction: ButtonInteraction) {
    if (
      interaction.channel?.type !== ChannelType.GuildText ||
      !interaction.guildId ||
      !interaction.message.embeds.length
    ) {
      return;
    }

    const uuidMatch =
      interaction.message.embeds[0].footer?.text?.match(/^ID: ([\w-]+)$/);
    if (!uuidMatch) return;

    const hyphenated = uuidMatch[1];
    const uuid = hyphenated.replace(/-/g, "");
    let size = 32;
    let url = getMinecraftPlayerSkinUrl(uuid, {
      render: "face",
      size,
      extension: true,
    });

    const response = await interaction.reply({
      files: [new AttachmentBuilder(url)],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          getSizeSelect(size),
        ),
        getOpenUrlButtonRow(url),
      ],
      ephemeral: true,
    });
    const message = await response.fetch();

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 600_000,
    });
    collector.on("collect", (i) => {
      size = Number(i.values[0]);
      url = getMinecraftPlayerSkinUrl(uuid, {
        render: "face",
        size,
        extension: true,
      });

      i.update({
        files: [new AttachmentBuilder(url)],
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            getSizeSelect(size),
          ),
          getOpenUrlButtonRow(url),
        ],
      });
    });
    collector.on("end", () => {
      response
        .edit({
          components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
              getSizeSelect(size).setDisabled(true),
            ),
            getOpenUrlButtonRow(url),
          ],
        })
        .catch(console.error);
    });
  },
};
