export function formatSupportTime(date) {
  if (!date) return "";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatSupportDate(date) {
  if (!date) return "";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";

  const now = new Date();
  const sameDay =
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate();

  if (sameDay) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const isYesterday =
    parsed.getFullYear() === yesterday.getFullYear() &&
    parsed.getMonth() === yesterday.getMonth() &&
    parsed.getDate() === yesterday.getDate();

  if (isYesterday) return "Yesterday";

  return parsed.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
  });
}
