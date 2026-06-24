export const generatePassword = (length = 16, options = { uppercase: true, numbers: true, symbols: true }) => {
  let charset = "abcdefghijklmnopqrstuvwxyz";
  if (options.uppercase) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (options.numbers) charset += "0123456789";
  if (options.symbols) charset += "!@#$%^&*()_+~|}{[]:;?><,./-=";
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  let retVal = "";
  for (let i = 0; i < length; i++) {
    retVal += charset.charAt(array[i] % charset.length);
  }
  return retVal;
};
