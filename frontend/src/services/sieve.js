export const sieveService = {
  generateScript(rules) {
    return rules.map(rule => `if ${rule.condition} { ${rule.action} }`).join("\n");
  }
};
