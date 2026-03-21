const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";

function randomSuffix(length = 6) {
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function toSlug(title: string) {
  return `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 36)}-${randomSuffix()}`;
}

