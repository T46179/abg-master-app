import { AccountButton } from "./AccountUi.dev";

export function GoogleButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return <div className="account-google-option">
    <AccountButton className="account-google-button" disabled={disabled} showArrow={false} onClick={onClick}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
        <path fill="#4285F4" d="M43.61 24.46c0-1.36-.12-2.66-.34-3.92H24v7.42h11.02a9.42 9.42 0 0 1-4.09 6.19v5.14h6.62c3.85-3.55 6.06-8.78 6.06-14.83Z"/>
        <path fill="#34A853" d="M24 44c5.51 0 10.13-1.82 13.55-4.92l-6.62-5.14c-1.83 1.23-4.18 1.96-6.93 1.96-5.32 0-9.83-3.6-11.45-8.44H5.72v5.3A20 20 0 0 0 24 44Z"/>
        <path fill="#FBBC05" d="M12.55 27.46a12 12 0 0 1 0-6.92v-5.3H5.72a20 20 0 0 0 0 17.52l6.83-5.3Z"/>
        <path fill="#EA4335" d="M24 12.1c3 0 5.68 1.03 7.79 3.05l5.85-5.85A19.3 19.3 0 0 0 24 4 20 20 0 0 0 5.72 15.24l6.83 5.3C14.17 15.7 18.68 12.1 24 12.1Z"/>
      </svg>
      Continue with Google
    </AccountButton>
    <div className="account-google-divider"><span>or</span></div>
  </div>;
}
