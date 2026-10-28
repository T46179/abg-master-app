import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export function PublicBackLink() {
  return (
    <Link className="public-page-back" to="/dashboard">
      <ArrowLeft aria-hidden="true" />
      Back to ABG Master
    </Link>
  );
}
