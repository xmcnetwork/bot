import {
  ActivityType,
  ApplicationCommandType,
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
// import { NodeactylClient } from "nodeactyl";
// import { WebSocket } from "ws";

dotenv.config();

export interface CommandModule {
  data: SlashCommandBuilder | ContextMenuCommandBuilder;
  execute: (interaction: CommandInteraction) => Promise<void>;
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

export class BotClient<ready extends boolean> extends Client<ready> {
  public commands: Record<
    ApplicationCommandType,
    Collection<string, CommandModule>
  >;
  public persistentComponents: Collection<string, ComponentModule>;
  // public ptero: NodeactylClient | undefined;
  // public serverStatus: PterodactylStats | undefined;

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

    if (PTERODACTYL_HOST && PTERODACTYL_KEY) {
      // this.ptero = new NodeactylClient(PTERODACTYL_HOST, PTERODACTYL_KEY);
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
  if (interaction.isCommand()) {
    const module = client.commands[interaction.commandType].get(
      interaction.commandName,
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

  //   const ws = new WebSocket(socket, {
  //     // https://stackoverflow.com/a/71628121
  //     origin: PTERODACTYL_HOST,
  //   });
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
  //   });
  //   ws.on("message", async (raw) => {
  //     if (raw instanceof Buffer) {
  //       const data = JSON.parse(
  //         raw.toString("utf8"),
  //       ) as PterodactylWebsocketMessage;
  //       switch (data.event) {
  //         case PterodactylWebsocketMessageEvent.Stats: {
  //           client.serverStatus = JSON.parse(data.args[0]);
  //           break;
  //         }
  //         case PterodactylWebsocketMessageEvent.TokenExpiring:
  //         case PterodactylWebsocketMessageEvent.TokenExpired: {
  //           ({ token, socket } = await client.ptero.getConsoleWebSocket(
  //             PTERODACTYL_SERVER_ID,
  //           ));
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
  //     // if (code === 1000) {
  //     //   return;
  //     // }
  //   });
  // }

  client.login(process.env.BOT_TOKEN);
})();
