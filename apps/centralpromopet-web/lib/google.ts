export type GoogleCredential = { credential: string };
export type GoogleIdentityServices = {
  initialize: (options: {
    client_id: string; nonce: string; callback: (response: GoogleCredential) => void;
    auto_select: boolean; ux_mode: 'popup'; use_fedcm_for_button: boolean; button_auto_select: boolean;
  }) => void;
  renderButton: (element: HTMLElement, options: {
    type: 'standard'; theme: 'outline'; size: 'large'; text: 'continue_with'; shape: 'pill'; locale: string; width: string;
  }) => void;
  prompt: () => void;
  cancel: () => void;
  disableAutoSelect: () => void;
};
declare global { interface Window { google?: { accounts: { id: GoogleIdentityServices } } } }
export const oneTapSuppressedKey = 'centralpromopet:one-tap-suppressed';
