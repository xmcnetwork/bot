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
  Routes,
  type APIEmbed,
  type APIMessage,
  WebhookClient,
} from "discord.js";
import {
  type GetAPIUsernameToUUIDResult,
  getMinecraftPlayer,
} from "../util/minecraft.js";
import {
  getSftpClient,
  type MinecraftServerBan,
  type MinecraftServerWhitelistItem,
} from "../util/sftp.js";
import type { BotClient } from "../index.js";

const modalStep1 = new ModalBuilder()
  .setTitle("Join - Step 1/2")
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
        .setMaxLength(50),
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
    ) {
      return;
    }

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

    const modal1 = modalStep1.toJSON();
    // Prevent unfulfilled interaction awaiters from catching this modal
    // response and attempting to respond to it
    modal1.custom_id += `:${String(Math.floor(Math.random() * 100000))}`;

    await interaction.showModal(modal1);
    let mInteraction1: ModalSubmitInteraction;
    try {
      mInteraction1 = await interaction.awaitModalSubmit({
        filter: (i) =>
          i.customId === modal1.custom_id && i.user === interaction.user,
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

    let content = `Everything looks good so far, **${
      playerInfo?.name ?? ign
    }**! All that's left is to read the rules, make sure you agree, then click the button to join the server.`;
    let ruleEmbeds: APIEmbed[] = [];
    const { RULES_CHANNEL_ID, RULES_MESSAGE_ID } = process.env;
    if (RULES_CHANNEL_ID && RULES_MESSAGE_ID) {
      try {
        const rulesMsg = (await interaction.client.rest.get(
          Routes.channelMessage(RULES_CHANNEL_ID, RULES_MESSAGE_ID),
        )) as APIMessage;
        ruleEmbeds = rulesMsg.embeds;
      } catch {}
    }
    if (ruleEmbeds.length === 0) {
      if (RULES_CHANNEL_ID) {
        content += ` Read the rules here: <#${RULES_CHANNEL_ID}>`;
      } else {
        content += " See the rules channel in the sidebar or channel list.";
      }
    }

    let message = await mInteraction1.editReply({
      content,
      embeds: ruleEmbeds.length === 0 ? undefined : ruleEmbeds,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("agree")
            .setLabel("I Agree (60s)")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        ),
      ],
    });
    const steps = [50, 40, 30, 20, 10, 0];
    for (const step of steps) {
      await new Promise((r) => setTimeout(r, 10_000));
      message = await mInteraction1.editReply({
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("agree")
              .setLabel(step === 0 ? "I Agree" : `I Agree (${step}s)`)
              .setStyle(ButtonStyle.Primary)
              .setDisabled(step !== 0),
          ),
        ],
      });
    }

    let step2Interaction: MessageComponentInteraction;
    try {
      step2Interaction = await message.awaitMessageComponent({
        dispose: false,
        // 10 minutes
        time: 600_000,
      });
    } catch {
      await mInteraction1.editReply({
        content: "Timed out, press the join button again to start over.",
        embeds: [],
        components: [],
      });
      return;
    }

    await step2Interaction.deferUpdate();

    const client = interaction.client as BotClient;
    await client.sendMinecraftCommand(`whitelist add ${playerInfo.name}`);
    if (process.env.PTERODACTYL_CREATIVE_SERVER_ID) {
      await client.sendMinecraftCommand(
        `whitelist add ${playerInfo.name}`,
        process.env.PTERODACTYL_CREATIVE_SERVER_ID,
      );
    }
    client.players.set(interaction.user.id, {
      uuid: interaction.user.id,
      name: playerInfo.name,
    });
    client.serverWhitelist.push({
      uuid: interaction.user.id,
      name: playerInfo.name,
    });

    if (
      process.env.MEMBER_ROLE_ID &&
      !member.roles.cache.has(process.env.MEMBER_ROLE_ID)
    ) {
      await member.roles.add(
        process.env.MEMBER_ROLE_ID,
        `Whitelisted automatically (age: ${age}, ign: ${playerInfo.name})`,
      );
    }
    if (member.roles.cache.has(process.env.APPLICANT_ROLE_ID)) {
      await member.roles.remove(process.env.APPLICANT_ROLE_ID);
    }

    await step2Interaction.editReply({
      content:
        "Great job! You have been whitelisted and should be able to access the rest of the server.",
      embeds: [],
      components: [],
    });

    if (process.env.WELCOME_WEBHOOK_URL) {
      const webhook = new WebhookClient({
        url: process.env.WELCOME_WEBHOOK_URL,
      });
      await webhook.send({
        content: [
          `Please welcome <@${interaction.user.id}> (**${playerInfo.name}**)!`,
          "",
          "-# REMINDER: This member was not manually approved ([we changed the application process](https://discord.com/channels/565315993807880223/849241298611601439/1327371818822275136)). Contact an admin if they seem to be causing trouble.",
        ].join("\n"),
        allowedMentions: { users: [interaction.user.id] },
      });
    }
  },
};
