document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

  // ---------- helpers ----------
  function flash(el, text, type = "success") {
    el.textContent = text;
    el.className = `status-msg ${type}`;
    el.hidden = false;
    clearTimeout(el._timer);
    if (type === "success") el._timer = setTimeout(() => { el.hidden = true; }, 5000);
  }

  async function uploadFile(file, prefix) {
    const ext = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "")
      || (file.type.split("/")[1] || "bin");
    const path = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabaseClient.storage
      .from("school-media")
      .upload(path, file, { contentType: file.type || undefined, cacheControl: "3600" });
    if (error) return { error };
    const { data } = supabaseClient.storage.from("school-media").getPublicUrl(path);
    return { url: data.publicUrl };
  }

  const fileNameFromUrl = (url) => decodeURIComponent(url.split("?")[0].split("/").pop());

  // ---------- AUTH ----------
  const loginForm = $("admin-login-form");
  const loginSection = $("admin-login-section");
  const dashboard = $("admin-dashboard");
  const errorMsg = $("admin-error-msg");

  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) showDashboard();
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = loginForm.querySelector("button");
    errorMsg.hidden = true;
    btn.textContent = "Checking...";
    btn.disabled = true;
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: $("admin-email").value,
      password: $("admin-password").value,
    });
    btn.textContent = "Sign In";
    btn.disabled = false;
    if (error) {
      errorMsg.textContent = error.message;
      errorMsg.hidden = false;
    } else {
      showDashboard();
    }
  });

  $("admin-logout-btn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    dashboard.hidden = true;
    loginSection.hidden = false;
  });

  async function showDashboard() {
    loginSection.hidden = true;
    dashboard.hidden = false;
    await Promise.all([loadSettings(), loadGallery(), loadNoticesAdmin()]);
  }

  // ---------- TABS ----------
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      $(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });

  // ---------- SETTINGS ----------
  async function loadSettings() {
    const { data } = await supabaseClient.from("site_settings").select("*").eq("id", 1).single();
    if (!data) return;
    $("setting-name").value = data.school_name || "";
    $("setting-pin").value = data.notice_pin || "";
    $("setting-primary").value = data.primary_color || "#1d5de0";
    $("setting-secondary").value = data.secondary_color || "#0b2a6f";
  }

  // Live preview while picking colors (hero is unaffected)
  ["setting-primary", "setting-secondary"].forEach((id) => {
    $(id).addEventListener("input", () => {
      window.applyThemeColors($("setting-primary").value, $("setting-secondary").value);
    });
  });

  $("settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    const status = $("settings-status");
    btn.disabled = true;
    btn.textContent = "Saving...";

    const updates = {
      school_name: $("setting-name").value.trim(),
      notice_pin: $("setting-pin").value.trim(),
      primary_color: $("setting-primary").value,
      secondary_color: $("setting-secondary").value,
    };

    const problems = [];
    const logo = $("setting-logo").files[0];
    if (logo) {
      const r = await uploadFile(logo, "logo");
      if (r.error) problems.push("Logo: " + r.error.message); else updates.logo_url = r.url;
    }
    const hero = $("setting-hero").files[0];
    if (hero) {
      const r = await uploadFile(hero, "hero");
      if (r.error) problems.push("Hero image: " + r.error.message); else updates.hero_image_url = r.url;
    }

    const { error } = await supabaseClient.from("site_settings").update(updates).eq("id", 1);
    if (error) problems.push("Settings: " + error.message);
    else window.cacheThemeColors(updates.primary_color, updates.secondary_color);

    if (problems.length) flash(status, problems.join(" | "), "error");
    else { flash(status, "Settings saved!"); $("setting-logo").value = ""; $("setting-hero").value = ""; }

    btn.disabled = false;
    btn.textContent = "Save Settings";
  });

  // ---------- POST NOTICE ----------
  $("notice-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector("button[type=submit]");
    const status = $("notice-status");
    btn.disabled = true;
    btn.textContent = "Publishing...";

    const { data, error } = await supabaseClient.from("notices")
      .insert([{ title: $("notice-title-input").value.trim(), message: $("notice-message-input").value.trim() }])
      .select();

    if (error) {
      flash(status, "Error: " + error.message, "error");
      btn.disabled = false;
      btn.textContent = "Publish Notice";
      return;
    }

    const noticeId = data[0].id;
    const failed = [];
    for (let i = 1; i <= 3; i++) {
      const file = $(`audio-file-${i}`).files[0];
      if (!file) continue;
      const lang = $(`audio-lang-${i}`).value;
      const r = await uploadFile(file, "audio");
      if (r.error) { failed.push(`${lang}: ${r.error.message}`); continue; }
      const { error: dbError } = await supabaseClient.from("notice_audio")
        .insert([{ notice_id: noticeId, language: lang, audio_url: r.url }]);
      if (dbError) failed.push(`${lang}: ${dbError.message}`);
    }

    if (failed.length) flash(status, "Notice posted, but some audio failed: " + failed.join(" | "), "error");
    else flash(status, "Notice published! The New badge is now on for visitors.");

    form.reset();
    btn.disabled = false;
    btn.textContent = "Publish Notice";
    loadNoticesAdmin();
  });

  // ---------- MANAGE NOTICES ----------
  async function loadNoticesAdmin() {
    const { data, error } = await supabaseClient.from("notices").select("*").order("created_at", { ascending: false });
    const box = $("admin-notice-list");
    if (error) { box.innerHTML = `<p>Could not load notices: ${escapeHtml(error.message)}</p>`; return; }
    if (!data || data.length === 0) { box.innerHTML = "<p>No notices posted yet.</p>"; return; }

    box.innerHTML = data.map((n) => `
      <div class="admin-notice-item">
        <div>
          <h3>${escapeHtml(n.title)}</h3>
          <p>Posted on ${new Date(n.created_at).toLocaleDateString()}</p>
        </div>
        <button type="button" class="delete-notice-btn" data-id="${n.id}">${icon("trash")} Delete</button>
      </div>
    `).join("");
  }

  $("admin-notice-list").addEventListener("click", async (e) => {
    const btn = e.target.closest(".delete-notice-btn");
    if (!btn) return;
    if (!confirm("Are you sure you want to delete this notice?")) return;
    const id = btn.dataset.id;

    const { data: audioFiles } = await supabaseClient.from("notice_audio").select("audio_url").eq("notice_id", id);
    if (audioFiles && audioFiles.length) {
      await supabaseClient.storage.from("school-media").remove(audioFiles.map((a) => fileNameFromUrl(a.audio_url)));
    }
    const { error } = await supabaseClient.from("notices").delete().eq("id", id);
    if (error) alert("Could not delete: " + error.message);
    loadNoticesAdmin();
  });

  // ---------- GALLERY ----------
  const galleryInput = $("gallery-file-input");
  const selectedBox = $("gallery-selected");
  let previewUrls = [];

  function clearPreview() {
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    previewUrls = [];
    selectedBox.innerHTML = "";
    $("gallery-count").textContent = "";
  }

  // Instant preview of the photos you picked, before uploading
  galleryInput.addEventListener("change", () => {
    clearPreview();
    const files = Array.from(galleryInput.files);
    selectedBox.innerHTML = files.map((f) => {
      const url = URL.createObjectURL(f);
      previewUrls.push(url);
      return `<div class="thumb"><img src="${url}" alt="Selected photo"></div>`;
    }).join("");
    if (files.length) $("gallery-count").textContent = `${files.length} photo${files.length > 1 ? "s" : ""} selected`;
  });

  $("gallery-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const files = Array.from(galleryInput.files);
    if (!files.length) return;

    const btn = $("gallery-upload-btn");
    const status = $("gallery-status");
    btn.disabled = true;

    let done = 0;
    const failed = [];
    for (const file of files) {
      btn.textContent = `Uploading ${done + 1} of ${files.length}...`;
      const r = await uploadFile(file, "gallery");
      if (r.error) { failed.push(`${file.name}: ${r.error.message}`); continue; }
      const { error } = await supabaseClient.from("gallery").insert([{ image_url: r.url }]);
      if (error) { failed.push(`${file.name}: ${error.message}`); continue; }
      done++;
    }

    if (failed.length) flash(status, `${done} uploaded, ${failed.length} failed. ${failed.join(" | ")}`, "error");
    else flash(status, `${done} photo${done > 1 ? "s" : ""} uploaded!`);

    e.target.reset();
    clearPreview();
    btn.disabled = false;
    btn.innerHTML = `${icon("upload")} Upload Photo(s)`;
    loadGallery();
  });

  async function loadGallery() {
    const box = $("gallery-list");
    const { data, error } = await supabaseClient.from("gallery").select("*").order("created_at", { ascending: false });
    if (error) { box.innerHTML = `<p>Could not load photos: ${escapeHtml(error.message)}</p>`; return; }
    if (!data || data.length === 0) { box.innerHTML = ""; return; }

    box.innerHTML = data.map((img) => `
      <div class="thumb">
        <img src="${escapeHtml(img.image_url)}" alt="Gallery photo" loading="lazy">
        <button type="button" class="thumb-del" data-id="${img.id}" data-url="${escapeHtml(img.image_url)}" aria-label="Delete photo">${icon("trash")}</button>
      </div>
    `).join("");
  }

  $("gallery-list").addEventListener("click", async (e) => {
    const btn = e.target.closest(".thumb-del");
    if (!btn) return;
    if (!confirm("Delete this photo?")) return;
    const { error } = await supabaseClient.from("gallery").delete().eq("id", btn.dataset.id);
    if (error) { alert("Could not delete: " + error.message); return; }
    await supabaseClient.storage.from("school-media").remove([fileNameFromUrl(btn.dataset.url)]);
    loadGallery();
  });
});
