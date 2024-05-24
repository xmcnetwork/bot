import {
  EmbedBuilder,
  type AutocompleteInteraction,
  type Message,
} from "discord.js";
import type { ApplicationEmbedPayload } from "../components/apply.js";
import type { BotClient } from "../index.js";
import { color } from "./meta.js";

type MojangErrorData =
  | {
      path: string;
      errorMessage: string;
    }
  | {
      error: string;
      errorMessage: string;
    };

export interface GetAPIUsernameToUUIDResult {
  name: string;
  id: string;
  legacy?: true;
  demo?: true;
}

export enum MinecraftProfileAction {
  ForcedNameChange = "FORCED_NAME_CHANGE",
  UsingBannedSkin = "USING_BANNED_SKIN",
}

export interface GetAPIUUIDToProfileResult {
  name: string;
  id: string;
  legacy?: true;
  properties: {
    name: "textures";
    value: string;
    signature?: string;
  }[];
  profileActions: MinecraftProfileAction[];
}

export type PlayerInfo = GetAPIUUIDToProfileResult | GetAPIUsernameToUUIDResult;

export const getMinecraftPlayer = async (ign: string) => {
  const response = await fetch(
    `https://api.mojang.com/users/profiles/minecraft/${ign}`,
    { method: "GET" },
  );
  if (!response.ok) {
    const data = (await response.json()) as MojangErrorData;
    throw new Error(`[${response.status}] ${data.errorMessage}`);
  }
  if (response.status === 204) {
    throw new Error("Failed to fetch player");
  }
  const data = (await response.json()) as GetAPIUsernameToUUIDResult;
  return data;
};

export const getMinecraftUUIDProfile = async (uuid: string) => {
  const response = await fetch(
    `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`,
    { method: "GET" },
  );
  if (!response.ok) {
    const data = (await response.json()) as MojangErrorData;
    throw new Error(`[${response.status}] ${data.errorMessage}`);
  }
  if (response.status === 204) {
    throw new Error("Failed to fetch profile");
  }
  const data = (await response.json()) as GetAPIUUIDToProfileResult;
  return data;
};

export const hyphenateUUID = (uuid: string) => {
  return uuid.replace(/^(\S{8})(\S{4})(\S{4})(\S{4})(.*)$/, "$1-$2-$3-$4-$5");
};

// We host our own instance, and we suggest you do too
// https://github.com/crafatar/crafatar/issues/322
const CRAFATAR_HOST = process.env.CRAFATAR_HOST ?? "https://crafatar.com";

export const getMinecraftPlayerSkinUrl = (
  /** The UUID of the player. */
  uuid: string,
  // Option descriptions (and the service itself): https://crafatar.com
  options: {
    /**
     * The render type to use. `face` is a 2D front-facing image, `head` and
     * `body` are 3D isometric views.
     */
    render: "head" | "body" | "face";
    /**
     * If `render` is `face`, the size of the square image in pixels,
     * from 1-512. Otherwise, the scale factor from 1-10.
     *
     * For 3D renders, scale `1` is 20px wide and scale `10` is 200px wide.
     * The default render (scale `6`) is 120px wide.
     *
     * @default 160
     */
    size?: number;
    /**
     * Whether to apply the overlay to the avatar.
     *
     * @default true
     */
    overlay?: boolean;
    /**
     * The fallback to be used when the requested image cannot be served. You
     * can use a custom URL, any UUID, or `MHF_Steve`/`MHF_Alex`.
     *
     * @default string - Steve or Alex based on UUID
     */
    fallback?: string;
  },
) => {
  const url = new URL(
    `${CRAFATAR_HOST}/${
      options.render === "face" ? "avatars" : `renders/${options.render}`
    }/${uuid}`,
  );
  if (options.size && options.render === "face") {
    url.searchParams.set("size", options.size.toString());
  } else if (options.size) {
    url.searchParams.set("scale", options.size.toString());
  }
  if (options.overlay !== false) {
    url.searchParams.set("overlay", `${options.overlay ?? true}`);
  }
  if (options.fallback) {
    url.searchParams.set("default", options.fallback);
  }
  return url.href;
};

export const extractApplicationData = (message: Message) => {
  return JSON.parse(
    new URL(message.embeds[0].url ?? "").searchParams.get("data") ?? "",
  ) as ApplicationEmbedPayload;
};

export const autocompletePlayerName = async (
  interaction: AutocompleteInteraction,
  optionName: string,
) => {
  const client = interaction.client as BotClient<true>;
  const option = interaction.options.getFocused(true);
  if (option.name !== optionName) {
    await interaction.respond([]);
    return;
  }

  const query = option.value;
  const matches = Array.from(client.players.values()).filter((cached) =>
    cached.name.toLowerCase().includes(query.toLowerCase()),
  );

  await interaction.respond(
    matches
      .map((match) => ({
        name: match.name,
        value: `uuid:${match.uuid}`,
      }))
      .sort((a, b) => (a.name > b.name ? 1 : -1))
      .slice(0, 25),
  );
};

export const resolvePlayerValue = async (
  value: string,
): Promise<PlayerInfo> => {
  if (value.startsWith("uuid:")) {
    return await getMinecraftUUIDProfile(
      value.replace(/^uuid:/, "").replace(/-/g, ""),
    );
  }
  if (value.length > 25 || value.length < 1) {
    throw Error("1-25 characters required for a valid username.");
  }
  return await getMinecraftPlayer(value);
};

export const generateApplicationDataEmbed = (data: ApplicationEmbedPayload) =>
  new EmbedBuilder()
    .setColor(color)
    .setURL(
      `http://localhost/?${new URLSearchParams({
        data: JSON.stringify(data),
      })}`,
    )
    .setDescription(
      [
        `Hey **${data.name}**, this is your application thread.\n\n`,
        "The fellow members of this thread are our team of application reviewers. ",
        "Your application will be briefly discussed and voted on in private.",
      ].join(""),
    )
    .setThumbnail(
      data.id ? getMinecraftPlayerSkinUrl(data.id, { render: "head" }) : null,
    );
