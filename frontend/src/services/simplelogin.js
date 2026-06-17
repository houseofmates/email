export const simpleloginService = {
  async getAliases(authHeader) {
    const res = await fetch("/api/aliases/v2/aliases", { headers: { Authorization: authHeader } });
    return await res.json();
  },
  async createAlias(data, authHeader) {
    const res = await fetch("/api/aliases/v2/aliases/custom/new", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": authHeader },
      body: JSON.stringify(data),
    });
    return await res.json();
  }
};
