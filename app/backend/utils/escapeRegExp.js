// Escapes regex metacharacters so user-supplied search text is matched
// literally when interpolated into a `new RegExp(...)`. Without this, admin
// search/filter inputs could alter match semantics or trigger catastrophic
// backtracking (ReDoS) that stalls the event loop.
module.exports = function escapeRegExp(input) {
  return String(input == null ? '' : input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
