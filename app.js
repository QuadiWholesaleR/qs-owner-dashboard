import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.APP_CONFIG || {};

const message = document.getElementById("login-message");
const button = document.getElementById("sign-in-button");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const status = document.getElementById("connection-status");

function report(text) {
  console.log(text);
  message.textContent = text;
  status.textContent = text;
}

const validConfig =
  typeof config.SUPABASE_URL === "string" &&
  config.SUPABASE_URL.startsWith("https://") &&
  config.SUPABASE_URL.endsWith(".supabase.co") &&
  typeof config.SUPABASE_PUBLISHABLE_KEY === "string" &&
  config.SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");

if (!validConfig) {
  report("Configuration error: check Project URL and publishable key format.");
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

  report("Ready. Enter email and password, then tap Sign in.");

  button.addEventListener("click", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      report("Both email and password are required.");
      return;
    }

    button.disabled = true;
    report("Step 1 of 3: Sending sign-in request…");

    const timeout = new Promise((_, reject) => {
      window.setTimeout(() => {
        reject(new Error("Timed out after 15 seconds"));
      }, 15000);
    });

    try {
      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        timeout
      ]);

      report("Step 2 of 3: Supabase Auth responded.");

      if (result.error) {
        report(`Sign-in rejected: ${result.error.message}`);
        return;
      }

      if (!result.data?.user || !result.data?.session) {
        report("Sign-in response did not include an active user session.");
        return;
      }

      report("Step 3 of 3: Sign-in succeeded. Auth user session received.");
    } catch (error) {
      report(`Sign-in request failed: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  });
}
