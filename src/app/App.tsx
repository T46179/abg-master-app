import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { normalizeDevHashRoute } from "../core/authoredCasePreview";

export function App() {
  if (typeof window !== "undefined") {
    normalizeDevHashRoute();
  }

  useEffect(() => {
    function handleHashChange() {
      if (normalizeDevHashRoute()) {
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  return <RouterProvider router={router} />;
}
