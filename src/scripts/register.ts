import {
  REST,
  Routes,
  type RESTPutAPIApplicationCommandsJSONBody,
} from "discord.js";
import path from "node:path";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import type { CommandModule } from "../index.js";

dotenv.config();

const { ENVIRONMENT, APPLICATION_ID, BOT_TOKEN, DEVELOPMENT_GUILD_ID } =
  process.env;

if (!BOT_TOKEN || !APPLICATION_ID) {
  throw Error("BOT_TOKEN is required");
}

const rest = new REST().setToken(BOT_TOKEN);

(async () => {
  const commandsPath = path.join(__dirname, "../commands");
  const commandFiles = (await fs.readdir(commandsPath)).filter((file) =>
    file.endsWith(".ts"),
  );

  const commands: RESTPutAPIApplicationCommandsJSONBody = [];

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command: CommandModule = require(filePath);
    if ("data" in command) {
      try {
        commands.push(command.data.toJSON());
      } catch (e) {
        console.log(`[FAILURE] ${filePath}`);
        throw e;
      }
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing the required "data" property.`,
      );
    }
  }

  console.log(
    await rest.put(
      ENVIRONMENT === "dev" && DEVELOPMENT_GUILD_ID
        ? Routes.applicationGuildCommands(APPLICATION_ID, DEVELOPMENT_GUILD_ID)
        : Routes.applicationCommands(APPLICATION_ID),
      { body: commands },
    ),
  );
})();
