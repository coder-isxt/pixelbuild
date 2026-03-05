window.GTModules = window.GTModules || {};

window.GTModules.messages = {
  createController(options) {
    const o = options || {};
    let lastPrivateMessageFrom = null;

    function issuePrivateMessage(targetAccountId, messageText) {
      const network = typeof o.getNetwork === "function" ? o.getNetwork() : null;
      const db = network && network.db ? network.db : null;
      const firebaseRef = typeof o.getFirebase === "function" ? o.getFirebase() : null;
      const basePath = typeof o.getBasePath === "function" ? String(o.getBasePath() || "") : "";
      const playerProfileId = typeof o.getPlayerProfileId === "function" ? String(o.getPlayerProfileId() || "") : "";
      const playerName = typeof o.getPlayerName === "function" ? String(o.getPlayerName() || "") : "";
      if (!db || !targetAccountId || !basePath || !firebaseRef || !firebaseRef.database || !firebaseRef.database.ServerValue) {
        return Promise.resolve(false);
      }
      const text = (messageText || "").toString().trim().slice(0, 160);
      if (!text) return Promise.resolve(false);
      const payload = {
        id: "pm_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        fromAccountId: playerProfileId,
        fromUsername: playerName.slice(0, 20),
        text,
        createdAt: firebaseRef.database.ServerValue.TIMESTAMP
      };
      return db.ref(basePath + "/account-commands/" + targetAccountId + "/pm").push(payload)
        .then(() => true)
        .catch(() => false);
    }

    function handleIncomingPm(snapshot) {
      const value = snapshot && typeof snapshot.val === "function" ? (snapshot.val() || {}) : {};
      const text = (value.text || "").toString().trim().slice(0, 160);
      if (!text) return;
      const createdAt = Number(value.createdAt) || 0;
      const playerSessionStartedAt = typeof o.getPlayerSessionStartedAt === "function"
        ? Number(o.getPlayerSessionStartedAt()) || 0
        : 0;
      if (createdAt > 0 && playerSessionStartedAt > 0 && createdAt <= playerSessionStartedAt) return;
      const fromAccountId = (value.fromAccountId || "").toString();
      const fromUsername = (value.fromUsername || "").toString().slice(0, 20) || fromAccountId || "unknown";
      lastPrivateMessageFrom = {
        accountId: fromAccountId,
        username: fromUsername
      };
      if (typeof o.postLocalSystemChat === "function") {
        o.postLocalSystemChat("[MSG] @" + fromUsername + ": " + text);
      }
    }

    function handleCommand(command, parts) {
      const cmd = (command || "").toLowerCase();
      const list = Array.isArray(parts) ? parts : [];
      if (cmd === "/msg") {
        const targetRef = (list[1] || "").trim();
        const msg = list.slice(2).join(" ").trim();
        if (!targetRef || !msg) {
          if (typeof o.postLocalSystemChat === "function") o.postLocalSystemChat("Usage: /msg <player> <message>");
          return true;
        }
        const network = typeof o.getNetwork === "function" ? o.getNetwork() : null;
        if (!network || !network.enabled) {
          if (typeof o.postLocalSystemChat === "function") o.postLocalSystemChat("Private messages need online mode.");
          return true;
        }
        Promise.resolve()
          .then(() => (typeof o.resolveAccountIdByUsernameFast === "function" ? o.resolveAccountIdByUsernameFast(targetRef) : ""))
          .then((resolvedId) => resolvedId || (typeof o.findAccountIdByUserRef === "function" ? o.findAccountIdByUserRef(targetRef) : ""))
          .then((accountId) => {
            if (!accountId) {
              if (typeof o.postLocalSystemChat === "function") o.postLocalSystemChat("Target account not found: " + targetRef);
              return;
            }
            const playerProfileId = typeof o.getPlayerProfileId === "function" ? String(o.getPlayerProfileId() || "") : "";
            if (playerProfileId && accountId === playerProfileId) {
              if (typeof o.postLocalSystemChat === "function") o.postLocalSystemChat("You cannot private message yourself.");
              return;
            }
            return issuePrivateMessage(accountId, msg).then((ok) => {
              if (!ok) {
                if (typeof o.postLocalSystemChat === "function") o.postLocalSystemChat("Failed to send private message.");
                return;
              }
              if (typeof o.postLocalSystemChat === "function") o.postLocalSystemChat("[MSG to @" + targetRef + "] " + msg.slice(0, 160));
            });
          })
          .catch(() => {
            if (typeof o.postLocalSystemChat === "function") o.postLocalSystemChat("Failed to send private message.");
          });
        return true;
      }
      if (cmd === "/r") {
        const msg = list.slice(1).join(" ").trim();
        if (!msg) {
          if (typeof o.postLocalSystemChat === "function") o.postLocalSystemChat("Usage: /r <message>");
          return true;
        }
        const network = typeof o.getNetwork === "function" ? o.getNetwork() : null;
        if (!network || !network.enabled) {
          if (typeof o.postLocalSystemChat === "function") o.postLocalSystemChat("Private messages need online mode.");
          return true;
        }
        const lastFrom = lastPrivateMessageFrom;
        const accountId = lastFrom && lastFrom.accountId ? String(lastFrom.accountId) : "";
        const username = lastFrom && lastFrom.username ? String(lastFrom.username) : "user";
        if (!accountId) {
          if (typeof o.postLocalSystemChat === "function") o.postLocalSystemChat("No one has PMed you yet.");
          return true;
        }
        const playerProfileId = typeof o.getPlayerProfileId === "function" ? String(o.getPlayerProfileId() || "") : "";
        if (playerProfileId && accountId === playerProfileId) {
          if (typeof o.postLocalSystemChat === "function") o.postLocalSystemChat("Cannot reply to yourself.");
          return true;
        }
        issuePrivateMessage(accountId, msg).then((ok) => {
          if (!ok) {
            if (typeof o.postLocalSystemChat === "function") o.postLocalSystemChat("Failed to send private message.");
            return;
          }
          if (typeof o.postLocalSystemChat === "function") o.postLocalSystemChat("[REPLY to @" + username + "] " + msg.slice(0, 160));
        }).catch(() => {
          if (typeof o.postLocalSystemChat === "function") o.postLocalSystemChat("Failed to send private message.");
        });
        return true;
      }
      return false;
    }

    return {
      issuePrivateMessage,
      handleIncomingPm,
      handleCommand,
      getLastPrivateMessageFrom() {
        return lastPrivateMessageFrom;
      },
      resetSession() {
        lastPrivateMessageFrom = null;
      }
    };
  }
};
