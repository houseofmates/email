export const sieveService = {
  generateScript(rules) {
    return rules.map(rule => `if ${rule.condition} { ${rule.action} }`).join("\n");
  },
  async saveScript(script, authHeader) {
    const res = await fetch("/api/mail/sieve", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": authHeader },
      body: JSON.stringify({ script }),
    });
    return await res.json();
  },
};
