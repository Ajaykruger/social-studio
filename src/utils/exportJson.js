export function buildDefaultFilename(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-");
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `crystal-ugc-pack-${stamp}-${time}.json`;
}

export function downloadPack(packObject, filename = buildDefaultFilename()) {
  const blob = new Blob([JSON.stringify(packObject, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
