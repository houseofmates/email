export const vaultwardenService = {
  async fetchVault(masterPassword, authHeader) {
    const res = await fetch("/api/crypto/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": authHeader },
      body: JSON.stringify({ masterPassword }),
    });
    if (!res.ok) throw new Error("Decryption failed");
    return await res.json();
  },
  async getItems(authHeader) {
    const res = await fetch("/api/passwords/ciphers", { headers: { Authorization: authHeader } });
    return await res.json();
  }
};
