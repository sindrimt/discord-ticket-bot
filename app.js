import dotenv from 'dotenv';
dotenv.config();

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import {
  Client,
  GatewayIntentBits,
  Partials
} from 'discord.js';

import pkg from "discord.js";


const { Events, EmbedBuilder } = pkg;

const { DISCORD_TOKEN } = process.env;
import axios from "axios"


const client = new Client({
  intents: [
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
  rest: { version: '10' },
});

// Calculate __dirname for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith('.js'));


for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  import(filePath).then((module) => {
    const event = module.default;
    console.log(event)
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }).catch((error) => {
    console.error(`Error loading event ${file}:`, error);
  });
}

const generateUniqueId = () => {
  // This function generates a unique ID by appending a large random number to the current timestamp.
  const timestamp = Date.now().toString(36); // Convert timestamp to base 36 for compactness
  const randomComponent = Math.random().toString(36).substring(2, 15); // Generate a random string
  return timestamp + randomComponent;
}

client.on('channelCreate', channel => {

  console.log(channel)
  // Check if the channel is a text channel and its name starts with "ticket"
  if (channel.name.startsWith('ticket')) {
    const requestBody = {
      versionID: "production",
      action: {
        type: "launch",
      },
    };

    // Create the new user
    axios
      .post(`https://general-runtime.voiceflow.com/state/user/${generateUniqueId()}/interact`, requestBody, {
        headers: {
          Authorization: process.env.VOICEFLOW_API_KEY,
          "Content-Type": "application/json",
        },
      })
      .then((res) => {
        setTimeout(() => {
          const aiResponse = res?.data[0]?.payload?.message

          if (aiResponse) {
            channel.send("**This ticket closes after 5 minutes of inactivity**")
            //channel.send(aiResponse + " I typically respond in under 30 seconds")
            const embed = new EmbedBuilder()
              .setAuthor({
                name: "Funding Pips Ticket Support",
                iconURL: "https://s3-eu-west-1.amazonaws.com/tpd/logos/634a4940f5023fc9ea219434/0x0.png",
                url: "https://fundingpips.com/",
              })
              .setTitle("Hi, I'm the Funding Pips AI Assistant. How may I help you? Just mention a keyword for assistance with your query.")
              .setDescription(aiResponse)
              .setColor("#FFFFFF");
            channel.send({ embeds: [embed] });
          } else {
            channel.send("**This ticket closes after 5 minutes of inactivity**")
            channel.send("Hello I am Funding Pips AI assistant, how may I help you! I typically respond in under 30 seconds")
          }
        }, 1500)

      })
      .catch((err) => {
        channel.send("**This ticket closes after 5 minutes of inactivity**")
        channel.send("Hello I am Funding Pips AI assistant, how may I help you! I typically respond in under 30 seconds")
        console.log(err)
      })
  }
});

client.rest.setToken(DISCORD_TOKEN);

async function main() {
  try {
    await client.login(DISCORD_TOKEN);
  } catch (err) {
    console.error(err);
    console.error("This was the error msg");
  }
}

main();