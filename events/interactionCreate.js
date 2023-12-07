import { Events } from "discord.js";
import axios from "axios";

const interactionCreateHandler = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isButton()) {
            console.log("Button interaction!");

          await interaction.deferReply({ ephemeral: true });

            const convoId = interaction.customId.split("-")[1];

            console.log("BUTTON CLICKED");
            console.log(convoId);

            const headers = {
                "Intercom-Version": "2.10",
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.INTERCOM_TOKEN}`,
            };

            const body = {
                ticket_type_id: process.env.INTERCOM_TICKET_TYPE_ID,
            };

            axios.post(`https://api.intercom.io/conversations/${convoId}/convert`, body, { headers: headers })
                .then(response => {
                    console.log("Conversion successful:", response.data);
                    const ticketId = response.data.id;
                    console.log(ticketId);

                    const ticketBody = { open: true };
                    return axios.put(`https://api.intercom.io/tickets/${ticketId}`, ticketBody, { headers: headers });
                })
              .then(response => {
                  console.log("Ticket updated:", response.data);
                  interaction.editReply({ content: '**Conversation successfully converted to a ticket!**' });
              })
              .catch(error => {
                  console.error("Error in conversion or ticket update:", error.response ? error.response.data : error.message);
                  interaction.editReply({ content: '**An error occurred while converting your ticket. Please go to our website and submit a ticket from there**' });
              });
        }
    },
};

export default interactionCreateHandler;
