# xmcnetwork/bot

## Environment variables

```
ENVIRONMENT             # dev or production
APPLICATION_ID
BOT_TOKEN
GUILD_ID                # recommended
APPLICATIONS_CHAT_ID
APPLICATIONS_REVIEWER_ROLE_ID
CRAFATAR_HOST           # origin of your crafatar instance
WELCOME_WEBHOOK_URL     # welcomes accepted applicants in the member-only general channel
RULES_MESSAGE_ID        # message embeds shown to applicants
RULES_CHANNEL_ID        # channel id for above
COLOR_ROLES             # json string of role id to minecraft team name
NEXT_START_EVENT_ID     # event ID for the time that the next season starts. requires GUILD_ID

SFTP_HOST
SFTP_PORT               # defaults to 7677 for dedicatedmc.io servers
SFTP_USERNAME
SFTP_PASSWORD
PTERODACTYL_HOST
PTERODACTYL_KEY
PTERODACTYL_SERVER_ID
PTERODACTYL_CREATIVE_SERVER_ID
```

## Server interoperability

We use DedicatedMC.io as our server host (and have since late 2019). They provide standard SFTP access and a Pterodactyl-based panel. For the purpose of simplicity, this bot deals with only one server at a time, specified by `PTERODACTYL_SERVER_ID`, but it will also whitelist players on `PTERODACTYL_CREATIVE_SERVER_ID` if the value is specified.

If you are self-hosting this bot and do not use a server with Pterodactyl, you may omit all `PTERODACTYL_` environment variables and still use `SFTP_` variables with your own server (for reading `whitelist.json` & `banned-players.json`). This bot does not commit non-read operations over SFTP.

### The `/list` command

This command relies on your server having a file at `/config/pl3xmap/web/tiles/settings.json` rather than querying the player list through the console since we are currently unable to read the output. Naturally this implies you must use the [Pl3xMap mod](https://modrinth.com/plugin/pl3xmap). If the file is inaccessible, the command will gracefully exit.

In the future, we would like to keep track of this state internally using the server console and not rely on a mod to output it to a file.

## Store

This bot operates without persistent state. The command `/send-application-message` can be used (by members with the manage guild permission) to send a message with an "Apply" button. Multiple of these may exist at the same time, and while applications will contain themselves within the selected parent, a constant guild environment is required due to role configurations.

## Privacy policy

This policy is for the Discord bot XMC#9988 (application ID 678130686128816159), effective May 23, 2024: This bot does not store any data off-platform, except that which is submitted directly to the connected Minecraft server, including users' Minecraft account usernames for the purpose of whitelist management.
