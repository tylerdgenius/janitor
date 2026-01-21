const parseCsv = (value) => {
  console.log("[janitor] [utils.parseCsv] start");
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const compilePatterns = (patternInput) => {
  console.log("[janitor] [utils.compilePatterns] start");
  if (!String(patternInput || "").trim()) {
    return [];
  }
  return parseCsv(patternInput).map((pattern) => new RegExp(pattern));
};

const matchesAny = (name, patterns) => {
  console.log("[janitor] [utils.matchesAny] start");
  return patterns.some((pattern) => pattern.test(name));
};

const olderThanCutoff = (dateString, now, cutoffMs) => {
  console.log("[janitor] [utils.olderThanCutoff] start");
  return now - new Date(dateString).getTime() > cutoffMs;
};

const sleep = (ms) => {
  console.log("[janitor] [utils.sleep] start");
  return new Promise((resolve) => setTimeout(resolve, ms));
};

module.exports = {
  parseCsv,
  compilePatterns,
  matchesAny,
  olderThanCutoff,
  sleep,
};
