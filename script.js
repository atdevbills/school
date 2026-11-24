/* script.js — shared by index.html, notice.html and admin.html. */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// 1. MOBILE MENU
const navToggle = document.getElementById("nav-toggle");
const mainNav = document.getElementById("main-nav");

if (navToggle && mainNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

// 2. THEME (colors on every page, name, logo, hero image)
async function applySiteTheme() {
  try {
    const { data, error } = await supabaseClient.from("site_settings").select("*").eq("id", 1).single();
    if (error || !data) return;

    // Safe check to prevent crashes if theme.js doesn't load
    if (typeof window.applyThemeColors === "function") {
      window.applyThemeColors(data.primary_color, data.secondary_color);
      window.cacheThemeColors(data.primary_color, data.secondary_color);
    }

    // School name
    if (data.school_name) {
      document.querySelectorAll(".brand-name, .footer-title").forEach((el) => {
        el.textContent = data.school_name + (el.dataset.suffix || "");
      });
    }

    // Logo
    if (data.logo_url) {
      document.querySelectorAll("#site-logo").forEach((img) => {
        img.style.display = "";
        img.src = data.logo_url;
      });
    }

    // Hero: shows the uploaded image as-is (no color tint)
    const hero = document.querySelector(".hero");
    if (hero && data.hero_image_url) {
      hero.style.backgroundImage = `url("${data.hero_image_url}")`;
      hero.classList.add("has-image");
    }
  } catch (err) {
    console.warn("Theme load failed, using defaults.", err);
  }
}

// 3. HOME GALLERY + LIGHTBOX
async function loadHomeGallery() {
  const grid = document.getElementById("gallery-grid");
  if (!grid) return;

  const { data, error } = await supabaseClient.from("gallery").select("*").order("created_at", { ascending: false });

  if (error) {
    console.error("Gallery load failed:", error.message);
    grid.innerHTML = '<p class="empty-state">Photos could not be loaded right now.</p>';
    return;
  }
  if (!data || data.length === 0) {
    grid.innerHTML = '<p class="empty-state">No photos yet. Check back soon.</p>';
    return;
  }

  grid.innerHTML = data.map((img) => `
    <button class="gallery-item" type="button" data-src="${escapeHtml(img.image_url)}" aria-label="View photo larger">
      <img src="${escapeHtml(img.image_url)}" alt="School photo" loading="lazy">
    </button>
  `).join("");
}

function setupLightbox() {
  const grid = document.getElementById("gallery-grid");
  const box = document.getElementById("lightbox");
  const boxImg = document.getElementById("lightbox-img");
  const closeBtn = document.getElementById("lightbox-close");
  if (!grid || !box) return;

  const close = () => { box.hidden = true; boxImg.src = ""; };

  grid.addEventListener("click", (e) => {
    const item = e.target.closest(".gallery-item");
    if (!item) return;
    boxImg.src = item.dataset.src;
    box.hidden = false;
  });
  closeBtn.addEventListener("click", close);
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
}

// 4. "NEW" BADGE ON THE NOTIFICATION ICON
async function updateNoticeBadge() {
  const badge = document.getElementById("notice-badge");
  if (!badge) return;
  try {
    const { data, error } = await supabaseClient
      .from("notices").select("created_at").order("created_at", { ascending: false }).limit(1);
    if (error || !data || data.length === 0) { badge.hidden = true; return; }

    const latest = new Date(data[0].created_at).getTime();
    const seen = Number(localStorage.getItem("noticeLastSeen") || 0);
    badge.hidden = latest <= seen;
  } catch (err) {
    console.warn("Badge check failed.", err);
  }
}

// 5. CONTACT FORM (Web3Forms)
// The Access Key lives in index.html (hidden field named "access_key").
function setupContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("contact-submit-btn");
    const ok = document.getElementById("contact-success");
    const fail = document.getElementById("contact-error");
    const defaultError = "Something went wrong. Please try again.";
    btn.textContent = "Sending...";
    btn.disabled = true;
    ok.hidden = true;
    fail.hidden = true;

    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      const result = await res.json();
      if (result.success) {
        ok.hidden = false;
        form.reset();
      } else {
        console.error("Web3Forms:", result);
        fail.textContent = result.message || defaultError;
        fail.hidden = false;
      }
    } catch (err) {
      console.error("Contact form failed:", err);
      fail.textContent = defaultError;
      fail.hidden = false;
    } finally {
      btn.textContent = "Send Message";
      btn.disabled = false;
    }
  });
}

// 6. RUN
document.addEventListener("DOMContentLoaded", () => {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  applySiteTheme();
  loadHomeGallery();
  setupLightbox();
  setupContactForm();

  updateNoticeBadge();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) updateNoticeBadge(); });
  setInterval(updateNoticeBadge, 60000);
});

// 7. PWA: register the service worker (needs HTTPS, which GitHub Pages provides)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Service worker not registered:", err));
  });
}
