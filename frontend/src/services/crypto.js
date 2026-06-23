export const generatePassword = (length = 16, options = { uppercase: true, numbers: true, symbols: true }) => {
  let charset = "abcdefghijklmnopqrstuvwxyz";
  if (options.uppercase) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (options.numbers) charset += "0123456789";
  if (options.symbols) charset += "!@#$%^&*()_+~|}{[]:;?><,./-=";
  let retVal = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
};
