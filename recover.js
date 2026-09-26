import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.APP_CONFIG || {};
const hasConfig =
  typeof config.SUPABASE_URL === "string" &&
  config.SUPABASE_URL.startsWith("https://") &&
  typeof config.SUPABASE_PUBLISHABLE_KEY === "string" &&
  config.SUPABASE_PUBLISHABLE_KEY.length > 20 &&
  !config.SUPABASE_URL.includes("PASTE_") &&
  !config.SUPABASE_PUBLISHABLE_KEY.includes("PASTE_");

const elements = {
  recoveryPanel: document.getElementById("recovery-panel"),
  recoveryForm: document.getElementById("recovery-form"),
  newPassword: document.getElementById("new-password"),
  confirmPassword: document.getElementById("confirm-password"),
  updateButton: document.getElementById("update-password-button"),
  recoveryMessage: document.getElementById("recovery-message"),
  recoveryError: document.getElementById("recovery-error"),
  recoveryErrorMessage: document.getElementById("recovery-error-message"),
  recoveryStatus: document.getElementById("recovery-status")
};

function setStatus(text, state = "pending") {
  elements.recoveryStatus.textContent = text;

  if (state === "connected") {
    elements.recoveryStatus.style.borderColor = "#27785f";
    elements.recoveryStatus.style.background = "#102a24";
    elements.recoveryStatus.style.color = "#a6f3d3";
    return;
  }

  if (state === "error") {
    elements.recoveryStatus.style.borderColor = "#8a3d3d";
    elements.recoveryStatus.style.background = "#301a1a";
    elements.recoveryStatus.style.color = "#ffb1b1";
    return;
  }

  elements.recoveryStatus.style.borderColor = "";
  elements.recoveryStatus.style.background = "";
  elements.recoveryStatus.style.color = "";
}

function showRecoveryError(message) {
  elements.recoveryPanel.classList.add("hidden");
  elements.recoveryError.classList.remove("hidden");
  elements.recoveryErrorMessage.textContent = message;
  setStatus("Recovery link unavailable", "error");
}

if (!hasConfig) {
  showRecoveryError(
    "The dashboard configuration is missing or incomplete. Return to sign in and contact the system owner."
  );
} else {
  const supabase = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  let recoveryReady = false;

  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      recoveryReady = true;
      elements.recoveryError.classList.add("hidden");
      elements.recoveryPanel.classList.remove("hidden");
      setStatus("Recovery verified", "connected");
    }
  });

  async function verifyRecoverySession() {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      window.setTimeout(() => {
        if (!recoveryReady) {
          showRecoveryError(
            "This recovery link is missing, expired, or already used. Request a new password-reset email."
          );
        }
      }, 1200);
    }
  }

  elements.recoveryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const newPassword = elements.newPassword.value;
    const confirmPassword = elements.confirmPassword.value;

    if (newPassword.length < 15) {
      elements.recoveryMessage.textContent =
        "Use a password of at least 15 characters.";
      return;
    }

    if (newPassword !== confirmPassword) {
      elements.recoveryMessage.textContent = "The passwords do not match.";
      return;
    }

    elements.recoveryMessage.textContent = "";
    elements.updateButton.disabled = true;
    elements.updateButton.textContent = "Updating…";

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    elements.updateButton.disabled = false;
    elements.updateButton.textContent = "Update password";

    if (error) {
      console.error("Password update failed:", error);
      elements.recoveryMessage.textContent =
        "The password could not be updated. Request a new recovery email and try again.";
      return;
    }

    elements.newPassword.value = "";
    elements.confirmPassword.value = "";
    elements.recoveryMessage.textContent =
      "Password updated. Return to sign in and use your new password.";

    await supabase.auth.signOut({ scope: "local" });
    setStatus("Password updated", "connected");

    window.setTimeout(() => {
      window.location.replace("./");
    }, 1800);
  });

  verifyRecoverySession();

  window.addEventListener("beforeunload", () => {
    subscription.unsubscribe();
  });
}
