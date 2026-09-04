import { renderHook } from "@testing-library/react";

import useDocumentMeta, { getOrCreateDescriptionMeta } from "./useDocumentMeta";

const getDescriptionMeta = () =>
  document.querySelector('meta[name="description"]');

const removeDescriptionMetas = () => {
  document
    .querySelectorAll('meta[name="description"]')
    .forEach((el) => el.remove());
};

describe("useDocumentMeta", () => {
  beforeEach(() => {
    document.title = "";
    removeDescriptionMetas();
  });

  it("sets document.title from the title prop on mount", () => {
    renderHook(() => useDocumentMeta({ title: "Tabs — Home" }));

    expect(document.title).toBe("Tabs — Home");
  });

  it("sets the meta description content from the description prop on mount", () => {
    renderHook(() =>
      useDocumentMeta({ description: "The all-in-one events platform." })
    );

    expect(getDescriptionMeta().getAttribute("content")).toBe(
      "The all-in-one events platform."
    );
  });

  it("creates and appends the meta description tag to <head> when absent", () => {
    expect(getDescriptionMeta()).toBeNull();

    renderHook(() => useDocumentMeta({ description: "Discover Tabs." }));

    const meta = getDescriptionMeta();
    expect(meta).not.toBeNull();
    expect(meta.parentElement).toBe(document.head);
    expect(meta.getAttribute("content")).toBe("Discover Tabs.");
  });

  it("reuses an existing meta description tag instead of creating a duplicate", () => {
    const existing = document.createElement("meta");
    existing.setAttribute("name", "description");
    existing.setAttribute("content", "Old description");
    document.head.appendChild(existing);

    renderHook(() => useDocumentMeta({ description: "New description" }));

    const metas = document.querySelectorAll('meta[name="description"]');
    expect(metas).toHaveLength(1);
    expect(metas[0]).toBe(existing);
    expect(existing.getAttribute("content")).toBe("New description");
  });

  it("updates title and description when props change on rerender", () => {
    const { rerender } = renderHook((props) => useDocumentMeta(props), {
      initialProps: { title: "First Title", description: "First description" },
    });

    expect(document.title).toBe("First Title");
    expect(getDescriptionMeta().getAttribute("content")).toBe(
      "First description"
    );

    rerender({ title: "Second Title", description: "Second description" });

    expect(document.title).toBe("Second Title");
    expect(getDescriptionMeta().getAttribute("content")).toBe(
      "Second description"
    );
  });

  it("skips an empty title but still applies the description", () => {
    document.title = "Preexisting Title";

    renderHook(() =>
      useDocumentMeta({ title: "", description: "Only description" })
    );

    expect(document.title).toBe("Preexisting Title");
    expect(getDescriptionMeta().getAttribute("content")).toBe(
      "Only description"
    );
  });

  it("skips an undefined description but still applies the title", () => {
    renderHook(() => useDocumentMeta({ title: "Only Title" }));

    expect(document.title).toBe("Only Title");
    expect(getDescriptionMeta()).toBeNull();
  });

  it("skips both fields when called with no arguments", () => {
    document.title = "Untouched";

    renderHook(() => useDocumentMeta());

    expect(document.title).toBe("Untouched");
    expect(getDescriptionMeta()).toBeNull();
  });

  it("does not clear an existing meta description when a later render omits it", () => {
    const { rerender } = renderHook((props) => useDocumentMeta(props), {
      initialProps: { description: "Initial description" },
    });

    expect(getDescriptionMeta().getAttribute("content")).toBe(
      "Initial description"
    );

    rerender({ title: "Title Only" });

    expect(document.title).toBe("Title Only");
    expect(getDescriptionMeta().getAttribute("content")).toBe(
      "Initial description"
    );
  });
});

describe("getOrCreateDescriptionMeta", () => {
  beforeEach(() => {
    removeDescriptionMetas();
  });

  it("creates and appends a meta description tag when none exists", () => {
    expect(getDescriptionMeta()).toBeNull();

    const meta = getOrCreateDescriptionMeta();

    expect(meta).not.toBeNull();
    expect(meta.getAttribute("name")).toBe("description");
    expect(meta.parentElement).toBe(document.head);
  });

  it("returns the existing meta description tag when present", () => {
    const existing = document.createElement("meta");
    existing.setAttribute("name", "description");
    document.head.appendChild(existing);

    const meta = getOrCreateDescriptionMeta();

    expect(meta).toBe(existing);
    expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(
      1
    );
  });
});
