// What is not the documentation of the product as it is now: one rule for the coverage of the delivered objects
// (coverage-check.mjs, DOCS_COVERAGE) and for the final state of the documents (docs-final-check.mjs, DOCS_ARCHIVE).
// An archived document describes an earlier version; the audit and refactoring reports, the as-is, the open points of a
// guide, its list of SAP screenshots and the coverage exclusions are evidence or internal notes: there the comparison
// with the earlier version belongs, and naming an object there does not document it for the customer. The same for the
// records of the decisions (adr/, decisions/) and the research (research/, research*): they say what was and why.
export const HISTORY_DIRS = new Set(['archive', 'audit', 'refactor', 'adr', 'decisions', 'research'])
export const HISTORY_FILE = /^(as-is|open-points|capture-sap|coverage-exclusions|research)/i
// folders of tools and builds, never documentation
export const TOOL_DIRS = new Set(['node_modules', '.git', '.claude', 'graphify-out', '.store-materials'])

/** Whether a folder (its name) holds no documentation of the product as it is. */
export const notProductDir = name => HISTORY_DIRS.has(name) || TOOL_DIRS.has(name)
/** Whether a file (its name) is not documentation of the product as it is. */
export const notProductFile = name => HISTORY_FILE.test(name)
