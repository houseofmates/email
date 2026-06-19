export const sieveService = {
  generateScript(rules) {
    if (!rules || !Array.isArray(rules)) return "";
    return rules.map(r => `if ${r.field} :is "${r.value}" { ${r.action}; }`).join("\n");
  },

  async saveScript(script, authHeader) {
    const res = await fetch("/api/mail/sieve", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": authHeader },
      body: JSON.stringify({ script }),
    });
    if (!res.ok) throw new Error("Failed to save sieve script");
    return await res.json();
  }
};
