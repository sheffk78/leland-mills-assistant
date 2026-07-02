/**
 * Vitest global setup.
 *
 * Imports jest-dom matchers so tests can use
 * `expect(element).toBeInTheDocument()`, `.toBeVisible()`, etc.
 * Also polyfills jsdom gaps (scrollIntoView, etc.)
 */
import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement scrollIntoView — polyfill it
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}