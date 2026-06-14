export const simpleloginService = {
  async fetchAliases(authHeader) {
    const res = await fetch("/api/aliases", { headers: { Authorization: authHeader } });
    return await res.json();
  }
};
