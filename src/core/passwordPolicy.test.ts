import { describe, expect, it } from "vitest";
import { passwordRequirementError } from "./passwordPolicy";
describe("account password requirements", () => {
  it.each([
    ["Aa1!", "Use at least 8 characters."],
    ["Password!", "Include at least 1 number."],
    ["password1!", "Include at least 1 uppercase letter."],
    ["PASSWORD1!", "Include at least 1 lowercase letter."],
    ["Password1", "Include at least 1 special character."],
    ["Password1 ", "Include at least 1 special character."]
  ])("rejects a password missing a requirement", (password, message) => {
    expect(passwordRequirementError(password)).toBe(message);
  });
  it.each(["Password1!", "Aa1!aaaa", "  Password1!  "])("accepts a password satisfying all requirements", password => {
    expect(passwordRequirementError(password)).toBeUndefined();
  });
});
