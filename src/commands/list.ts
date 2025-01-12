import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { color } from "../util/meta";

// interface Pl3xMapTileSettings {
//   format: string;
//   maxPlayers: number;
//   lang: {
//     title: string;
//     langFile: string;
//     blockInfo: {
//       unknown: { biome: string; block: string };
//       value: string;
//       label: string;
//     };
//     coords: { label: string; value: string };
//     layers: { label: string; value: string };
//     link: { label: string; value: string };
//     markers: { label: string; value: string };
//     players: {
//       label: string;
//       value: string;
//     };
//     worlds: { label: string; value: string };
//   };
//   zoom: { snap: number; delta: number; wheel: number };
//   players: {
//     name: string;
//     uuid: string;
//     displayName: string;
//     world: string;
//     position: { x: number; z: number };
//   }[];
//   worldSettings: {
//     name: string;
//     displayName: string;
//     type: string;
//     order: number;
//     renderers: {
//       value: string;
//       label: string;
//       icon: string;
//     }[];
//   };
// }

interface BlueMapPlayer {
  uuid: string;
  name: string;
  foreign: boolean;
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotation: {
    pitch: number;
    yaw: number;
    roll: number;
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("list")
    .setDescription("See the list of players online right now"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const randomNumber = String(Math.floor(Math.random() * 1000000));
    const response = await fetch(
      `https://map.xmcnet.work/maps/xmc7/live/players.json?${randomNumber}`,
      { method: "GET" },
    ).then((r) => r.json());
    if (!response.players) {
      await interaction.editReply({ content: "Unable to fetch players." });
      return;
    }
    const players = response.players as BlueMapPlayer[];

    const maxPlayers = 40;
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setTitle(`Players - ${players.length}/${maxPlayers}`)
          .setDescription(
            players.length === 0
              ? null
              : players
                  .map((player) => {
                    const member = interaction.guild.members.cache.find(
                      (member) =>
                        member.displayName.toLowerCase() ===
                        player.name.toLowerCase(),
                    );
                    return `- ${member ? `<@${member.id}>` : player.name}`;
                  })
                  .join("\n")
                  .slice(0, 4096),
          ),
      ],
    });
  },
};
