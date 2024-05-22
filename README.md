# xmcnetwork/bot

## Environment variables

```
ENVIRONMENT             # dev or production
APPLICATION_ID
BOT_TOKEN
DEVELOPMENT_GUILD_ID    # optional
APPLICATIONS_CHAT_ID
APPLICATIONS_REVIEWER_ROLE_ID
CRAFATAR_HOST           # origin of your crafatar instance

SFTP_HOST
SFTP_PORT               # defaults to 7677 for dedicatedmc.io servers
SFTP_USERNAME
SFTP_PASSWORD
PTERODACTYL_HOST
PTERODACTYL_KEY
PTERODACTYL_SERVER_ID
```

## Server interoperability

We use DedicatedMC.io as our server host (and have since late 2019). They provide standard SFTP access and a Pterodactyl-based panel. For the purpose of simplicity, this bot deals with only one server at a time, specified by `PTERODACTYL_SERVER_ID`.

If you are self-hosting this bot and do not use a server with Pterodactyl, you may omit all `PTERODACTYL_` environment variables and still use `SFTP_` variables with your own server (for reading `whitelist.json` & `banned-players.json`). This bot does not commit non-read operations over SFTP.
