import axios from "axios";

async function startConversationWithIntercom(userID, messages, name, email) {

  return new Promise((resolve, reject) => {
  const history = messages
  .map(({ author, content }) => ({
    author: author.username,
    text: content,
  }))
  .reverse();

  const dataPayload = {
    userID: userID,
    history: history,
    name: name,
    email: email
  };


  axios.post(`https://dev-live-agent-server.onrender.com/intercom/conversation`, dataPayload).then((res) => {

    //return res.data;
    resolve(res.data)
  }).catch((err) => {
    console.log(err);
    reject(err)
  });
    
  })
  
/* 
  try {
    // Make a POST request using Axios
    const response = await axios.post(
      "https://dev-live-agent-server.onrender.com/intercom/conversation",
      {
        userID: userID,
        history: history
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Axios wraps the response in a data property
    return response.data;
  } catch (error) {
    // Error handling with Axios should catch any error thrown on request failure
    throw new Error("Failed to start conversation with Intercom: " + error);
  } */
}

export default startConversationWithIntercom;
