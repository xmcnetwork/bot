import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { color } from "../util/meta";
import { getSftpFile } from "../util/sftp";

interface Pl3xMapTileSettings {
  format: string;
  maxPlayers: number;
  lang: {
    title: string;
    langFile: string;
    blockInfo: {
      unknown: { biome: string; block: string };
      value: string;
      label: string;
    };
    coords: { label: string; value: string };
    layers: { label: string; value: string };
    link: { label: string; value: string };
    markers: { label: string; value: string };
    players: {
      label: string;
      value: string;
    };
    worlds: { label: string; value: string };
  };
  zoom: { snap: number; delta: number; wheel: number };
  players: {
    name: string;
    uuid: string;
    displayName: string;
    world: string;
    position: { x: number; z: number };
  }[];
  worldSettings: {
    name: string;
    displayName: string;
    type: string;
    order: number;
    renderers: {
      value: string;
      label: string;
      icon: string;
    }[];
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("list")
    .setDescription("See the list of players online right now"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    let file: string;
    try {
      file = (await getSftpFile(
        "config/pl3xmap/web/tiles/settings.json",
      )) as string;
    } catch {
      await interaction.editReply({
        content: "The server is missing a necessary file for this command.",
      });
      return;
    }

    const { players, maxPlayers } = JSON.parse(file) as Pl3xMapTileSettings;

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setTitle(`Players - ${players.length}/${maxPlayers}`)
          .setDescription(
            players
              .map((player) => {
                const member = interaction.guild.members.cache.find(
                  (member) =>
                    member.displayName.toLowerCase() ===
                    player.name.toLowerCase(),
                );
                return `- ${
                  member ? `<@${member.id}>` : player.name
                } (${player.world.split(":")[1].replace(/_/g, " ")})`;
              })
              .join("\n")
              .slice(0, 4096),
          ),
      ],
    });
  },
};
