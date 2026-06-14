export const vaultwardenService = {
  async fetchVault(masterPassword, authHeader) {
    const res = await fetch("/api/crypto/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": authHeader },
      body: JSON.stringify({ masterPassword }),
    });
    return await res.json();
  }
};
