import {
  ActivityType,
  ApplicationCommandType,
  type AutocompleteInteraction,
  Client,
  Collection,
  type CommandInteraction,
  type ContextMenuCommandBuilder,
  Events,
  GatewayIntentBits,
  type MessageComponentInteraction,
  type SlashCommandBuilder,
} from "discord.js";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import {
  getSftpClient,
  type MinecraftServerUserCacheItem,
  type MinecraftServerBan,
  type MinecraftServerWhitelistItem,
} from "./util/sftp.js";
import { NodeactylClient } from "nodeactyl";

dotenv.config();

export interface CommandModule {
  data: SlashCommandBuilder | ContextMenuCommandBuilder;
  execute: (interaction: CommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export interface ComponentModule {
  customId: string;
  execute: (interaction: MessageComponentInteraction) => Promise<void>;
}

const { PTERODACTYL_HOST, PTERODACTYL_KEY, PTERODACTYL_SERVER_ID } =
  process.env;

if (PTERODACTYL_HOST && PTERODACTYL_KEY && !PTERODACTYL_SERVER_ID) {
  throw Error(
    "PTERODACTYL_SERVER_ID is required when other PTERODACTYL_ keys are specified.",
  );
}

export class BotClient<ready extends boolean = boolean> extends Client<ready> {
  // Discord
  public commands: Record<
    ApplicationCommandType,
    Collection<string, CommandModule>
  >;
  public persistentComponents: Collection<string, ComponentModule>;

  // Pterodactyl
  public ptero: NodeactylClient | undefined;
  // public pteroWs: WebSocket | undefined;
  // public serverStats: PterodactylStats | undefined;

  // SFTP
  public players: Collection<
    string,
    {
      uuid: string;
      name: string;
      //expires: Date;
    }
  >;
  public serverWhitelist: MinecraftServerWhitelistItem[];
  public serverBans: MinecraftServerBan[];

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      presence: {
        activities: [
          {
            type: ActivityType.Custom,
            name: "custom",
            state: "Apply in #landing",
          },
        ],
      },
    });
    this.commands = {
      [ApplicationCommandType.ChatInput]: new Collection(),
      [ApplicationCommandType.Message]: new Collection(),
      [ApplicationCommandType.User]: new Collection(),
    };
    this.persistentComponents = new Collection();
    this.players = new Collection();
    this.serverWhitelist = [];
    this.serverBans = [];

    if (PTERODACTYL_HOST && PTERODACTYL_KEY) {
      this.ptero = new NodeactylClient(PTERODACTYL_HOST, PTERODACTYL_KEY);
    }
  }

  async sendMinecraftCommand(command: string): Promise<boolean> {
    if (!this.ptero) {
      throw Error("Bot client has no Pterodactyl client");
    }

    // await this.pteroWs.send(JSON.stringify({
    // }))

    try {
      // This is fine but it doesn't return a command output
      // so we have to kind of operate blind
      const result: boolean = await this.ptero.sendServerCommand(
        PTERODACTYL_SERVER_ID,
        command,
      );
      return result;
    } catch {
      return false;
    }
  }
}

const client = new BotClient();

client.once(Events.ClientReady, (readyClient) => {
  console.log(`
    User: ${readyClient.user.tag}
    Environment: ${process.env.ENVIRONMENT}
  `);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isCommand() || interaction.isAutocomplete()) {
    const module = client.commands[interaction.commandType].get(
      interaction.commandName,
    );
    if (module) {
      if (interaction.isAutocomplete()) {
        if (!module.autocomplete) {
          await interaction.respond([]);
          return;
        }
        try {
          await module.autocomplete(interaction);
        } catch (error) {
          console.error(error);
        }
      } else {
        try {
          await module.execute(interaction);
        } catch (error) {
          console.error(error);
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: "Something failed. This has been logged.",
              ephemeral: true,
            });
          } else {
            await interaction.reply({
              content: "Something failed. This has been logged.",
              ephemeral: true,
            });
          }
        }
      }
    }
  } else if (
    interaction.isMessageComponent() &&
    interaction.customId.startsWith("persistent:")
  ) {
    const module = client.persistentComponents.get(
      interaction.customId.replace(/^persistent:/, ""),
    );
    if (module) {
      try {
        await module.execute(interaction);
      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: "Something failed. This has been logged.",
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: "Something failed. This has been logged.",
            ephemeral: true,
          });
        }
      }
    }
  }
});

// Role ID to scoreboard team name
let colorRoles: Record<string, string> = {};
try {
  const colorRolesRaw = process.env.COLOR_ROLES;
  if (colorRolesRaw) {
    colorRoles = JSON.parse(colorRolesRaw);
  }
} catch {}

// Manage colored names through Discord roles
client.on(Events.GuildMemberUpdate, async (before, member) => {
  if (
    !client.ptero ||
    member.user.bot ||
    !member.roles.cache.has(process.env.MEMBER_ROLE_ID)
  )
    return;
  // TODO: store a local map
  const ign = member.displayName;
  if (ign.includes(" ") || ign.length > 25) return;

  // Should already be sorted by role order
  const colorRole = member.roles.cache.find((role) =>
    Object.keys(colorRoles).includes(role.id),
  );
  if (!colorRole) {
    await client.sendMinecraftCommand(`team leave ${ign}`);
    return;
  }

  const previousColorRole = before.roles.cache.find((role) =>
    Object.keys(colorRoles).includes(role.id),
  );
  if (!!previousColorRole && colorRole.id === previousColorRole.id) return;

  // > Named player needn't to be online, and it even needn't be a real player's name.
  // https://minecraft.wiki/w/Commands/team

  // We might want to do some more validation before we start storing
  // actual data for members.

  await client.sendMinecraftCommand(
    `team join ${colorRoles[colorRole.id]} ${ign}`,
  );
});

(async () => {
  // Commands
  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = (await fs.readdir(commandsPath)).filter((file) =>
    file.endsWith(".ts"),
  );

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command: CommandModule = require(filePath);
    if ("data" in command && "execute" in command) {
      const type =
        command.data.toJSON().type ?? ApplicationCommandType.ChatInput;
      client.commands[type].set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
      );
    }
  }

  // Persistent components
  const componentsPath = path.join(__dirname, "components");
  const componentFiles = (await fs.readdir(componentsPath)).filter((file) =>
    file.endsWith(".ts"),
  );

  for (const file of componentFiles) {
    const filePath = path.join(componentsPath, file);
    const component: ComponentModule = require(filePath);
    if ("execute" in component && "customId" in component) {
      client.persistentComponents.set(component.customId, component);
    } else {
      console.log(
        `[WARNING] The component at ${filePath} is missing a required "customId" or "execute" property.`,
      );
    }
  }

  // Pterodactyl server interop
  // if (client.ptero) {
  //   let {
  //     token,
  //     socket,
  //   }: {
  //     token: string;
  //     socket: string;
  //   } = await client.ptero.getConsoleWebSocket(PTERODACTYL_SERVER_ID);

  //   console.log("[PTERO] Connecting to socket at", socket);
  //   const ws = new WebSocket(socket, {
  //     // https://stackoverflow.com/a/71628121
  //     origin: PTERODACTYL_HOST,
  //   });
  //   // client.pteroWs = ws;

  //   const wsAuthenticate = () => {
  //     ws.send(
  //       JSON.stringify({
  //         event: "auth",
  //         args: [token],
  //       }),
  //     );
  //   };

  //   ws.on("error", console.error);
  //   ws.on("open", () => {
  //     wsAuthenticate();
  //     console.log("[PTERO] Opened and authenticated");
  //   });
  //   ws.on("message", async (raw) => {
  //     if (raw instanceof Buffer) {
  //       const data = JSON.parse(
  //         raw.toString("utf8"),
  //       ) as PterodactylWebsocketMessage;
  //       switch (data.event) {
  //         case PterodactylWebsocketMessageEvent.Stats: {
  //           const serverStats: PterodactylStats = JSON.parse(data.args[0]);
  //           client.serverStats = serverStats;
  //           break;
  //         }
  //         // case PterodactylWebsocketMessageEvent.
  //         case PterodactylWebsocketMessageEvent.TokenExpiring:
  //         case PterodactylWebsocketMessageEvent.TokenExpired: {
  //           ({ token, socket } = await client.ptero.getConsoleWebSocket(data));
  //           wsAuthenticate();
  //           break;
  //         }
  //         default:
  //           break;
  //       }
  //     }
  //   });
  //   ws.on("close", (code, reason) => {
  //     console.log(
  //       `Connection to ${socket} closed with code ${code}: ${reason}`,
  //     );
  //     if (code === 1000) {
  //       return;
  //     }
  //   });
  // }

  // Server cache
  try {
    console.log("[SFTP] Connecting");
    const sftp = await getSftpClient();
    console.log("[SFTP] Caching usercache.json");
    try {
      // This is used for autocomplete
      const usercache = JSON.parse(
        (await sftp.get("/usercache.json")) as string,
      ) as MinecraftServerUserCacheItem[];
      for (const user of usercache) {
        client.players.set(user.uuid.replace(/-/g, ""), {
          uuid: user.uuid,
          name: user.name,
          // expires: new Date(user.expiresOn),
        });
      }
    } catch (e) {
      // Might not exist, we don't need it
      console.error(e);
    }
    console.log("[SFTP] Caching whitelist.json");
    try {
      const whitelist = JSON.parse(
        (await sftp.get("/whitelist.json")) as string,
      ) as MinecraftServerWhitelistItem[];
      client.serverWhitelist = whitelist;
    } catch (e) {
      console.error(e);
    }
    console.log("[SFTP] Caching banned-players.json");
    try {
      const bans = JSON.parse(
        (await sftp.get("/banned-players.json")) as string,
      ) as MinecraftServerBan[];
      client.serverBans = bans;
    } catch (e) {
      console.error(e);
    }
    console.log("[SFTP] Disconnecting");
    await sftp.end();
  } catch (e) {
    console.error(e);
  }

  await client.login(process.env.BOT_TOKEN);
})();
