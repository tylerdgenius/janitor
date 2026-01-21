const parseCsv = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const compilePatterns = (patternInput) => {
  if (!String(patternInput || "").trim()) {
    return [];
  }
  return parseCsv(patternInput).map((pattern) => new RegExp(pattern));
};

const matchesAny = (name, patterns) => patterns.some((pattern) => pattern.test(name));

const olderThanCutoff = (dateString, now, cutoffMs) =>
  now - new Date(dateString).getTime() > cutoffMs;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  parseCsv,
  compilePatterns,
  matchesAny,
  olderThanCutoff,
  sleep,
};
