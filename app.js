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
  complianceSourceCount: document.getElementById("compliance-source-count"),
  manualReviewSourceCount: document.getElementById("manual-review-source-count"),
  complianceReviewCount: document.getElementById("compliance-review-count"),
  recentLeadsBody: document.getElementById("recent-leads-body"),
  marketsBody: document.getElementById("markets-body"),
  systemActivityBody: document.getElementById("system-activity-body"),
  complianceSourcesBody: document.getElementById("compliance-sources-body"),
  complianceReviewsBody: document.getElementById("compliance-reviews-body")
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

function safeDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function safeDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function safeExternalLink(url, label) {
  if (typeof url !== "string") {
    return escapeHtml(label);
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return escapeHtml(label);
    }

    return `<a href="${escapeHtml(parsed.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  } catch {
    return escapeHtml(label);
  }
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
      "Loading protected read-only operational data…";

    setTableMessage(
      elements.recentLeadsBody,
      5,
      "Loading protected workflow data…"
    );
    setTableMessage(
      elements.marketsBody,
      7,
      "Loading protected market permissions…"
    );
    setTableMessage(
      elements.systemActivityBody,
      4,
      "Loading protected system activity…"
    );
    setTableMessage(
      elements.complianceSourcesBody,
      4,
      "Loading protected compliance sources…"
    );
    setTableMessage(
      elements.complianceReviewsBody,
      7,
      "Loading protected compliance reviews…"
    );

    const [
      leadCountResult,
      buyerCountResult,
      marketCountResult,
      messageCountResult,
      complianceSourceCountResult,
      manualReviewSourceCountResult,
      complianceReviewCountResult,
      leadsResult,
      marketsResult,
      activityResult,
      complianceSourcesResult,
      complianceReviewsResult
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
        .from("compliance_sources")
        .select("*", { count: "exact", head: true })
        .eq("active", true),
      supabase
        .from("compliance_sources")
        .select("*", { count: "exact", head: true })
        .eq("active", true)
        .eq("requires_manual_review", true),
      supabase
        .from("compliance_reviews")
        .select("*", { count: "exact", head: true }),
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
          "city, county, state_code, asset_class, status, research_allowed, outreach_allowed, contract_workflow_allowed, marketing_allowed, active"
        )
        .eq("active", true)
        .order("state_code", { ascending: true })
        .order("county", { ascending: true })
        .order("city", { ascending: true })
        .order("asset_class", { ascending: true })
        .limit(30),
      supabase
        .from("system_debugging_logs")
        .select("created_at, level, module_name, message")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("compliance_sources")
        .select(
          "state_code, source_name, source_url, last_checked_at, requires_manual_review"
        )
        .eq("active", true)
        .order("state_code", { ascending: true })
        .limit(25),
      supabase
        .from("compliance_reviews")
        .select(
          "reviewed_at, finding, action_taken, requires_professional_review, next_review_due, markets(state_code, county, city, asset_class), compliance_sources(source_name, source_url)"
        )
        .order("reviewed_at", { ascending: false })
        .limit(20)
    ]);

    const countResults = [
      [leadCountResult, elements.leadCount],
      [buyerCountResult, elements.buyerCount],
      [marketCountResult, elements.marketCount],
      [messageCountResult, elements.messageCount],
      [complianceSourceCountResult, elements.complianceSourceCount],
      [manualReviewSourceCountResult, elements.manualReviewSourceCount],
      [complianceReviewCountResult, elements.complianceReviewCount]
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
        7,
        "Protected market permissions could not be loaded."
      );
    } else if (!marketsResult.data?.length) {
      setTableMessage(elements.marketsBody, 7, "No active markets found.");
    } else {
      elements.marketsBody.innerHTML = marketsResult.data
        .map(
          (market) => `
            <tr>
              <td>${escapeHtml(locationLabel(market))}</td>
              <td>${escapeHtml(market.asset_class)}</td>
              <td>${escapeHtml(market.status)}</td>
              <td>${yesNo(market.research_allowed)}</td>
              <td>${yesNo(market.outreach_allowed)}</td>
              <td>${yesNo(market.contract_workflow_allowed)}</td>
              <td>${yesNo(market.marketing_allowed)}</td>
            </tr>
          `
        )
        .join("");
    }

    if (activityResult.error) {
      console.error("System activity query failed:", activityResult.error);
      setTableMessage(
        elements.systemActivityBody,
        4,
        "Protected system activity could not be loaded."
      );
    } else if (!activityResult.data?.length) {
      setTableMessage(
        elements.systemActivityBody,
        4,
        "No safe system activity is available yet."
      );
    } else {
      elements.systemActivityBody.innerHTML = activityResult.data
        .map(
          (activity) => `
            <tr>
              <td>${escapeHtml(safeDateTime(activity.created_at))}</td>
              <td>${escapeHtml(activity.level)}</td>
              <td>${escapeHtml(activity.module_name)}</td>
              <td>${escapeHtml(activity.message)}</td>
            </tr>
          `
        )
        .join("");
    }

    if (complianceSourcesResult.error) {
      console.error(
        "Compliance sources query failed:",
        complianceSourcesResult.error
      );
      setTableMessage(
        elements.complianceSourcesBody,
        4,
        "Protected compliance sources could not be loaded."
      );
    } else if (!complianceSourcesResult.data?.length) {
      setTableMessage(
        elements.complianceSourcesBody,
        4,
        "No active compliance sources found."
      );
    } else {
      elements.complianceSourcesBody.innerHTML = complianceSourcesResult.data
        .map(
          (source) => `
            <tr>
              <td>${escapeHtml(source.state_code)}</td>
              <td>${safeExternalLink(source.source_url, source.source_name)}</td>
              <td>${escapeHtml(safeDate(source.last_checked_at))}</td>
              <td>${yesNo(source.requires_manual_review)}</td>
            </tr>
          `
        )
        .join("");
    }

    if (complianceReviewsResult.error) {
      console.error(
        "Compliance reviews query failed:",
        complianceReviewsResult.error
      );
      setTableMessage(
        elements.complianceReviewsBody,
        7,
        "Protected compliance reviews could not be loaded."
      );
    } else if (!complianceReviewsResult.data?.length) {
      setTableMessage(
        elements.complianceReviewsBody,
        7,
        "No compliance reviews recorded yet."
      );
    } else {
      elements.complianceReviewsBody.innerHTML = complianceReviewsResult.data
        .map((review) => {
          const market = Array.isArray(review.markets)
            ? review.markets[0]
            : review.markets;
          const source = Array.isArray(review.compliance_sources)
            ? review.compliance_sources[0]
            : review.compliance_sources;

          return `
            <tr>
              <td>${escapeHtml(locationLabel(market || {}))} — ${escapeHtml(market?.asset_class)}</td>
              <td>${safeExternalLink(source?.source_url, source?.source_name || "—")}</td>
              <td>${escapeHtml(safeDate(review.reviewed_at))}</td>
              <td>${escapeHtml(review.finding)}</td>
              <td>${escapeHtml(review.action_taken)}</td>
              <td>${yesNo(review.requires_professional_review)}</td>
              <td>${escapeHtml(safeDate(review.next_review_due))}</td>
            </tr>
          `;
        })
        .join("");
    }

    const errors = [
      leadCountResult.error,
      buyerCountResult.error,
      marketCountResult.error,
      messageCountResult.error,
      complianceSourceCountResult.error,
      manualReviewSourceCountResult.error,
      complianceReviewCountResult.error,
      leadsResult.error,
      marketsResult.error,
      activityResult.error,
      complianceSourcesResult.error,
      complianceReviewsResult.error
    ].filter(Boolean);

    elements.ownerSessionMessage.textContent = errors.length
      ? "Authenticated owner session. One or more protected read-only sections were unavailable."
      : "Protected read-only operational data loaded.";
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
      "Password recovery remains paused while the read-only dashboard is being finalized.";
  });

  showLogin();
}
