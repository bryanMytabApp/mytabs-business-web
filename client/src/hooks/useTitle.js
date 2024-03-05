import {useEffect} from "react";

// A custom hook that sets the document title
export function useTitle(pathname) {
  useEffect(() => {
    // Assuming your options array has paths and titles
    const defaultTitle = "My Application"; // Default title
    const pathSections = pathname.split("/").filter(Boolean);
    const pageTitle = pathSections[1]?.replace("-", " ") || ""; // Simple conversion, customize as needed
    document.title = pageTitle
      ? `${pageTitle.charAt(0).toUpperCase() + pageTitle.slice(1)} - ${defaultTitle}`
      : defaultTitle;
  }, [pathname]);
}
