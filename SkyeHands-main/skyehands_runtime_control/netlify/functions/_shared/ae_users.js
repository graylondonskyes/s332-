
async function updateUser(id, patch) { return { id, ...patch }; }
module.exports = { updateUser };
