import { removeUserByEmail } from "./queries/users.js";

const testRemoveUserByEmail = async () => {
  try {
    const email = "dwaynejones@pursuit.org"; // Replace this with the email of the user you want to delete
    const rowCount = await removeUserByEmail(email);
    if (rowCount > 0) {
      console.log(`User with email ${email} was successfully deleted.`);
    } else {
      console.log(`User with email ${email} not found.`);
    }
  } catch (error) {
    console.error("Failed to delete user:", error);
  }
};

// Call the test function
testRemoveUserByEmail();
