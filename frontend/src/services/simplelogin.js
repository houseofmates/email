export const simpleloginService = {
  async listAliases(a) {
    const r = await fetch("/api/aliases/v2/aliases", { headers: { Authorization: a } });
    if (!r.ok) throw new Error("Load failed"); return await r.json();
  }
};
