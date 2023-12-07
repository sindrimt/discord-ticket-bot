import dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import {generateRandomUserID} from "../utils/utils.js"

//import { Events, MessageEmbed } from 'discord.js';

import pkg from "discord.js";
const { Events, EmbedBuilder, MessageActionRow, MessageButton, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageEmbed} = pkg;

import { interact } from "../utils/dialogapi.js";
import startConversationWithIntercom from "../utils/startConversationWithIntercom.js";
import websocketStore from "../utils/webSocketStore.js";
import { isTicketChannel } from "../utils/ticketUtils.js";

import WebSocket from "ws";

const channelTimers = {};
let channelConversationId = "";
const ticketSessions = {};


// Refactor repeated code into a function
const sendEmbedMessage = (channel, author, title, description, color, iconURL, url) => {
  const embed = new EmbedBuilder()
    .setAuthor({
      name: author,
      iconURL: iconURL || "https://s3-eu-west-1.amazonaws.com/tpd/logos/634a4940f5023fc9ea219434/0x0.png",
      url: url || "https://fundingpips.com/",
    })
    .setTitle(title)
    .setDescription(description)
    .setColor(color);
  channel.send({ embeds: [embed] });
};

function htmlToDiscord(text) {
  let discordFormattedText = text;

  // Handle image tags by extracting the src attribute
  discordFormattedText = discordFormattedText.replace(/<img[^>]+src="([^">]+)"/g, (match, src) => src);

  // Replace paragraph tags with line breaks
  discordFormattedText = discordFormattedText.replace(/<\/?p[^>]*>/g, '\n');

  // Replace strong/bold tags with **
  discordFormattedText = discordFormattedText.replace(/<\/?strong[^>]*>|<\/?b[^>]*>/g, '**');

  // Replace em/italic tags with *
  discordFormattedText = discordFormattedText.replace(/<\/?em[^>]*>|<\/?i[^>]*>/g, '*');

  // Replace underline tags with __ (Discord's syntax for underline)
  discordFormattedText = discordFormattedText.replace(/<\/?u[^>]*>/g, '__');

  // Replace strikethrough tags with ~~
  discordFormattedText = discordFormattedText.replace(/<\/?del[^>]*>|<\/?s[^>]*>|<\/?strike[^>]*>/g, '~~');

  // Remove any other remaining HTML tags
  discordFormattedText = discordFormattedText.replace(/<\/?[^>]+(>|$)/g, '');

  return discordFormattedText.trim();
}


const setChannelTimer = (channelId, guild, minutes) => {
  console.log("timer", minutes);
  // Clear existing timer if it exists
  if (channelTimers[channelId]) {
    clearTimeout(channelTimers[channelId]);
  }

  // Set a new timer
  channelTimers[channelId] = setTimeout(() => {
    const fetchedChannel = guild.channels.cache.get(channelId);
    if (fetchedChannel) {
      fetchedChannel.delete();
    }
    // Remove the timer from the global object
    delete ticketSessions[channelId]; 
    delete channelTimers[channelId];
  }, minutes * 60 * 1000 /* x minutes */);
};

const talkToHuman = (message, name, email) => {
  isTicketChannel(message.channel)
    .then(async (inTicket) => {
      if (inTicket) {
        const messages = await message.channel.messages.fetch();

        // Ping the server (Maybe not needed but eh)
        await axios.head("https://dev-live-agent-server.onrender.com/intercom");

        

        // Create a intercom conversation
        startConversationWithIntercom(message.author.id, messages, name, email)
          .then(({ userID, conversationID }) => {

            channelConversationId = conversationID;
            console.log(channelConversationId)

            
            console.log("starting websocket");

            // Create a websocket to the server with the conversation ID and userID gotten from the
            // initialization from the intercom conversation
            const ws = new WebSocket(`https://dev-live-agent-server.onrender.com/intercom/user/${userID}/conversation/${conversationID}/socket`);

            // Catch event when the websocket opens
            ws.on("open", async () => {
              console.log("WebSocket connection opened.");
              websocketStore.set(message.channel.id, ws);
              setChannelTimer(message.channel.id, message.guild, 90);
              sendEmbedMessage(message.channel, "Funding Pips Ticket support", "Your message is sent to one of our agents", "We will respond to you as quickly as possible", "#FFFFFF")
              /* const embed = new EmbedBuilder()
                .setAuthor({
                  name: "Funding Pips Ticket support",
                  iconURL: "https://s3-eu-west-1.amazonaws.com/tpd/logos/634a4940f5023fc9ea219434/0x0.png",
                  url: "https://fundingpips.com/",
                })
                .setTitle("Your message is sent to one of our agents")
                .setDescription("We will respond to you as quickly as possible")
                .setColor("#334AFA");
              message.channel.send({ embeds: [embed] }); */
            });

            // Catch the event when a message comes from intercom
            ws.on("message", async (data) => {
              const event = JSON.parse(data);

              if (event.type.startsWith("live_agent")) {
                if (!event.data.conversation) {
                  console.log("NOT A conversation");
                  console.log(event);
                  if (event?.data?.message) {
                    const formattedText = htmlToDiscord(event?.data?.message);

                    message.channel.send(formattedText);
                  }

                  if (event.data.attachments) {
                    event.data.attachments.map((attachment) => {
                      message.channel.send(attachment);
                    })
                  }
                } else {
                  console.log("A CONVERSATION!!!");
                  const attachmentUrls = event.data.conversation.conversation_parts.conversation_parts[0].attachments;

                  console.log("HERE=============");

                  if (attachmentUrls) {
                    attachmentUrls.map((url) => {
                      message.channel.send(url.url);
                    });
                  }
                }
              }
            });

            // Catch the close event and tell the user the connection in closed between the user and
            // the live agent
            ws.on("close", (code, reason) => {

              console.log("====CHANNEL ID======")
              console.log(channelConversationId)
              
              console.log(`WebSocket closed with code: ${code}, reason: ${reason}`);

              const embed = new EmbedBuilder()
                .setAuthor({
                  name: "Funding Pips Ticket support",
                  iconURL: "https://s3-eu-west-1.amazonaws.com/tpd/logos/634a4940f5023fc9ea219434/0x0.png",
                  url: "https://fundingpips.com/",
                })
                .setTitle("Intercom agent closed conversation")

                .setDescription("This ticket will be closed automatically after 30 seconds")
                .setColor("#FFFFFF");

              message.channel.send({ embeds: [embed] });
              websocketStore.delete(message.channel.id);

              const Button = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`createTicket-${channelConversationId}`).setLabel("Click to Convert Conversation into a Ticket").setStyle(ButtonStyle.Primary),

              );

              // const embed = new EmbedBuilder().setColor("#0099ff").setTitle("Convert to Ticket").setDescription("Here are your options:");
              message.channel.send({ components: [Button] });



              setTimeout(() => {
                const fetchedChannel = message.guild.channels.cache.get(message.channel.id);
                fetchedChannel.delete();
              }, 30000);
            });

            // Catch errors in the wesocket
            ws.on("error", (error) => {
              console.error("WebSocket error:", error);
              message.channel.send("An error occurred with the live chat connection. Please try again later.");
              ws.close(); // Optionally close the WebSocket if an error occurs
            });

            // Catch initial connection errors
            ws.onerror = (error) => {
              console.error("WebSocket initial connection error:", error);
            };
          })
          .catch((error) => {
            console.error("Error starting conversation with Intercom: ", error);
            message.channel.send("There was an error connecting to Intercom.");
            message.channel.send("We are so sorry for this inconvenience. Please go to our website to submit a ticket");
          });
      } else {
        const embed = new EmbedBuilder()
          .setTitle("Support")
          .setDescription("You can only start a conversation with Intercom within a ticket channel.")
          .setColor("#ff0000");
        message.channel.send({ embeds: [embed] });
      }
    })
    .catch((error) => {
      console.error("Error checking ticket channel: ", error);
      message.channel.send("There was an error processing your request.");
    });
};

const getVoiceflowMessageResponse = (messageWithoutMention, message, userId) => {
  
  return new Promise((resolve, reject) => {
    const requestBody = {
      action: {
        type: "text",
        payload: messageWithoutMention,
      },
      config: {
        tts: false,
        stripSSML: true,
        stopAll: true,
        excludeTypes: ["path", "debug", "flow", "block", "end"],
      },
    };
    // Create the new user
    axios
      .post(`https://general-runtime.voiceflow.com/state/user/${userId}/interact`, requestBody, {
        headers: {
          Authorization: process.env.VOICEFLOW_API_KEY,
          "Content-Type": "application/json",
        },
      })
      .then((res) => {
        /* console.log("res data:")
console.log(res.data); */

        /*  console.log("resolve:") */
        resolve(res.data);
      })
      .catch((err) => {
        console.log(err);
        reject(err);
      });
  });
};


const messageCreateHandler = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.content.includes("I am Funding Pips AI assistant")) {
      setChannelTimer(message.channel.id, message.guild, 5);
      console.log(message.channel.id);
    }

    if (message.content.includes("Thank you for submitting your")) {
      setChannelTimer(message.channel.id, message.guild, 1);

      const embed = new EmbedBuilder()
        .setAuthor({
          name: "Funding Pips Ticket support",
          iconURL: "https://s3-eu-west-1.amazonaws.com/tpd/logos/634a4940f5023fc9ea219434/0x0.png",
          url: "https://fundingpips.com/",
        })
        .setTitle("This ticket will automatically close in 1 minute")
        .setDescription("If you don't want it to close after 1 minute, type something here")
        .setColor("#334AFA");
      message.channel.send({ embeds: [embed] });
    }

    if (message.author.bot) return;

    const newob = JSON.stringify(message.member);
    const userRoles = JSON.parse(newob).roles;

    const moderatorRoles = ["99", "12233333"];

    // If the user who wrote the message has a mod role, we return
    // since the bot should not respond to a mod
    if (userRoles.some((item) => moderatorRoles.includes(item))) {
      return;
    }

    // If a WebSocket connection exists for this channel, forward the message
    if (websocketStore.has(message.channel.id)) {
      const ws = websocketStore.get(message.channel.id);
      // Send a JSON string with the message type and content

      let attachmentUrls = Array.from(message.attachments.values()).map((attachment) => attachment.url);

      console.log("Attachment URLS")
      console.log(attachmentUrls);

      if (attachmentUrls.length <= 5) {
        if (message.attachments) {
          console.log("Correct")
          ws.send(JSON.stringify({ type: "user.message", data: { message: message.content, attachmentUrls } }));
        } else {
          ws.send(JSON.stringify({ type: "user.message", data: { message: message.content } }));
        }
      } else {
        if (message.content) {
          message.channel.send("Cannot send over 5 attachments at a time");
          ws.send(JSON.stringify({ type: "user.message", data: { message: message.content } }));
        } else {
          message.channel.send("Cannot send over 5 attachments at a time");
        }
      }
    } else {
      // Only respond with ai answer if the question is asked in the specified channel, or if
      // the channel name starts with "ticket"
      if (message.channel.name.startsWith("ticket")) {

        if (!ticketSessions[message.channel.id]) {
          // If no unique ID exists, generate and store one
          const uniqueID = generateRandomUserID();
          console.log(uniqueID);
          ticketSessions[message.channel.id] = uniqueID;
        }

        const ticketUniqueID = ticketSessions[message.channel.id];
        console.log("Unique ID for this ticket:", ticketUniqueID);
        // If there is no WebSocket connection, process the message normally
        setChannelTimer(message.channel.id, message.guild, 5);

        console.log("User message:", message.content);

        let liveAnswer = message;
        liveAnswer.isLive = true;
        const messageWithoutMention = message.content.replace(/^<@\!?(\d+)>/, "").trim();

        console.log("=====");
        console.log("Check if user exists");

        console.log("user exists");

        axios
          .get(`https://general-runtime.voiceflow.com/state/user/${ticketUniqueID}`, {
            headers: {
              Authorization: process.env.VOICEFLOW_API_KEY,
              "Content-Type": "application/json",
            },
          })
          .then((res) => {

            if (Object.keys(res.data).length === 0) {

              const requestBody = {
                versionID: "production",
                action: {
                  type: "launch",
                },
              };

              // Create the new user
              axios
                .post(`https://general-runtime.voiceflow.com/state/user/${ticketUniqueID}/interact`, requestBody, {
                  headers: {
                    Authorization: process.env.VOICEFLOW_API_KEY,
                    "Content-Type": "application/json",
                  },
                })
                .then(() => {
                  getVoiceflowMessageResponse(messageWithoutMention, message, ticketUniqueID).then((res) => {

                    console.log(res)

                    //TODO COME BACK TO THIS. WHAT HAPPENDS IF THERE IS A NEW USER?? CAN THIS EVEN HAPPEN?
                    //TODO COME BACK TO THIS. WHAT HAPPENDS IF THERE IS A NEW USER?? CAN THIS EVEN HAPPEN?
                    //TODO COME BACK TO THIS. WHAT HAPPENDS IF THERE IS A NEW USER?? CAN THIS EVEN HAPPEN?
                    //TODO COME BACK TO THIS. WHAT HAPPENDS IF THERE IS A NEW USER?? CAN THIS EVEN HAPPEN?
                    //TODO COME BACK TO THIS. WHAT HAPPENDS IF THERE IS A NEW USER?? CAN THIS EVEN HAPPEN?
                    //TODO COME BACK TO THIS. WHAT HAPPENDS IF THERE IS A NEW USER?? CAN THIS EVEN HAPPEN?

                    if (res[1]?.type === "end") {
                      channel.message.send("I cant answer that");
                    }

                    if (res.some(item => item.type === "talk_to_agent")) {
                      console.log("====0000000======")
                      console.log(item.payload)

                      const userInfo = JSON.parse(item.payload);

                      talkToHuman(message, userInfo.name, userInfo.email);
                    }

                    res.map((item) => {
                      if (item?.payload?.message) {
                        message.channel.send(item.payload.message);
                      }

                      if (item?.payload?.visualType === "image") {
                        message.channel.send(item?.payload?.image)
                      }
                    });
                  });
                });

              //TODO Add launch
            } else {

              //TODO delete user data

              getVoiceflowMessageResponse(messageWithoutMention, message, ticketUniqueID).then((res) => {

                console.log(res)

                  //TODO ADD ERROR HANDLING WHEN USER WANTS LIVE AGENT. IF NO CONVOID FKS
                  //TODO ADD ERROR HANDLING WHEN USER WANTS LIVE AGENT. IF NO CONVOID FKS
                  //TODO ADD ERROR HANDLING WHEN USER WANTS LIVE AGENT. IF NO CONVOID FKS
                  //TODO ADD ERROR HANDLING WHEN USER WANTS LIVE AGENT. IF NO CONVOID FKS
                  //TODO ADD ERROR HANDLING WHEN USER WANTS LIVE AGENT. IF NO CONVOID FKS
                  //TODO ADD ERROR HANDLING WHEN USER WANTS LIVE AGENT. IF NO CONVOID FKS
                
                if (res[1]?.type === "end") {
                  channel.message.send("I can't answer that");
                }

                let talkToAgentItem = res.find(item => item.type === "talk_to_agent");

                if (talkToAgentItem) {
        
                  const userInfo = JSON.parse(talkToAgentItem.payload);
                  talkToHuman(message, userInfo.name, userInfo.email);
                }

                res.forEach((item) => {
                  if (item?.payload?.message) {
                    message.channel.send(item.payload.message);
                  }

                  if (item?.payload?.visualType === "image") {
                    message.channel.send(item?.payload?.image);
                  }
                });

              });
            }
          });
      }
    }
  },
};

export default messageCreateHandler;
