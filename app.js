import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.APP_CONFIG || {};

const elements = {
  loginPanel: document.getElementById("login-panel"),
  dashboardPanel: document.getElementById("dashboard-panel"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  signInButton: document.getElementById("sign-in-button"),
  signOutButton: document.getElementById("sign-out-button"),
  forgotPasswordButton: document.getElementById("forgot-password-button"),
  loginMessage: document.getElementById("login-message"),
  connectionStatus: document.getElementById("connection-status"),
  configError: document.getElementById("config-error"),
  configErrorMessage: document.getElementById("config-error-message"),
  ownerSessionMessage: document.getElementById("owner-session-message")
};

function setMessage(text) {
  elements.loginMessage.textContent = text;
  elements.connectionStatus.textContent = text;
}

function showLogin(message = "") {
  elements.dashboardPanel.classList.add("hidden");
  elements.loginPanel.classList.remove("hidden");
  elements.signOutButton.classList.add("hidden");
  setMessage(message || "Ready. Enter email and password, then tap Sign in.");
}

function showError(message) {
  elements.configError.classList.remove("hidden");
  elements.configErrorMessage.textContent = message;
  elements.loginPanel.classList.add("hidden");
  elements.dashboardPanel.classList.add("hidden");
  elements.signOutButton.classList.add("hidden");
  elements.connectionStatus.textContent = "Configuration error";
}

function showSignedIn(user) {
  elements.loginPanel.classList.add("hidden");
  elements.dashboardPanel.classList.remove("hidden");
  elements.signOutButton.classList.remove("hidden");
  elements.connectionStatus.textContent = "Authenticated owner";
  elements.ownerSessionMessage.textContent =
    `Authentication succeeded for ${user.email || "the owner account"}. Dashboard data loading is intentionally paused until this login test is confirmed.`;
}

const validConfig =
  typeof config.SUPABASE_URL === "string" &&
  config.SUPABASE_URL.startsWith("https://") &&
  config.SUPABASE_URL.endsWith(".supabase.co") &&
  typeof config.SUPABASE_PUBLISHABLE_KEY === "string" &&
  config.SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");

if (!validConfig) {
  showError(
    "Configuration is invalid. Confirm config.js has the base Project URL ending in .supabase.co and an sb_publishable_ key."
  );
} else {
  const supabase = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    }
  );

  elements.signInButton.addEventListener("click", async () => {
    const email = elements.email.value.trim();
    const password = elements.password.value;

    if (!email || !password) {
      setMessage("Enter both your email address and password.");
      return;
    }

    elements.signInButton.disabled = true;
    elements.signInButton.textContent = "Signing in…";
    setMessage("Step 1 of 3: Sending sign-in request…");

    const timeout = new Promise((_, reject) => {
      window.setTimeout(() => {
        reject(new Error("The request timed out after 15 seconds."));
      }, 15000);
    });

    try {
      const { data, error } = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        timeout
      ]);

      if (error) {
        setMessage(`Sign-in rejected: ${error.message}`);
        return;
      }

      if (!data?.user || !data?.session) {
        setMessage("Sign-in response did not include an active user session.");
        return;
      }

      elements.password.value = "";
      showSignedIn(data.user);
    } catch (error) {
      setMessage(`Sign-in request failed: ${error.message}`);
    } finally {
      elements.signInButton.disabled = false;
      elements.signInButton.textContent = "Sign in";
    }
  });

  elements.signOutButton.addEventListener("click", () => {
    elements.email.value = "";
    elements.password.value = "";
    showLogin("Signed out. Enter email and password, then tap Sign in.");
  });

  elements.forgotPasswordButton.addEventListener("click", () => {
    setMessage(
      "Password recovery is paused until the direct login test succeeds."
    );
  });

  showLogin();
}
