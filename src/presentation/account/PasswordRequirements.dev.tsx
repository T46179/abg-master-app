import { PASSWORD_REQUIREMENTS } from "../../core/passwordPolicy";
import { CheckIcon } from "./AccountIcons.dev";

export function PasswordRequirements({ password }: { password: string }) {
  return <div className="account-password-requirements">
    <strong>Password requirements:</strong>
    <ul>{PASSWORD_REQUIREMENTS.map(requirement => {
      const met = requirement.accepts(password);
      return <li key={requirement.label} data-met={met} aria-label={requirement.label + (met ? ": met" : ": not met")}><span aria-hidden="true"><CheckIcon size={11} /></span>{requirement.label}</li>;
    })}</ul>
  </div>;
}
