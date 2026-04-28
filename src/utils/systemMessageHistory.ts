export function getSystemMessageTime(systemMessage: any) {
  const value = systemMessage?.initDate;
  if (!value) return 0;
  if (typeof value === "number") return value;

  const parsedTime = new Date(value).getTime();
  return Number.isNaN(parsedTime) ? 0 : parsedTime;
}

export function shouldReadSystemMessagePagesBackwards(systemMessages: any[], totalCount: number, pageSize: number) {
  if (totalCount <= pageSize) return false;
  if (systemMessages.length < 2) return false;

  return getSystemMessageTime(systemMessages[0]) <= getSystemMessageTime(systemMessages[systemMessages.length - 1]);
}

export function sortSystemMessagesNewestFirst(systemMessages: any[]) {
  return [...systemMessages].sort((firstMessage: any, secondMessage: any) => {
    return getSystemMessageTime(secondMessage) - getSystemMessageTime(firstMessage);
  });
}
