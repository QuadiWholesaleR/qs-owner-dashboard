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
  configError: document.getElementById("config-error"),
  configErrorMessage: document.getElementById("config-error-message"),
  loginPanel: document.getElementById("login-panel"),
  loginForm: document.getElementById("login-form"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  loginMessage: document.getElementById("login-message"),
  signInButton: document.getElementById("sign-in-button"),
  forgotPasswordButton: document.getElementById("forgot-password-button"),
  signOutButton: document.getElementById("sign-out-button"),
  connectionStatus: document.getElementById("connection-status"),
  dashboardPanel: document.getElementById("dashboard-panel"),
  ownerSessionMessage: document.getElementById("owner-session-message"),
  leadCount: document.getElementById("lead-count"),
  buyerCount: document.getElementById("buyer-count"),
  marketCount: document.getElementById("market-count"),
  messageCount: document.getElementById("message-count"),
  recentLeadsBody: document.getElementById("recent-leads-body"),
  marketsBody: document.getElementById("markets-body")
};

function setStatus(text, state = "pending") {
  elements.connectionStatus.textContent = text;

  if (state === "connected") {
    elements.connectionStatus.style.borderColor = "#27785f";
    elements.connectionStatus.style.background = "#102a24";
    elements.connectionStatus.style.color = "#a6f3d3";
    return;
  }

  if (state === "error") {
    elements.connectionStatus.style.borderColor = "#8a3d3d";
    elements.connectionStatus.style.background = "#301a1a";
    elements.connectionStatus.style.color = "#ffb1b1";
    return;
  }

  elements.connectionStatus.style.borderColor = "";
  elements.connectionStatus.style.background = "";
  elements.connectionStatus.style.color = "";
}

function showOnly(section) {
  elements.configError.classList.add("hidden");
  elements.loginPanel.classList.add("hidden");
  elements.dashboardPanel.classList.add("hidden");

  if (section) {
    section.classList.remove("hidden");
  }
}

function escapeHtml(value) {
  return String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function yesNo(value) {
  return value ? "Yes" : "No";
}

function locationLabel(row) {
  return [row.city, row.county, row.state_code]
    .filter(Boolean)
    .join(", ") || "—";
}

function setTableMessage(body, columns, message) {
  body.innerHTML = `<tr><td colspan="${columns}">${escapeHtml(message)}</td></tr>`;
}

function showLogin() {
  setStatus("Sign in required");
  showOnly(elements.loginPanel);
  elements.signOutButton.classList.add("hidden");
  elements.loginMessage.textContent = "";
}

async function loadDashboard(user) {
  showOnly(elements.dashboardPanel);
  elements.signOutButton.classList.remove("hidden");
  setStatus("Authenticated owner", "connected");

  elements.ownerSessionMessage.textContent =
    `Protected read-only access confirmed for ${user.email || "owner account"}.`;

  const [
    leadCountResult,
    buyerCountResult,
    marketCountResult,
    messageCountResult,
    leadsResult,
    marketsResult
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase
      .from("buyers")
      .select("*", { count: "exact", head: true })
      .eq("active", true),
    supabase
      .from("markets")
      .select("*", { count: "exact", head: true })
      .eq("active", true),
    supabase
      .from("outbound_messages")
      .select("*", { count: "exact", head: true })
      .in("send_status", ["draft", "queued"]),
    supabase
      .from("leads")
      .select(
        "stage, asset_class, city, county, state_code, contract_signed, human_marketing_approval, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("markets")
      .select(
        "city, county, state_code, status, research_allowed, outreach_allowed, marketing_allowed, active"
      )
      .eq("active", true)
      .order("state_code", { ascending: true })
      .limit(20)
  ]);

  const countResults = [
    [leadCountResult, elements.leadCount],
    [buyerCountResult, elements.buyerCount],
    [marketCountResult, elements.marketCount],
    [messageCountResult, elements.messageCount]
  ];

  for (const [result, target] of countResults) {
    target.textContent = result.error ? "—" : String(result.count ?? 0);
  }

  if (leadsResult.error) {
    setTableMessage(elements.recentLeadsBody, 5, "Unable to load leads.");
    console.error("Leads query failed:", leadsResult.error.message);
  } else if (!leadsResult.data.length) {
    setTableMessage(elements.recentLeadsBody, 5, "No leads found.");
  } else {
    elements.recentLeadsBody.innerHTML = leadsResult.data
      .map(
        (lead) => `
          <tr>
            <td>${escapeHtml(lead.stage)}</td>
            <td>${escapeHtml(lead.asset_class)}</td>
            <td>${escapeHtml(locationLabel(lead))}</td>
            <td>${yesNo(lead.contract_signed)}</td>
            <td>${yesNo(lead.human_marketing_approval)}</td>
          </tr>
        `
      )
      .join("");
  }

  if (marketsResult.error) {
    setTableMessage(elements.marketsBody, 5, "Unable to load markets.");
    console.error("Markets query failed:", marketsResult.error.message);
  } else if (!marketsResult.data.length) {
    setTableMessage(elements.marketsBody, 5, "No active markets found.");
  } else {
    elements.marketsBody.innerHTML = marketsResult.data
      .map(
        (market) => `
          <tr>
            <td>${escapeHtml(locationLabel(market))}</td>
            <td>${escapeHtml(market.status)}</td>
            <td>${yesNo(market.research_allowed)}</td>
            <td>${yesNo(market.outreach_allowed)}</td>
            <td>${yesNo(market.marketing_allowed)}</td>
          </tr>
        `
      )
      .join("");
  }

  const errors = [
    leadCountResult.error,
    buyerCountResult.error,
    marketCountResult.error,
    messageCountResult.error,
    leadsResult.error,
    marketsResult.error
  ].filter(Boolean);

  if (errors.length) {
    elements.ownerSessionMessage.textContent =
      "Signed in, but one or more protected dashboard queries were denied or unavailable.";
  }
}

if (!hasConfig) {
  setStatus("Configuration required", "error");
  showOnly(elements.configError);
  elements.configErrorMessage.textContent =
    "The public dashboard configuration is missing or incomplete. Add only the Supabase Project URL and publishable key to config.js.";
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

  elements.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = elements.email.value.trim();
    const password = elements.password.value;

    if (!email || !password) {
      elements.loginMessage.textContent =
        "Enter both your email address and password.";
      return;
    }

    elements.loginMessage.textContent = "";
    elements.signInButton.disabled = true;
    elements.signInButton.textContent = "Signing in…";
    setStatus("Signing in");

    const timeout = new Promise((_, reject) => {
      window.setTimeout(() => {
        reject(new Error("Sign-in request timed out."));
      }, 15000);
    });

    try {
      const { data, error } = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        timeout
      ]);

      if (error) {
        console.error("Sign-in failed:", error);
        elements.loginMessage.textContent =
          "Sign-in failed. Check your email and password, then try again.";
        setStatus("Sign-in failed", "error");
        return;
      }

      if (!data?.user) {
        throw new Error("Sign-in completed but no authenticated user was returned.");
      }

      elements.password.value = "";
      await loadDashboard(data.user);
    } catch (error) {
      console.error("Sign-in request error:", error);
      elements.loginMessage.textContent =
        "Sign-in timed out after 15 seconds. Refresh the page, confirm config.js uses the base Project URL ending in .supabase.co, then try again.";
      setStatus("Sign-in unavailable", "error");
    } finally {
      elements.signInButton.disabled = false;
      elements.signInButton.textContent = "Sign in";
    }
  });

  elements.forgotPasswordButton.addEventListener("click", async () => {
    const email = elements.email.value.trim();

    if (!email) {
      elements.loginMessage.textContent =
        "Enter your email address first, then select Forgot password.";
      elements.email.focus();
      return;
    }

    elements.loginMessage.textContent = "";
    elements.forgotPasswordButton.disabled = true;
    elements.forgotPasswordButton.textContent = "Sending…";

    try {
      const recoveryUrl = new URL("recover.html", window.location.href).href;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: recoveryUrl
      });

      if (error) {
        console.error("Password reset request failed:", error);
        elements.loginMessage.textContent =
          "Unable to request a reset email. Verify the address and try again.";
        return;
      }

      elements.loginMessage.textContent =
        "If that account exists, a password-reset email has been sent.";
    } catch (error) {
      console.error("Password reset request error:", error);
      elements.loginMessage.textContent =
        "Unable to request a reset email right now. Refresh and try again.";
    } finally {
      elements.forgotPasswordButton.disabled = false;
      elements.forgotPasswordButton.textContent = "Forgot password?";
    }
  });

  elements.signOutButton.addEventListener("click", async () => {
    elements.signOutButton.disabled = true;
    elements.loginMessage.textContent = "";

    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });

      if (error) {
        console.error("Sign-out failed:", error);
        elements.loginMessage.textContent =
          "Could not complete sign-out. Clear this site's browser data, then try again.";
        setStatus("Sign-out failed", "error");
        return;
      }

      elements.email.value = "";
      elements.password.value = "";
      showLogin();
    } catch (error) {
      console.error("Sign-out request error:", error);
      elements.loginMessage.textContent =
        "Could not complete sign-out. Clear this site's browser data, then try again.";
      setStatus("Sign-out failed", "error");
    } finally {
      elements.signOutButton.disabled = false;
    }
  });

  showLogin();
}
