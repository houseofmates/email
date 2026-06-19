const h = (a) => ({ "Content-Type": "application/json", "Authorization": a });
export const vaultwardenService = {
  async fetchVault(p, a) {
    const r = await fetch("/api/crypto/decrypt", { method: "POST", headers: h(a), body: JSON.stringify({ masterPassword: p, cipher: { type: 'sync' } }) });
    if (!r.ok) throw new Error("Decryption failed"); return await r.json();
  },
  async getItems(a) {
    const r = await fetch("/api/passwords/ciphers", { headers: { Authorization: a } });
    if (!r.ok) throw new Error("Load failed"); return await r.json();
  }
};
