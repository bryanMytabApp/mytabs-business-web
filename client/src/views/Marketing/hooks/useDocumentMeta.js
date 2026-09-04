import { useEffect } from "react";

/**
 * Finds the existing `<meta name="description">` element, or creates and appends
 * one to `<head>` when it is absent.
 *
 * @returns {HTMLMetaElement|null} The description meta element, or null when the
 *   document/head is unavailable (e.g. non-browser environments).
 */
const getOrCreateDescriptionMeta = () => {
  if (typeof document === "undefined" || !document.head) return null;

  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    document.head.appendChild(meta);
  }
  return meta;
};

/**
 * Sets the document title and the `<meta name="description">` content for the
 * current page.
 *
 * On mount (and whenever `title` or `description` change) this hook updates
 * `document.title` and the description meta tag. If the meta tag does not exist
 * it is created and appended to `<head>`. Empty/undefined values are skipped so
 * a caller can update only one field.
 *
 * @param {{ title?: string, description?: string }} [meta={}] - The page title
 *   and meta description to apply.
 * @returns {void}
 */
const useDocumentMeta = ({ title, description } = {}) => {
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (typeof title === "string" && title.length > 0) {
      document.title = title;
    }

    if (typeof description === "string" && description.length > 0) {
      const meta = getOrCreateDescriptionMeta();
      if (meta) {
        meta.setAttribute("content", description);
      }
    }
  }, [title, description]);
};

export default useDocumentMeta;
export { getOrCreateDescriptionMeta };
