async function getUserDetails() {
  try {
    const response = await fetch("/api-standard/user-details");
    return await response.json();
  } catch (err) {
    console.error(`Failed to get user's details`, err);
    return {};
  }
}

export { getUserDetails };
