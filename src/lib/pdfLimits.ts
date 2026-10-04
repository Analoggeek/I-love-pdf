let maxFileMb = 100
let maxPdfPages = 500

export function setClientLimits(fileMb: number, pages: number) {
  if (Number.isFinite(fileMb)) maxFileMb = Math.max(1, Math.min(500, Math.floor(fileMb)))
  if (Number.isFinite(pages)) maxPdfPages = Math.max(1, Math.min(10_000, Math.floor(pages)))
}

export function getClientLimits() { return { maxFileMb, maxPdfPages } }
