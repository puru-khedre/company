import { toastController } from "@ionic/vue";
import { DateTime } from "luxon";

// TODO Use separate files for specific utilities

// TODO Remove it when HC APIs are fully REST compliant
const hasError = (response: any) => {
  return !!response.data._ERROR_MESSAGE_ || !!response.data._ERROR_MESSAGE_LIST_;
}
const getCurrentTime = (zone: string, format = 't ZZZZ') => {
  return DateTime.now().setZone(zone).toFormat(format)
}

const showToast = async (message: string) => {
  const toast = await toastController
    .create({
      message,
      duration: 3000,
      position: "top",
    })
  return toast.present();
}
const generateInternalId = (name: string) => {
  return name.trim().toUpperCase().split(' ').join('_');
}


const getDownloadFileContent = (data: any) => {
  const fileContent = data?.csvData ?? data?.fileData ?? data?.data ?? data;
  if (typeof fileContent === "string") return fileContent;
  if (fileContent === undefined || fileContent === null) return "";
  return JSON.stringify(fileContent, null, 2);
}

const downloadTextFile = (content: string, fileName: string) => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const formatDateTime = (value: any, format?: string) => {
  if (!value) return "";
  
  const dateTime = parseDateTimeValue(value);
  if (!dateTime || !dateTime.isValid) return "";

  return format ? dateTime.toFormat(format) : dateTime.toLocaleString(DateTime.DATETIME_MED);
}

const parseDateTimeValue = (value: string | number) => {
  if (!value) return null;

  if (typeof value === "number") {
    const dateTime = DateTime.fromMillis(value);
    return dateTime.isValid ? dateTime : null;
  }

  const candidates = [
    DateTime.fromFormat(value, "yyyy-MM-dd'T'HH:mm:ssZZ"),
    DateTime.fromFormat(value, "yyyy-MM-dd HH:mm:ss.SSS"),
    DateTime.fromSQL(value),
    DateTime.fromISO(value),
    DateTime.fromJSDate(new Date(value))
  ];

  return candidates.find((candidate) => candidate.isValid) || null;
}

export { generateInternalId, hasError, showToast ,getCurrentTime, getDownloadFileContent, downloadTextFile, formatDateTime, parseDateTimeValue}
