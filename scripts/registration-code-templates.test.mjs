import { describe, it, expect } from "vitest";
import { prepareCodeTemplates } from "./registration-code-templates.mjs";
const baseline = () => ({ mailer_otp_exp: 3600, mailer_otp_length: 6, mailer_templates_email_change_content: "<p>Original email change {{ .ConfirmationURL }}</p>", mailer_templates_magic_link_content: "<p>Original pilot code {{ .Token }}</p>", mailer_templates_recovery_content: "Leave reset unchanged" });
describe("scoped staging registration templates", () => {
  it("changes only the two template bodies and retains their exact previous fallback", () => {
    const config = baseline(); const patch = prepareCodeTemplates(config);
    expect(Object.keys(patch)).toEqual(["mailer_templates_email_change_content", "mailer_templates_magic_link_content"]);
    expect(patch.mailer_templates_email_change_content).toContain("{{ .Token }}");
    expect(patch.mailer_templates_email_change_content).toContain(config.mailer_templates_email_change_content);
    expect(patch.mailer_templates_magic_link_content).toContain(config.mailer_templates_magic_link_content);
    expect(patch.mailer_templates_magic_link_content).toContain("account_action=complete");
    expect(patch.mailer_templates_email_change_content).toContain("account_action=verify");
    expect(patch.mailer_templates_email_change_content).not.toContain("account_action=complete");
  });
  it("does not wrap an already-installed template twice", () => {
    const first = prepareCodeTemplates(baseline());
    expect(prepareCodeTemplates({ ...baseline(), ...first })).toEqual(first);
  });
  it("requires expiry and code length to match the interface", () => {
    expect(() => prepareCodeTemplates({ ...baseline(), mailer_otp_exp: 600 })).toThrow("1-hour");
    expect(() => prepareCodeTemplates({ ...baseline(), mailer_otp_length: 12 })).toThrow("code length");
  });
  it("does not produce a patch if a current template is missing", () => {
    expect(() => prepareCodeTemplates({ ...baseline(), mailer_templates_magic_link_content: null })).toThrow("could not be read");
  });
});
