export const generateRandomUserID = () => {
  console.log("===========CREATED NEWD USER ID================")
  // Current timestamp for uniqueness
  const timestamp = Date.now().toString();

  // Generate a random string
  const randomString = Math.random().toString(36).substring(2, 15) 
      + Math.random().toString(36).substring(2, 15);

  // Combine them to get a long, unique user ID
  return timestamp + randomString;
}

