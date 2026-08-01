/**
 * Path shim, not a second copy of the contracts.
 *
 * `orchestration/ratio.ts` and `orchestration/tokenize.ts` are byte-identical
 * vendored copies of the content-service originals, enforced by sha256 drift tests
 * in orchestration/pre-checks.spec.ts. Those files import `../drills/contracts`,
 * which resolves in content-service (src/vocabulary -> src/drills) but not from
 * src/drills/orchestration. Rewriting the import would break byte-identity — the one
 * property the drift test exists to protect — so the path is provided instead.
 * Track B2 resolved the same trade-off for template.ts by placing it at matching depth.
 *
 * This re-exports the single vendored contracts file. It redeclares nothing.
 */
export * from '../contracts';
