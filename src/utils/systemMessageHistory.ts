import { DateTime } from "luxon";

export function parseSystemMessageDateTime(value: any) {
  if (!value) return null;

  if (typeof value === "number") {
    const dateTime = DateTime.fromMillis(value);
    return dateTime.isValid ? dateTime : null;
  }

  if (typeof value === "string") {
    const numericTime = Number(value);
    if (!Number.isNaN(numericTime)) {
      const dateTime = DateTime.fromMillis(numericTime);
      return dateTime.isValid ? dateTime : null;
    }

    const candidates = [
      DateTime.fromISO(value),
      DateTime.fromSQL(value),
      DateTime.fromFormat(value, "yyyy-MM-dd HH:mm:ss.SSS"),
      DateTime.fromJSDate(new Date(value))
    ];
    return candidates.find((candidate) => candidate.isValid) || null;
  }

  const numericTime = Number(value);
  if (!Number.isNaN(numericTime)) {
    const dateTime = DateTime.fromMillis(numericTime);
    return dateTime.isValid ? dateTime : null;
  }

  const candidates = [
    DateTime.fromISO(String(value)),
    DateTime.fromSQL(String(value)),
    DateTime.fromFormat(String(value), "yyyy-MM-dd HH:mm:ss.SSS"),
    DateTime.fromJSDate(new Date(value))
  ];
  return candidates.find((candidate) => candidate.isValid) || null;
}

export function getSystemMessageTime(systemMessage: any) {
  const value = systemMessage?.initDate;
  const dateTime = parseSystemMessageDateTime(value);
  return dateTime?.toMillis() || 0;
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

export function hasMoreForwardSystemMessagePages(systemMessages: any[], fetchedPageCount: number, totalCount: number, pageSize: number) {
  if (!systemMessages.length) return false;
  if (fetchedPageCount * pageSize < totalCount) return true;
  return systemMessages.length >= pageSize;
}
