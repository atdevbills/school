document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const loginSection = document.getElementById("login-section");
  const portalContent = document.getElementById("portal-content");
  const errorMsg = document.getElementById("error-msg");
  const logoutBtn = document.getElementById("logout-btn");
  const noticesList = document.querySelector(".notices-list");

  if (sessionStorage.getItem("boardUnlocked") === "true") showPortal();

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pin = document.getElementById("parent-pin").value.trim();
    const btn = loginForm.querySelector("button");
    btn.textContent = "Checking...";
    btn.disabled = true;
    errorMsg.hidden = true;

    try {
      const { data, error } = await supabaseClient.from("site_settings").select("notice_pin").eq("id", 1).single();
      if (error) throw error;

      if (data && data.notice_pin === pin) {
        sessionStorage.setItem("boardUnlocked", "true");
        showPortal();
      } else {
        errorMsg.textContent = "Invalid PIN. Please check with the school office.";
        errorMsg.hidden = false;
      }
    } catch (err) {
      errorMsg.textContent = "Could not check the PIN: " + err.message;
      errorMsg.hidden = false;
    }

    btn.textContent = "Unlock Board";
    btn.disabled = false;
  });

  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("boardUnlocked");
    portalContent.hidden = true;
    loginSection.hidden = false;
  });

  function showPortal() {
    loginSection.hidden = true;
    portalContent.hidden = false;
    loadNotices();
  }

  async function loadNotices() {
    noticesList.innerHTML = "<p>Loading notices...</p>";
    const { data, error } = await supabaseClient
      .from("notices").select("*, notice_audio(*)").order("created_at", { ascending: false });

    if (error) {
      noticesList.innerHTML = `<p>Could not load notices: ${escapeHtml(error.message)}</p>`;
      return;
    }
    if (!data || data.length === 0) {
      noticesList.innerHTML = "<p>No notices posted yet.</p>";
      return;
    }

    noticesList.innerHTML = data.map((notice) => {
      const audioHtml = (notice.notice_audio || []).map((a) => `
        <div class="audio-player-item">
          <span class="audio-lang">${escapeHtml(a.language)}</span>
          <audio controls preload="none" class="custom-audio" src="${escapeHtml(a.audio_url)}"></audio>
        </div>
      `).join("");

      return `
        <article class="notice-card">
          <div class="notice-meta">
            <span class="notice-title">${escapeHtml(notice.title)}</span>
            <span class="notice-date">${new Date(notice.created_at).toLocaleDateString()}</span>
          </div>
          <p class="notice-text">${escapeHtml(notice.message)}</p>
          <div class="audio-box-group">${audioHtml}</div>
        </article>
      `;
    }).join("");

    // The visitor has now seen the newest notice, so the "New" badge turns off
    localStorage.setItem("noticeLastSeen", String(new Date(data[0].created_at).getTime()));
  }
});
