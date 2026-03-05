window.GTModules = window.GTModules || {};

window.GTModules.friends = (function createFriendsModule() {
  function createController(options) {
    const opts = options || {};
    let profileCtx = null;
    let friendsMap = {};
    let requestsMap = {};
    let bound = false;

    function get(k, fallback) {
      const fn = opts[k];
      if (typeof fn === "function") return fn();
      return fallback;
    }

    function esc(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function post(text) {
      if (typeof opts.postLocalSystemChat === "function") {
        opts.postLocalSystemChat(text);
      }
    }

    function me() {
      return String(get("getPlayerProfileId", "") || "");
    }

    function myName() {
      return String(get("getPlayerName", "player") || "player").slice(0, 20);
    }

    function db() {
      const n = get("getNetwork", null);
      return n && n.db ? n.db : null;
    }

    function base() {
      return String(get("getBasePath", "growtopia-test"));
    }

    function path(suffix) {
      return base() + "/" + String(suffix || "").replace(/^\/+/, "");
    }

    function normalizeFriends(raw) {
      const source = raw && typeof raw === "object" ? raw : {};
      const out = {};
      Object.keys(source).forEach((accountId) => {
        const row = source[accountId] || {};
        out[String(accountId)] = {
          accountId: String(accountId),
          username: String(row.username || row.name || accountId).slice(0, 20),
          createdAt: typeof row.createdAt === "number" ? row.createdAt : 0
        };
      });
      return out;
    }

    function normalizeRequests(raw) {
      const source = raw && typeof raw === "object" ? raw : {};
      const out = {};
      Object.keys(source).forEach((fromId) => {
        const row = source[fromId] || {};
        out[String(fromId)] = {
          fromAccountId: String(row.fromAccountId || fromId),
          fromName: String(row.fromName || fromId).slice(0, 20),
          createdAt: typeof row.createdAt === "number" ? row.createdAt : 0
        };
      });
      return out;
    }

    function getProfileEls() {
      return {
        modal: get("getProfileModalEl", null),
        title: get("getProfileTitleEl", null),
        body: get("getProfileBodyEl", null),
        actions: get("getProfileActionsEl", null),
        closeBtn: get("getProfileCloseBtnEl", null)
      };
    }

    function getFriendsEls() {
      return {
        modal: get("getFriendsModalEl", null),
        title: get("getFriendsTitleEl", null),
        body: get("getFriendsBodyEl", null),
        actions: get("getFriendsActionsEl", null),
        closeBtn: get("getFriendsCloseBtnEl", null)
      };
    }

    function isFriend(accountId) {
      const id = String(accountId || "");
      return Boolean(id && friendsMap[id]);
    }

    function getPresence(accountId) {
      if (typeof opts.getPresenceByAccountId !== "function") return null;
      return opts.getPresenceByAccountId(String(accountId || ""));
    }

    function closeProfile() {
      profileCtx = null;
      const els = getProfileEls();
      if (els.modal) els.modal.classList.add("hidden");
    }

    function closeFriends() {
      const els = getFriendsEls();
      if (els.modal) els.modal.classList.add("hidden");
    }

    function renderProfile() {
      const els = getProfileEls();
      if (!profileCtx || !els.modal || !els.title || !els.body || !els.actions) return;
      const accountId = String(profileCtx.accountId || "");
      const username = String(profileCtx.name || "Player").slice(0, 20);
      const presence = getPresence(accountId);
      const online = Boolean(presence && presence.online);
      const world = online ? String(presence.world || "unknown").slice(0, 24) : "offline";
      const friend = isFriend(accountId);
      const canRequest = !friend && accountId && accountId !== me();
      let progressionHtml = "";
      if (typeof opts.getProfileProgressionHtml === "function") {
        progressionHtml = String(opts.getProfileProgressionHtml({
          accountId,
          username,
          presence
        }) || "");
      }
      els.title.textContent = "@" + username;
      els.body.innerHTML =
        "<div class='vending-section'>" +
          "<div class='vending-stat-grid'>" +
            "<div class='vending-stat'><span>Status</span><strong>" + (online ? "Online" : "Offline") + "</strong></div>" +
            "<div class='vending-stat'><span>World</span><strong>" + esc(world) + "</strong></div>" +
            "<div class='vending-stat'><span>Friend</span><strong>" + (friend ? "Yes" : "No") + "</strong></div>" +
          "</div>" +
        "</div>" +
        progressionHtml +
        "<div class='vending-auto-stock-note'>Send friend requests, open friends menu, or start a trade.</div>";
      els.actions.innerHTML =
        "<button data-profile-act='friend' " + (canRequest ? "" : "disabled") + ">Add Friend</button>" +
        "<button data-profile-act='trade'>Trade</button>" +
        "<button data-profile-act='friends'>Friends</button>" +
        "<button data-profile-act='close'>Close</button>";
      els.modal.classList.remove("hidden");
    }

    function sortedFriends() {
      return Object.values(friendsMap).sort((a, b) => {
        const pa = getPresence(a.accountId);
        const pb = getPresence(b.accountId);
        const aOnline = Boolean(pa && pa.online);
        const bOnline = Boolean(pb && pb.online);
        if (aOnline !== bOnline) return aOnline ? -1 : 1;
        return (a.username || a.accountId).localeCompare(b.username || b.accountId);
      });
    }

    function sortedRequests() {
      return Object.values(requestsMap).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    }

    function renderFriends() {
      const els = getFriendsEls();
      if (!els.modal || !els.title || !els.body || !els.actions) return;
      const friends = sortedFriends();
      const requests = sortedRequests();
      const friendRows = friends.map((entry) => {
        const p = getPresence(entry.accountId);
        const online = Boolean(p && p.online);
        const world = online ? String(p.world || "").slice(0, 24) : "";
        return (
          "<div class='friends-row'>" +
            "<div class='friends-meta'>" +
              "<strong>@" + esc(entry.username || entry.accountId) + "</strong>" +
              "<div class='friends-sub'>@" + esc(entry.accountId) + (online ? (" | " + esc(world)) : " | offline") + "</div>" +
            "</div>" +
            "<div class='friends-actions'>" +
              "<button class='friends-action-btn' data-friends-act='warp' data-account-id='" + esc(entry.accountId) + "'" + (online ? "" : " disabled") + ">Warp</button>" +
              "<button class='friends-action-btn' data-friends-act='remove' data-account-id='" + esc(entry.accountId) + "'>Remove</button>" +
            "</div>" +
          "</div>"
        );
      }).join("");
      const requestRows = requests.map((req) => {
        return (
          "<div class='friends-row'>" +
            "<div class='friends-meta'>" +
              "<strong>@" + esc(req.fromName || req.fromAccountId) + "</strong>" +
              "<div class='friends-sub'>@" + esc(req.fromAccountId) + "</div>" +
            "</div>" +
            "<div class='friends-actions'>" +
              "<button class='friends-action-btn' data-friends-act='accept' data-account-id='" + esc(req.fromAccountId) + "'>Accept</button>" +
              "<button class='friends-action-btn' data-friends-act='decline' data-account-id='" + esc(req.fromAccountId) + "'>Decline</button>" +
            "</div>" +
          "</div>"
        );
      }).join("");
      els.title.textContent = "Friends";
      els.body.innerHTML =
        "<div class='vending-section'>" +
          "<div class='vending-section-title'>Friends</div>" +
          (friendRows || "<div class='vending-empty'>No friends yet.</div>") +
        "</div>" +
        "<div class='vending-section'>" +
          "<div class='vending-section-title'>Friend Requests</div>" +
          (requestRows || "<div class='vending-empty'>No incoming requests.</div>") +
        "</div>";
      els.actions.innerHTML = "<button data-friends-act='close'>Close</button>";
      els.modal.classList.remove("hidden");
    }

    function openProfile(playerData) {
      const accountId = String(playerData && playerData.accountId || "");
      if (!accountId) return false;
      profileCtx = {
        accountId,
        name: String(playerData && playerData.name || "Player").slice(0, 20)
      };
      renderProfile();
      return true;
    }

    function openProfileByAccount(accountId, fallbackName) {
      return openProfile({ accountId, name: fallbackName || "Player" });
    }

    function openFriends() {
      renderFriends();
    }

    function handleSendRequest() {
      if (!profileCtx) return;
      const targetId = String(profileCtx.accountId || "");
      if (!targetId || targetId === me()) return;
      if (isFriend(targetId)) {
        post("Already friends.");
        return;
      }
      if (!db() || !me()) return;
      const ref = db().ref(path("friend-requests/" + targetId + "/" + me()));
      const payload = {
        fromAccountId: me(),
        fromName: myName(),
        createdAt: Date.now()
      };
      ref.transaction((current) => current || payload).then((result) => {
        if (!result.committed) {
          post("Friend request already sent.");
          return;
        }
        post("Friend request sent to @" + (profileCtx.name || targetId) + ".");
      }).catch(() => {
        post("Failed to send friend request.");
      });
    }

    function acceptRequest(fromId) {
      const from = String(fromId || "");
      if (!from || !db() || !me()) return;
      const req = requestsMap[from] || { fromName: from };
      const updates = {};
      updates[path("friends/" + me() + "/" + from)] = {
        accountId: from,
        username: String(req.fromName || from).slice(0, 20),
        createdAt: Date.now()
      };
      updates[path("friends/" + from + "/" + me())] = {
        accountId: me(),
        username: myName(),
        createdAt: Date.now()
      };
      updates[path("friend-requests/" + me() + "/" + from)] = null;
      db().ref().update(updates).then(() => {
        post("Accepted friend request from @" + (req.fromName || from) + ".");
      }).catch(() => {
        post("Failed to accept friend request.");
      });
    }

    function declineRequest(fromId) {
      const from = String(fromId || "");
      if (!from || !db() || !me()) return;
      db().ref(path("friend-requests/" + me() + "/" + from)).remove().then(() => {
        post("Declined friend request.");
      }).catch(() => {
        post("Failed to decline friend request.");
      });
    }

    function removeFriend(accountId) {
      const other = String(accountId || "");
      if (!other || !db() || !me()) return;
      const updates = {};
      updates[path("friends/" + me() + "/" + other)] = null;
      updates[path("friends/" + other + "/" + me())] = null;
      db().ref().update(updates).then(() => {
        post("Removed friend.");
      }).catch(() => {
        post("Failed to remove friend.");
      });
    }

    function warpToFriend(accountId) {
      const other = String(accountId || "");
      if (!other) return;
      if (typeof opts.onWarpToFriend !== "function") return;
      const ok = opts.onWarpToFriend(other);
      if (!ok) {
        const f = friendsMap[other];
        post("Could not warp to @" + ((f && f.username) || other) + ".");
      }
    }

    function openTradeFromProfile() {
      if (!profileCtx || typeof opts.onOpenTrade !== "function") return;
      opts.onOpenTrade(profileCtx.accountId, profileCtx.name || "Player");
      closeProfile();
    }

    function handleProfileActions(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = String(target.dataset.profileAct || "");
      if (!action) return;
      if (action === "close") {
        closeProfile();
        return;
      }
      if (action === "friend") {
        handleSendRequest();
        return;
      }
      if (action === "trade") {
        openTradeFromProfile();
        return;
      }
      if (action === "friends") {
        openFriends();
      }
    }

    function handleFriendsActions(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = String(target.dataset.friendsAct || "");
      if (!action) return;
      const accountId = String(target.dataset.accountId || "");
      if (action === "close") {
        closeFriends();
        return;
      }
      if (action === "accept") {
        acceptRequest(accountId);
        return;
      }
      if (action === "decline") {
        declineRequest(accountId);
        return;
      }
      if (action === "remove") {
        removeFriend(accountId);
        return;
      }
      if (action === "warp") {
        warpToFriend(accountId);
      }
    }

    function bindUiEvents() {
      if (bound) return;
      bound = true;
      const profile = getProfileEls();
      const friends = getFriendsEls();
      const openBtn = get("getFriendsToggleBtnEl", null);
      if (openBtn) openBtn.addEventListener("click", openFriends);
      if (profile.closeBtn) profile.closeBtn.addEventListener("click", closeProfile);
      if (profile.modal) {
        profile.modal.addEventListener("click", (event) => {
          if (event.target === profile.modal) closeProfile();
        });
      }
      if (profile.actions) profile.actions.addEventListener("click", handleProfileActions);
      if (friends.closeBtn) friends.closeBtn.addEventListener("click", closeFriends);
      if (friends.modal) {
        friends.modal.addEventListener("click", (event) => {
          if (event.target === friends.modal) closeFriends();
        });
      }
      if (friends.actions) friends.actions.addEventListener("click", handleFriendsActions);
      if (friends.body) friends.body.addEventListener("click", handleFriendsActions);
    }

    function setFriendsData(raw) {
      friendsMap = normalizeFriends(raw);
      if (profileCtx) renderProfile();
      const els = getFriendsEls();
      if (els.modal && !els.modal.classList.contains("hidden")) renderFriends();
    }

    function setRequestsData(raw) {
      requestsMap = normalizeRequests(raw);
      const els = getFriendsEls();
      if (els.modal && !els.modal.classList.contains("hidden")) renderFriends();
    }

    function renderOpen() {
      const profile = getProfileEls();
      const friends = getFriendsEls();
      if (profile.modal && !profile.modal.classList.contains("hidden")) renderProfile();
      if (friends.modal && !friends.modal.classList.contains("hidden")) renderFriends();
    }

    function closeAll() {
      closeProfile();
      closeFriends();
    }

    return {
      bindUiEvents,
      openProfile,
      openProfileByAccount,
      openFriends,
      closeProfile,
      closeFriends,
      closeAll,
      setFriendsData,
      setRequestsData,
      renderOpen
    };
  }

  return { createController };
})();
