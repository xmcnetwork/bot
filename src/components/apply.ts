import {
  ActionRowBuilder,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  time,
  TimestampStyles,
  ButtonBuilder,
  ButtonStyle,
  type MessageComponentInteraction,
  ChannelType,
  EmbedBuilder,
  spoiler,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import {
  generateApplicationDataEmbed,
  type GetAPIUsernameToUUIDResult,
  getMinecraftPlayer,
  getMinecraftPlayerSkinUrl,
} from "../util/minecraft";
import {
  getSftpClient,
  type MinecraftServerBan,
  type MinecraftServerWhitelistItem,
} from "../util/sftp";
import { color } from "../util/meta";

const modalStep1 = new ModalBuilder()
  .setTitle("Apply - Step 1/2")
  .setCustomId("apply-step-1")
  .addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setLabel("IGN")
        .setCustomId("ign")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Your Minecraft Java Edition username")
        .setRequired(true)
        // size must be between 1 and 25, getProfileName.name: Invalid profile name
        // -- api.mojang.com
        .setMinLength(1)
        .setMaxLength(25),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setLabel("Age")
        .setCustomId("age")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Your real-life age or general age range (e.g. 18+)")
        .setRequired(true)
        .setMinLength(2)
        .setMaxLength(100),
    ),
  );

const modalStep2 = new ModalBuilder()
  .setTitle("Apply - Step 2/2")
  .setCustomId("apply-step-2")
  .addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setLabel("Did you read & agree with the rules?")
        .setCustomId("agreed")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("(say yes)")
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setLabel("About You")
        .setCustomId("about")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(
          "Try to include details like your timezone, preferred name, and projects you've enjoyed working on.",
        )
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setLabel("Screenshots")
        .setCustomId("screenshots")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(
          "Screenshot links of past projects - this helps add legitimacy. You can add screenshots later.",
        )
        .setRequired(false),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setLabel("Questions?")
        .setCustomId("questions")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Speak now or forever hold your peace.")
        .setRequired(false),
    ),
  );

export interface ApplicationEmbedPayload {
  user: string;
  /** In case this is not available, carefully use `name`. If this *is* present, `name` is valid */
  id: string | undefined;
  /** The user's Minecraft username, or the raw value they provided if `id` is not present */
  name: string;
  values: Record<string, string>;
}

module.exports = {
  customId: "apply:1",
  async execute(interaction: ButtonInteraction) {
    if (
      interaction.channel?.type !== ChannelType.GuildText ||
      !interaction.guildId
    )
      return;

    const guild = await interaction.client.guilds.fetch(interaction.guildId);
    const member = await guild.members.fetch({
      user: interaction.user.id,
      cache: true,
    });
    if (
      process.env.MEMBER_ROLE_ID &&
      member.roles.cache.has(process.env.MEMBER_ROLE_ID)
    ) {
      await interaction.reply({
        content:
          "It looks like you're already a member. If you can't connect to the server, contact a moderator.",
        ephemeral: true,
      });
      return;
    }

    await interaction.showModal(modalStep1);

    let mInteraction1: ModalSubmitInteraction;
    try {
      mInteraction1 = await interaction.awaitModalSubmit({
        filter: (i) =>
          i.customId === modalStep1.data.custom_id &&
          i.user === interaction.user,
        dispose: true,
        // 1 hour
        time: 3_600_000,
      });
    } catch {
      // It's too late to send a followup
      return;
    }

    const ign = mInteraction1.fields.getTextInputValue("ign");
    const age = mInteraction1.fields.getTextInputValue("age");

    // They could be pretty much anything, but I'm pretty sure there
    // are none with a space
    if (/ /g.test(ign)) {
      await mInteraction1.reply({
        content: "That doesn't appear to be a valid Minecraft username.",
        ephemeral: true,
      });
      return;
    }
    if (!Number.isNaN(Number(age)) && Number(age) < 13) {
      await mInteraction1.reply({
        content: "Sorry, but you are too young to be on Discord.",
        ephemeral: true,
      });
      return;
    }

    await mInteraction1.deferReply({ ephemeral: true });

    const activeThreads = await interaction.channel.threads.fetchActive(false);
    const extantActiveThread = activeThreads.threads.find((t) =>
      t.name.toLowerCase().endsWith(` ${ign.toLowerCase()}`),
    );
    if (extantActiveThread) {
      await mInteraction1.editReply(
        `You already have an active application thread: <#${extantActiveThread.id}>`,
      );
      return;
    }
    // const archivedThreads = await interaction.channel.threads.fetchArchived();
    // const extantArchivedThread = archivedThreads.threads.find(
    //   (t) => t.name.toLowerCase() === `✅ ${ign.toLowerCase()}`,
    // );
    // if (extantArchivedThread) {
    //   await extantArchivedThread.edit({
    //     archived: false,
    //     locked: false,
    //     name: `⏳ ${ign}`,
    //   });
    //   await mInteraction1.editReply(
    //     `You already have a thread, so it's been restored: <#${extantArchivedThread.id}>`,
    //   );
    //   return;
    // }

    let playerInfo: GetAPIUsernameToUUIDResult | undefined;
    try {
      playerInfo = await getMinecraftPlayer(ign);
    } catch (e) {
      if (e.message.startsWith("[404]")) {
        await mInteraction1.editReply(e.message);
        return;
      }
    }

    let whitelisted = false;
    let ban: MinecraftServerBan | undefined;

    if (playerInfo) {
      try {
        const sftp = await getSftpClient();
        try {
          const whitelist = JSON.parse(
            (await sftp.get("/whitelist.json")) as string,
          ) as MinecraftServerWhitelistItem[];
          const bans = JSON.parse(
            (await sftp.get("/banned-players.json")) as string,
          ) as MinecraftServerBan[];

          ban = bans.find(
            (item) => item.uuid.replace("-", "") === playerInfo.id,
          );
          whitelisted = !!whitelist.find(
            (item) => item.uuid.replace("-", "") === playerInfo.id,
          );
        } catch (e) {
          console.error(e);
          await sftp.end();
        } finally {
          await sftp.end();
        }
      } catch {}
    }

    if (whitelisted) {
      await mInteraction1.editReply(
        [
          `It looks like you're already whitelisted, **${playerInfo?.name}**! `,
          "Contact a moderator to get your roles in order.",
        ].join(""),
      );
      return;
    }
    if (ban) {
      await mInteraction1.editReply(
        [
          `It looks like you were banned ${time(
            new Date(ban.created),
            TimestampStyles.RelativeTime,
          )}, **${ban.name}**. `,
          ban.expires === "forever"
            ? ""
            : `The ban will expire on ${time(
                new Date(ban.expires),
                TimestampStyles.ShortDateTime,
              )}. `,
          `Your ban reason was:\n> ${ban.reason ?? "none"}`,
          "\n\nContact a moderator if this seems incorrect.",
        ].join(""),
      );
      return;
    }
    try {
      await member.setNickname(
        playerInfo?.name ?? ign,
        "Submitted in application form",
      );
    } catch {}

    const message = await mInteraction1.editReply({
      content: `Everything looks good so far, **${
        playerInfo?.name ?? ign
      }**! Click the button to continue your application.`,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("continue")
            .setLabel("Continue")
            .setStyle(ButtonStyle.Primary),
        ),
      ],
    });

    let step2Interaction: MessageComponentInteraction;
    try {
      // I want this to continue listening in case the user closes the modal
      // by accident and wants to re-open it, but the code structure just
      // isn't right for it
      step2Interaction = await message.awaitMessageComponent({
        dispose: false,
        // 10 minutes
        time: 600_000,
      });
    } catch {
      await mInteraction1.editReply({
        content: "Timed out, press the apply button again to start over.",
        components: [],
      });
      return;
    }

    const modal2 = modalStep2.toJSON();
    await step2Interaction.showModal(modal2);
    let mInteraction2: ModalSubmitInteraction;
    try {
      mInteraction2 = await interaction.awaitModalSubmit({
        filter: (i) =>
          i.customId === modalStep2.data.custom_id &&
          i.user === interaction.user,
        dispose: true,
        // 1 hour
        time: 3_600_000,
      });
    } catch {
      // It's too late to send a followup
      return;
    }

    await mInteraction2.deferUpdate();
    const thread = await interaction.channel.threads.create({
      name: `⏳ ${playerInfo?.name ?? ign}`.slice(0, 100),
      type: ChannelType.PrivateThread,
      invitable: false,
      reason: `Application by ${interaction.user.tag} (${interaction.user.id})`,
    });

    const embeds: EmbedBuilder[] = [];
    for (const row of mInteraction2.fields.components) {
      for (const component of row.components) {
        const field = modalStep2
          .toJSON()
          .components.find(
            (r) =>
              !!r.components.find((c) => c.custom_id === component.customId),
          )?.components[0];

        const embed = new EmbedBuilder()
          .setColor(color)
          .setTitle(field?.label ?? component.customId)
          .setDescription(component.value || "no response")
          .setFooter({ text: component.customId });

        if (component.customId === "about") {
          embed.addFields({
            name: "Age",
            value: age,
          });
        }

        embeds.push(embed);
      }
    }

    const valueMessages: Record<string, string> = {};
    let i = -1;
    for (const embed of embeds) {
      i += 1;
      if (i === 0) {
        embed.setAuthor({
          name: `${playerInfo?.name ?? ign}'s application`,
          iconURL: interaction.user.displayAvatarURL({ size: 128 }),
        });
      }
      const customId = embed.data.footer?.text;
      embed.setFooter(null);

      // We do this so we can send the entire content of each up-to-4000-character
      // form response while staying below 6000 embed characters per message
      const msg = await thread.send({
        content:
          i === 0
            ? `<@&${process.env.APPLICATIONS_REVIEWER_ROLE_ID}>`
            : undefined,
        embeds: [embed],
      });
      if (customId) {
        valueMessages[customId] = msg.id;
      }
    }

    // This creates a system message that we use to separate the form response
    // messages from the data message
    await thread.members.add(interaction.user, "Applicant");

    const dataMessage = await thread.send({
      embeds: [
        generateApplicationDataEmbed({
          user: interaction.user.id,
          id: playerInfo?.id,
          name: playerInfo?.name ?? ign,
          values: valueMessages,
        }),
      ],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setPlaceholder("Application options")
            .setCustomId("persistent:apply:modify")
            .addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel("Change IGN")
                .setDescription("If you entered your username incorrectly")
                .setValue("ign")
                .setEmoji({ name: "✍️" }),
            ),
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Primary)
            .setLabel("Whitelist")
            .setCustomId("persistent:apply:whitelist"),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Danger)
            .setLabel("Reject")
            .setCustomId("persistent:apply:reject"),
        ),
      ],
    });
    try {
      await dataMessage.pin();
    } catch {}

    await mInteraction2.editReply({
      content: `Great job! Your application thread has been created: <#${thread.id}>`,
      components: [],
    });
  },
};
