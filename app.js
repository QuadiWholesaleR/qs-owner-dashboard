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

function showLogin(message = "") {
  setStatus("Sign in required");
  showOnly(elements.loginPanel);
  elements.signOutButton.classList.add("hidden");
  elements.loginMessage.textContent = message;
}

function showConfigError(message) {
  setStatus("Configuration error", "error");
  showOnly(elements.configError);
  elements.configErrorMessage.textContent = message;
}

const validConfig =
  typeof config.SUPABASE_URL === "string" &&
  config.SUPABASE_URL.startsWith("https://") &&
  config.SUPABASE_URL.endsWith(".supabase.co") &&
  typeof config.SUPABASE_PUBLISHABLE_KEY === "string" &&
  config.SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");

if (!validConfig) {
  showConfigError(
    "Configuration is invalid. Confirm config.js contains the base Project URL ending in .supabase.co and a publishable key beginning with sb_publishable_."
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

  async function loadDashboard() {
    showOnly(elements.dashboardPanel);
    elements.signOutButton.classList.remove("hidden");
    setStatus("Authenticated owner", "connected");
    elements.ownerSessionMessage.textContent =
      "Protected read-only access confirmed.";

    setTableMessage(elements.recentLeadsBody, 5, "Loading protected workflow data…");
    setTableMessage(elements.marketsBody, 5, "Loading protected market permissions…");

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
      console.error("Leads query failed:", leadsResult.error);
      setTableMessage(
        elements.recentLeadsBody,
        5,
        "Protected lead workflow data could not be loaded."
      );
    } else if (!leadsResult.data?.length) {
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
      console.error("Markets query failed:", marketsResult.error);
      setTableMessage(
        elements.marketsBody,
        5,
        "Protected market permissions could not be loaded."
      );
    } else if (!marketsResult.data?.length) {
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
        "Signed in, but one or more protected read-only queries were unavailable.";
    }
  }

  elements.signInButton.addEventListener("click", async () => {
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
        reject(new Error("The request timed out after 15 seconds."));
      }, 15000);
    });

    try {
      const { data, error } = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        timeout
      ]);

      if (error) {
        showLogin("Sign-in failed. Check your email and password, then try again.");
        return;
      }

      if (!data?.user || !data?.session) {
        throw new Error("Sign-in completed but no active session was returned.");
      }

      elements.password.value = "";
      await loadDashboard();
    } catch (error) {
      console.error("Sign-in request error:", error);
      showLogin(
        "Sign-in could not be completed. Refresh the page and try again."
      );
    } finally {
      elements.signInButton.disabled = false;
      elements.signInButton.textContent = "Sign in";
    }
  });

  elements.signOutButton.addEventListener("click", () => {
    elements.email.value = "";
    elements.password.value = "";
    showLogin("Signed out.");
  });

  elements.forgotPasswordButton.addEventListener("click", () => {
    elements.loginMessage.textContent =
      "Password recovery remains paused while the read-only dashboard test is completed.";
  });

  showLogin();
}
