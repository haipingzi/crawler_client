export const getErrorStr = (errorMessage) => {
  const regex = /Error invoking remote method '[^']+': Error: (.+)/;
  const match = errorMessage.match(regex);

  if (match) {
    return match[1];
  }
  return errorMessage;
};
