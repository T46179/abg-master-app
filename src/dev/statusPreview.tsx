import { createRoot } from "react-dom/client";
import { AppRouteErrorView } from "../presentation/shared/StatusViews";

// Standalone development preview: no account, runtime or analytics initialization.
export function mountStatusPreview(container: HTMLElement) {
  createRoot(container).render(<AppRouteErrorView />);
}
