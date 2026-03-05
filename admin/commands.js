window.GTModules = window.GTModules || {};

window.GTModules.commands = {
  handleChatCommand(ctx, rawText) {
    const c = ctx || {};
    const text = String(rawText || "").trim();
    if (!text || (!text.startsWith("/") && !text.startsWith("!"))) return false;
    const normalizedText = text.startsWith("!") ? ("/" + text.slice(1)) : text;
    const parts = normalizedText.split(/\s+/);
    const command = (parts[0] || "").toLowerCase();
    if (command === "/warp") {
      const worldId = c.normalizeWorldId(parts[1] || "");
      if (!worldId) {
        c.postLocalSystemChat("Usage: /warp <world>");
        return true;
      }
      c.switchWorld(worldId, true);
      c.postLocalSystemChat("Warping to " + worldId + "...");
      return true;
    }
    if (command === "/dance") {
      c.setDanceUntilMs(Date.now() + c.DANCE_DURATION_MS);
      if (c.inWorld) c.syncPlayer(true);
      c.postLocalSystemChat("You started dancing.");
      return true;
    }
    if (command === "/msg") {
      if (typeof c.handlePrivateMessageCommand === "function") {
        return Boolean(c.handlePrivateMessageCommand(command, parts));
      }
      c.postLocalSystemChat("Private message module is unavailable.");
      return true;
    }
    if (command === "/r") {
      if (typeof c.handlePrivateMessageCommand === "function") {
        return Boolean(c.handlePrivateMessageCommand(command, parts));
      }
      c.postLocalSystemChat("Private message module is unavailable.");
      return true;
    }
    if (command === "/verify") {
      if (!c.network.db) {
        c.postLocalSystemChat("Network unavailable.");
        return true;
      }
      if (!c.playerProfileId) {
        c.postLocalSystemChat("You must be logged in to verify.");
        return true;
      }
      if(c.discordUsername !== "")
        {
          c.postLocalSystemChat("You are already verified.");
          return true;
        }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      c.network.db.ref(c.BASE_PATH + "/verify-codes/" + c.playerName.toLowerCase()).set({
        code: code,
        accountId: c.playerProfileId,
        createdAt: c.firebase.database.ServerValue.TIMESTAMP
      }).then(() => {
        c.postLocalSystemChat("To finish verification go to Discord and type:");
        c.postLocalSystemChat("!verify " + c.playerName + " " + code);
      }).catch(() => {
        c.postLocalSystemChat("Failed to start verification.");
      });
      return true;
    }
    if (command === "/lock") {
      if (!c.inWorld) {
        c.postLocalSystemChat("Enter a world first.");
        return true;
      }
      if (c.isWorldLocked()) {
        if (c.isWorldLockOwner()) {
          c.postLocalSystemChat("You already own this world's lock.");
        } else {
          c.notifyWorldLockedDenied();
        }
        return true;
      }
      const target = c.getSpawnStructureTiles().base;
      const oldSelected = c.getSelectedSlot();
      const lockIds = Array.isArray(c.LOCK_BLOCK_IDS) && c.LOCK_BLOCK_IDS.length ? c.LOCK_BLOCK_IDS.slice() : [c.WORLD_LOCK_ID];
      const placeId = lockIds.find((id) => Math.max(0, Math.floor(Number(c.inventory[id]) || 0)) > 0) || 0;
      const idx = placeId ? c.slotOrder.indexOf(placeId) : -1;
      if (idx < 0 || !placeId) {
        c.postLocalSystemChat("You need a lock item.");
        return true;
      }
      c.setSelectedSlot(idx);
      c.tryPlace(target.tx, target.ty);
      c.setSelectedSlot(oldSelected);
      c.refreshToolbar();
      return true;
    }
    if (command === "/unlock") {
      if (!c.inWorld) {
        c.postLocalSystemChat("Enter a world first.");
        return true;
      }
      if (!c.isWorldLocked()) {
        c.postLocalSystemChat("World is not locked.");
        return true;
      }
      if (!c.isWorldLockOwner()) {
        c.notifyWorldLockedDenied();
        return true;
      }
      const lockTx = Number(c.currentWorldLock && c.currentWorldLock.tx);
      const lockTy = Number(c.currentWorldLock && c.currentWorldLock.ty);
      if (Number.isInteger(lockTx) && Number.isInteger(lockTy) && lockTx >= 0 && lockTy >= 0 && lockTx < c.WORLD_W && lockTy < c.WORLD_H) {
        c.tryBreak(lockTx, lockTy);
      } else {
        c.setCurrentWorldLock(null);
        if (c.network.enabled && c.network.lockRef) {
          c.network.lockRef.remove().catch(() => {});
        }
        c.postLocalSystemChat("World unlocked.");
      }
      return true;
    }
    if (command === "/commands" || command === "/adminhelp") {
      const role = c.normalizeAdminRole
        ? c.normalizeAdminRole(c.currentAdminRole)
        : String(c.currentAdminRole || "none").toLowerCase();
      const postList = (prefix, rows) => {
        const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
        if (!list.length) {
          c.postLocalSystemChat(prefix + " none");
          return;
        }
        const maxLen = 185;
        let line = prefix;
        for (let i = 0; i < list.length; i++) {
          const item = String(list[i] || "").trim();
          if (!item) continue;
          const token = (line === prefix ? "" : ", ") + item;
          if ((line + token).length > maxLen) {
            c.postLocalSystemChat(line);
            line = "... " + item;
          } else {
            line += token;
          }
        }
        if (line) c.postLocalSystemChat(line);
      };
      const publicCommands = [
        "/commands",
        "/myrole",
        "/online",
        "/warp <world>",
        "/dance",
        "/msg <user> <message>",
        "/r <message>",
        "/verify",
        "/lock",
        "/unlock"
      ];
      const roleCommands = [];
      const addRoleCommands = (...rows) => {
        rows.forEach((row) => {
          const cmdText = String(row || "").trim();
          if (!cmdText) return;
          if (!roleCommands.includes(cmdText)) roleCommands.push(cmdText);
        });
      };
      if (c.canUseAdminPanel) addRoleCommands("/role <user>");
      if (c.hasAdminPermission("tp")) addRoleCommands("/where <user>", "/goto <user>", "/tp <user>");
      if (c.hasAdminPermission("bring")) addRoleCommands("/bringall", "/bring <user>", "/summon <user>");
      if (c.hasAdminPermission("announce")) addRoleCommands("/announce <message>");
      if (c.hasAdminPermission("announce_user")) addRoleCommands("/announcep <user> <message>", "/announceuser <user> <message>");
      if (c.hasAdminPermission("tempban")) addRoleCommands("/tempban <user> <60m|12h|7d> [reason]", "/ban <user> [reason]");
      if (c.hasAdminPermission("permban")) addRoleCommands("/permban <user> [reason]");
      if (c.hasAdminPermission("unban")) addRoleCommands("/unban <user>");
      if (c.hasAdminPermission("kick")) addRoleCommands("/kick <user>");
      if (c.hasAdminPermission("freeze")) addRoleCommands("/freeze <user>");
      if (c.hasAdminPermission("unfreeze")) addRoleCommands("/unfreeze <user>");
      if (c.hasAdminPermission("godmode")) addRoleCommands("/godmode [user] <on|off>", "/god [user] <on|off>");
      if (c.hasAdminPermission("clearworld")) addRoleCommands("/clearworld", "/wipeworld");
      if (c.hasAdminPermission("resetinv")) addRoleCommands("/resetinv <user>");
      if (c.hasAdminPermission("reach")) addRoleCommands("/reach <user> <amount>");
      if (c.hasAdminPermission("give_block")) addRoleCommands("/givex <user> <block_key|block_id> <amount>", "/givefarmable <user> <farmable_key> <amount>");
      if (c.hasAdminPermission("give_item")) addRoleCommands("/giveitem <user> <block_key|block_id|cosmetic_id> <amount>", "/spawnd <item> <quantity_per_drop> <tile_amount>");
      if (c.hasAdminPermission("give_title")) addRoleCommands("/givetitle <user> <title_id> <amount>");
      if (c.hasAdminPermission("remove_title")) addRoleCommands("/removetitle <user> <title_id> <amount>");
      if (c.hasAdminPermission("setrole") || c.hasAdminPermission("setrole_limited")) {
        addRoleCommands("/setrole <user> <none|moderator|admin|manager|owner>");
      }
      if (c.hasAdminPermission("clear_logs")) addRoleCommands("/clearaudit", "/clearlogs");
      if (role === "owner") {
        addRoleCommands(
          "/questworld [tx ty]",
          "/questworldoff",
          "/normalworld",
          "/questpath [list|set <path_id>|<path_id>]",
          "/questaddfetch <path_id|current> <block_key|block_id> <amount> <title>",
          "/questaddfetchcosmetic <path_id|current> <cosmetic_id> <amount> <title>"
        );
      }
      c.postLocalSystemChat("Role: " + role + " | Public: " + publicCommands.length + " | Role commands: " + roleCommands.length);
      postList("Public:", publicCommands);
      postList("Role:", roleCommands);
      return true;
    }
    if (command === "/myrole") {
      c.postLocalSystemChat("Your role: " + c.currentAdminRole);
      return true;
    }
    if (command === "/online") {
      const worldOnline = c.inWorld ? (c.remotePlayers.size + 1) : 0;
      c.postLocalSystemChat("Online now: " + c.totalOnlinePlayers + " total | " + worldOnline + " in " + (c.inWorld ? c.currentWorldId : "menu"));
      return true;
    }
    if (command === "/questworld" || command === "/questworldoff" || command === "/normalworld") {
      if (!c.inWorld) {
        c.postLocalSystemChat("Enter a world first.");
        return true;
      }
      const role = c.normalizeAdminRole ? c.normalizeAdminRole(c.currentAdminRole) : String(c.currentAdminRole || "").toLowerCase();
      if (role !== "owner") {
        c.postLocalSystemChat("Only owner role can use this command.");
        return true;
      }
      const sub = String(parts[1] || "").trim().toLowerCase();
      const shouldDisable = command === "/questworldoff" || command === "/normalworld" || sub === "off" || sub === "disable" || sub === "normal";
      if (shouldDisable) {
        if (typeof c.disableQuestWorldMode !== "function") {
          c.postLocalSystemChat("Quest world controller is unavailable.");
          return true;
        }
        const result = c.disableQuestWorldMode();
        if (!result || !result.ok) {
          c.postLocalSystemChat("Failed to disable quest world mode.");
          return true;
        }
        c.postLocalSystemChat("Quest world mode disabled. World is normal again.");
        c.logAdminAudit("Admin(chat) disabled quest world mode in " + c.currentWorldId + ".");
        c.pushAdminAuditEntry("questworld_off", "", "world=" + c.currentWorldId);
        return true;
      }

      if (typeof c.enableQuestWorldAtTile !== "function") {
        c.postLocalSystemChat("Quest world controller is unavailable.");
        return true;
      }
      let tx = 0;
      let ty = 0;
      if (typeof c.getPlayerCenterTile === "function") {
        const tile = c.getPlayerCenterTile() || {};
        tx = Math.max(0, Math.floor(Number(tile.tx) || 0));
        ty = Math.max(0, Math.floor(Number(tile.ty) || 0));
      }
      if (parts.length >= 3) {
        const parsedTx = Math.floor(Number(parts[1]));
        const parsedTy = Math.floor(Number(parts[2]));
        if (Number.isInteger(parsedTx) && Number.isInteger(parsedTy)) {
          tx = Math.max(0, parsedTx);
          ty = Math.max(0, parsedTy);
        }
      }
      const result = c.enableQuestWorldAtTile(tx, ty);
      if (!result || !result.ok) {
        c.postLocalSystemChat("Failed to enable quest world mode.");
        return true;
      }
      c.postLocalSystemChat("Quest world mode enabled. Quest block placed at " + result.tx + "," + result.ty + ".");
      c.postLocalSystemChat("Only owner role can edit this world while quest mode is active.");
      c.logAdminAudit("Admin(chat) enabled quest world mode in " + c.currentWorldId + " at " + result.tx + "," + result.ty + ".");
      c.pushAdminAuditEntry("questworld_on", "", "world=" + c.currentWorldId + " npc=" + result.tx + "," + result.ty);
      return true;
    }
    if (command === "/questpath") {
      if (!c.inWorld) {
        c.postLocalSystemChat("Enter a world first.");
        return true;
      }
      const role = c.normalizeAdminRole ? c.normalizeAdminRole(c.currentAdminRole) : String(c.currentAdminRole || "").toLowerCase();
      if (role !== "owner") {
        c.postLocalSystemChat("Only owner role can use this command.");
        return true;
      }
      if (typeof c.listQuestWorldPaths !== "function" || typeof c.setQuestWorldPath !== "function") {
        c.postLocalSystemChat("Quest world controller is unavailable.");
        return true;
      }
      const sub = String(parts[1] || "").trim().toLowerCase();
      if (!sub || sub === "list") {
        const current = typeof c.getCurrentQuestWorldPathId === "function"
          ? String(c.getCurrentQuestWorldPathId() || "")
          : "";
        const paths = c.listQuestWorldPaths();
        const rows = Array.isArray(paths)
          ? paths.map((row) => {
              const id = row && row.id ? String(row.id) : "";
              const count = Math.max(0, Math.floor(Number(row && row.questsCount) || 0));
              if (!id) return "";
              return id + "(" + count + ")";
            }).filter(Boolean)
          : [];
        c.postLocalSystemChat("Current quest path: " + (current || "none"));
        c.postLocalSystemChat("Available paths: " + (rows.join(", ") || "none"));
        c.postLocalSystemChat("Usage: /questpath <path_id>  or  /questpath set <path_id>");
        return true;
      }
      const targetPath = String(sub === "set" ? (parts[2] || "") : (parts[1] || "")).trim();
      if (!targetPath) {
        c.postLocalSystemChat("Usage: /questpath <path_id>");
        return true;
      }
      const result = c.setQuestWorldPath(targetPath);
      if (!result || !result.ok) {
        if (result && result.reason === "quest_world_not_enabled") {
          c.postLocalSystemChat("Enable quest world first with /questworld.");
        } else {
          c.postLocalSystemChat("Failed to set quest path.");
        }
        return true;
      }
      c.postLocalSystemChat("Quest path for this world is now: " + result.pathId + ".");
      c.logAdminAudit("Admin(chat) set quest path in " + c.currentWorldId + " to " + result.pathId + ".");
      c.pushAdminAuditEntry("questpath_set", "", "world=" + c.currentWorldId + " path=" + result.pathId);
      return true;
    }
    if (command === "/questaddfetch" || command === "/addfetchquest") {
      if (!c.inWorld) {
        c.postLocalSystemChat("Enter a world first.");
        return true;
      }
      const role = c.normalizeAdminRole ? c.normalizeAdminRole(c.currentAdminRole) : String(c.currentAdminRole || "").toLowerCase();
      if (role !== "owner") {
        c.postLocalSystemChat("Only owner role can use this command.");
        return true;
      }
      if (typeof c.addQuestWorldFetchQuest !== "function") {
        c.postLocalSystemChat("Quest world controller is unavailable.");
        return true;
      }
      const pathId = String(parts[1] || "current").trim();
      const blockRef = String(parts[2] || "").trim();
      const amount = Number(parts[3]);
      const title = parts.slice(4).join(" ").trim();
      if (!blockRef || !Number.isFinite(amount) || amount <= 0) {
        c.postLocalSystemChat("Usage: /questaddfetch <path_id|current> <block_key|block_id> <amount> <title>");
        return true;
      }
      const result = c.addQuestWorldFetchQuest(pathId, blockRef, amount, title, "", "Reward placeholder");
      if (!result || !result.ok) {
        if (result && result.reason === "invalid_block") {
          c.postLocalSystemChat("Unknown block id/key: " + blockRef + ".");
        } else if (result && result.reason === "invalid_path") {
          c.postLocalSystemChat("Invalid quest path id.");
        } else {
          c.postLocalSystemChat("Failed to add fetch quest.");
        }
        return true;
      }
      const questTitle = result.quest && result.quest.title ? result.quest.title : ("Bring " + Math.floor(amount) + " " + blockRef);
      c.postLocalSystemChat("Added fetch quest to path " + result.pathId + ": " + questTitle + ".");
      c.logAdminAudit("Admin(chat) added fetch quest in path " + result.pathId + " (" + questTitle + ").");
      c.pushAdminAuditEntry("questpath_add_fetch", "", "path=" + result.pathId + " block=" + blockRef + " amount=" + Math.floor(amount));
      return true;
    }
    if (command === "/questaddfetchcosmetic" || command === "/addfetchcosmeticquest") {
      if (!c.inWorld) {
        c.postLocalSystemChat("Enter a world first.");
        return true;
      }
      const role = c.normalizeAdminRole ? c.normalizeAdminRole(c.currentAdminRole) : String(c.currentAdminRole || "").toLowerCase();
      if (role !== "owner") {
        c.postLocalSystemChat("Only owner role can use this command.");
        return true;
      }
      if (typeof c.addQuestWorldFetchCosmeticQuest !== "function") {
        c.postLocalSystemChat("Quest world controller is unavailable.");
        return true;
      }
      const pathId = String(parts[1] || "current").trim();
      const cosmeticId = String(parts[2] || "").trim();
      const amount = Number(parts[3]);
      const title = parts.slice(4).join(" ").trim();
      if (!cosmeticId || !Number.isFinite(amount) || amount <= 0) {
        c.postLocalSystemChat("Usage: /questaddfetchcosmetic <path_id|current> <cosmetic_id> <amount> <title>");
        return true;
      }
      const result = c.addQuestWorldFetchCosmeticQuest(pathId, cosmeticId, amount, title, "", "Reward placeholder");
      if (!result || !result.ok) {
        if (result && result.reason === "invalid_cosmetic") {
          c.postLocalSystemChat("Unknown cosmetic id: " + cosmeticId + ".");
        } else if (result && result.reason === "invalid_path") {
          c.postLocalSystemChat("Invalid quest path id.");
        } else {
          c.postLocalSystemChat("Failed to add cosmetic fetch quest.");
        }
        return true;
      }
      const questTitle = result.quest && result.quest.title ? result.quest.title : ("Bring " + Math.floor(amount) + " " + cosmeticId);
      c.postLocalSystemChat("Added cosmetic fetch quest to path " + result.pathId + ": " + questTitle + ".");
      c.logAdminAudit("Admin(chat) added cosmetic fetch quest in path " + result.pathId + " (" + questTitle + ").");
      c.pushAdminAuditEntry("questpath_add_fetch_cosmetic", "", "path=" + result.pathId + " cosmetic=" + cosmeticId + " amount=" + Math.floor(amount));
      return true;
    }
    if (!c.canUseAdminPanel) {
      c.postLocalSystemChat("You are not allowed to use admin commands.");
      return true;
    }
    if (command === "/where") {
      if (!c.hasAdminPermission("tp")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      const targetRef = parts[1] || "";
      if (!targetRef) {
        c.postLocalSystemChat("Usage: /where <user>");
        return true;
      }
      const accountId = c.findAccountIdByUserRef(targetRef);
      if (!accountId) {
        c.postLocalSystemChat("Target account not found: " + targetRef);
        return true;
      }
      const online = c.findOnlineGlobalPlayerByAccountId(accountId);
      if (!online || !online.world) {
        c.postLocalSystemChat("@" + targetRef + " is offline.");
        return true;
      }
      const tx = Math.max(0, Math.floor((Number(online.x) || 0) / c.TILE));
      const ty = Math.max(0, Math.floor((Number(online.y) || 0) / c.TILE));
      c.postLocalSystemChat("@" + targetRef + " is in " + online.world + " at " + tx + "," + ty + ".");
      return true;
    }
    if (command === "/goto") {
      if (!c.hasAdminPermission("tp")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      if (!c.ensureCommandReady("tp")) return true;
      const targetRef = parts[1] || "";
      const accountId = c.findAccountIdByUserRef(targetRef);
      if (!accountId) {
        c.postLocalSystemChat("Target account not found: " + targetRef);
        return true;
      }
      const online = c.findOnlineGlobalPlayerByAccountId(accountId);
      if (!online || !online.world) {
        c.postLocalSystemChat("Target is not online.");
        return true;
      }
      c.applySelfTeleport(online.world, Number(online.x) || 0, Number(online.y) || 0);
      c.postLocalSystemChat("Teleported to @" + targetRef + ".");
      c.pushAdminAuditEntry("tp", accountId, "toWorld=" + (online.world || ""));
      return true;
    }
    if (command === "/announce") {
      if (!c.hasAdminPermission("announce")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      if (parts.length >= 3 && c.hasAdminPermission("announce_user")) {
        const targetRef = parts[1] || "";
        const accountId = c.findAccountIdByUserRef(targetRef);
        const msgPrivate = parts.slice(2).join(" ").trim();
        if (accountId && msgPrivate) {
          if (!c.canActorAffectTarget(accountId, c.getAccountRole(accountId, c.adminState.accounts[accountId] && c.adminState.accounts[accountId].username))) {
            c.postLocalSystemChat("Permission denied on target role.");
            return true;
          }
          if (!c.ensureCommandReady("announcep")) return true;
          c.issuePrivateAnnouncement(accountId, msgPrivate).then((ok) => {
            if (!ok) {
              c.postLocalSystemChat("Failed to send private announcement.");
              return;
            }
            c.postLocalSystemChat("Private announcement sent to @" + targetRef + ".");
            c.logAdminAudit("Admin(chat) private announced to @" + targetRef + ".");
            c.pushAdminAuditEntry("announce_user", accountId, msgPrivate.slice(0, 80));
          });
          return true;
        }
      }
      const message = parts.slice(1).join(" ").trim();
      if (!message) {
        c.postLocalSystemChat("Usage: /announce <message>");
        return true;
      }
      const msg = message.slice(0, 140);
      const issueGlobalAnnouncement = typeof c.issueGlobalAnnouncement === "function"
        ? c.issueGlobalAnnouncement
        : ((text) => {
            const gatewayModule = window.GTModules && window.GTModules.cloudflareGateway;
            if (!gatewayModule || typeof gatewayModule.createController !== "function") {
              window.__gtLastAdminBackendError = "cloudflare gateway module missing";
              return Promise.resolve(false);
            }
            const ctrl = gatewayModule.createController({
              basePath: c.BASE_PATH || "growtopia-test",
              endpoint: window.CLOUDFLARE_PACKET_ENDPOINT || "",
              timeoutMs: 9000
            });
            const payload = {
              id: "an_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
              text: String(text || "").slice(0, 140),
              actorUsername: (c.playerName || "admin").toString().slice(0, 20),
              createdAt: Date.now()
            };
            return ctrl.writeSet("system/announcement", payload)
              .then((out) => {
                if (out && out.ok) {
                  window.__gtLastAdminBackendError = "";
                  return true;
                }
                const status = Number(out && out.status);
                const errorText = out && out.error ? String(out.error) : "";
                window.__gtLastAdminBackendError = errorText || (Number.isFinite(status) && status > 0 ? ("status " + status) : "unknown backend error");
                return false;
              })
              .catch((error) => {
                window.__gtLastAdminBackendError = String(error && error.message || "request failed");
                return false;
              });
          });
      issueGlobalAnnouncement(msg).then((ok) => {
        if (!ok) {
          const backendError = String(window.__gtLastAdminBackendError || "").trim();
          c.postLocalSystemChat("Failed to send announcement." + (backendError ? (" (" + backendError + ")") : ""));
          return;
        }
        c.sendSystemWorldMessage("[Admin] " + (c.playerName || "admin") + ": " + msg);
        c.postLocalSystemChat("Announcement sent.");
        c.pushAdminAuditEntry("announce", "", msg.slice(0, 80));
      }).catch(() => {
        const backendError = String(window.__gtLastAdminBackendError || "").trim();
        c.postLocalSystemChat("Failed to send announcement." + (backendError ? (" (" + backendError + ")") : ""));
      });
      return true;
    }
    if (command === "/announcep" || command === "/announceuser") {
      if (!c.hasAdminPermission("announce_user")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      if (!c.ensureCommandReady("announcep")) return true;
      const targetRef = parts[1] || "";
      const msg = parts.slice(2).join(" ").trim();
      if (!targetRef || !msg) {
        c.postLocalSystemChat("Usage: /announcep <user> <message>");
        return true;
      }
      const accountId = c.findAccountIdByUserRef(targetRef);
      if (!accountId) {
        c.postLocalSystemChat("Target account not found: " + targetRef);
        return true;
      }
      if (!c.canActorAffectTarget(accountId, c.getAccountRole(accountId, c.adminState.accounts[accountId] && c.adminState.accounts[accountId].username))) {
        c.postLocalSystemChat("Permission denied on target role.");
        return true;
      }
      c.issuePrivateAnnouncement(accountId, msg).then((ok) => {
        if (!ok) {
          c.postLocalSystemChat("Failed to send private announcement.");
          return;
        }
        c.postLocalSystemChat("Private announcement sent to @" + targetRef + ".");
        c.logAdminAudit("Admin(chat) private announced to @" + targetRef + ".");
        c.pushAdminAuditEntry("announce_user", accountId, msg.slice(0, 80));
      });
      return true;
    }
    if (command === "/clearaudit") {
      if (!c.hasAdminPermission("clear_logs")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      const clearAdminAuditTrail = typeof c.clearAdminAuditTrail === "function"
        ? c.clearAdminAuditTrail
        : (() => {
            const gatewayModule = window.GTModules && window.GTModules.cloudflareGateway;
            if (!gatewayModule || typeof gatewayModule.createController !== "function") {
              window.__gtLastAdminBackendError = "cloudflare gateway module missing";
              return Promise.resolve(false);
            }
            const ctrl = gatewayModule.createController({
              basePath: c.BASE_PATH || "growtopia-test",
              endpoint: window.CLOUDFLARE_PACKET_ENDPOINT || "",
              timeoutMs: 9000
            });
            return ctrl.writeRemove("admin-audit")
              .then((out) => {
                if (out && out.ok) {
                  window.__gtLastAdminBackendError = "";
                  return true;
                }
                const status = Number(out && out.status);
                const errorText = out && out.error ? String(out.error) : "";
                window.__gtLastAdminBackendError = errorText || (Number.isFinite(status) && status > 0 ? ("status " + status) : "unknown backend error");
                return false;
              })
              .catch((error) => {
                window.__gtLastAdminBackendError = String(error && error.message || "request failed");
                return false;
              });
          });
      clearAdminAuditTrail().then((ok) => {
        if (!ok) {
          const backendError = String(window.__gtLastAdminBackendError || "").trim();
          c.postLocalSystemChat("Failed to clear audit trail." + (backendError ? (" (" + backendError + ")") : ""));
          return;
        }
        c.adminState.audit = [];
        c.refreshAuditActionFilterOptions();
        c.renderAdminPanel();
        c.postLocalSystemChat("Audit trail cleared.");
        c.pushAdminAuditEntry("clear_audit", "", "");
      });
      return true;
    }
    if (command === "/clearlogs") {
      if (!c.hasAdminPermission("clear_logs")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      c.clearLogsData();
      return true;
    }
    if (command === "/bringall") {
      if (!c.hasAdminPermission("bring")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      if (!c.inWorld) {
        c.postLocalSystemChat("Enter a world first.");
        return true;
      }
      if (!c.ensureCommandReady("bring")) return true;
      const players = c.adminState.globalPlayers || {};
      const uniqueTargets = new Set();
      const allowedTargets = [];
      for (const p of Object.values(players)) {
        if (!p || p.world !== c.currentWorldId) continue;
        const accountId = (p.accountId || "").toString();
        if (!accountId || accountId === c.playerProfileId || uniqueTargets.has(accountId)) continue;
        const role = c.getAccountRole(accountId, c.adminState.accounts[accountId] && c.adminState.accounts[accountId].username);
        if (!c.canActorAffectTarget(accountId, role)) continue;
        uniqueTargets.add(accountId);
        allowedTargets.push(accountId);
      }
      if (!allowedTargets.length) {
        c.postLocalSystemChat("No summonable players found in this world.");
        return true;
      }
      Promise.all(allowedTargets.map((accountId) => {
        return c.issueTeleportCommand(accountId, c.currentWorldId, c.player.x + 24, c.player.y);
      })).then((results) => {
        const okCount = results.filter(Boolean).length;
        c.postLocalSystemChat("Summoned " + okCount + "/" + allowedTargets.length + " players.");
        c.logAdminAudit("Admin(chat) used bringall in " + c.currentWorldId + " (" + okCount + "/" + allowedTargets.length + ").");
        c.pushAdminAuditEntry("bringall", "", "world=" + c.currentWorldId + " ok=" + okCount + "/" + allowedTargets.length);
      }).catch(() => {
        c.postLocalSystemChat("Failed to summon all players.");
      });
      return true;
    }
    if (command === "/freeze" || command === "/unfreeze") {
      if (!c.hasAdminPermission(command === "/freeze" ? "freeze" : "unfreeze")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      const targetRef = parts[1] || "";
      if (!targetRef) {
        c.postLocalSystemChat("Usage: " + command + " <user>");
        return true;
      }
      const accountId = c.findAccountIdByUserRef(targetRef);
      if (!accountId) {
        c.postLocalSystemChat("Target account not found: " + targetRef);
        return true;
      }
      const ok = c.applyAdminAction(command === "/freeze" ? "freeze" : "unfreeze", accountId, "chat");
      if (ok) {
        c.postLocalSystemChat((command === "/freeze" ? "Froze @" : "Unfroze @") + targetRef + ".");
      }
      return true;
    }
    if (command === "/godmode" || command === "/god") {
      if (!c.hasAdminPermission("godmode")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      if (!c.ensureCommandReady("godmode")) return true;
      const truthy = new Set(["on", "1", "true", "enable", "enabled"]);
      const falsy = new Set(["off", "0", "false", "disable", "disabled"]);
      const targetRef = (parts[1] || "").trim();
      if (!targetRef) {
        const current = typeof c.isGodModeEnabled === "function" ? Boolean(c.isGodModeEnabled()) : false;
        const okSelf = c.applyAdminAction("godmode", c.playerProfileId, "chat", { enabled: !current });
        if (okSelf) {
          c.postLocalSystemChat("Godmode " + (!current ? "enabled" : "disabled") + ".");
        }
        return true;
      }
      const accountId = c.findAccountIdByUserRef(targetRef);
      if (!accountId) {
        c.postLocalSystemChat("Target account not found: " + targetRef);
        return true;
      }
      const modeRaw = String(parts[2] || "toggle").trim().toLowerCase();
      let enabled = null;
      if (truthy.has(modeRaw)) enabled = true;
      else if (falsy.has(modeRaw)) enabled = false;
      if (enabled === null) {
        c.postLocalSystemChat("Usage: /godmode [user] <on|off>");
        return true;
      }
      const ok = c.applyAdminAction("godmode", accountId, "chat", { enabled });
      if (ok) {
        c.postLocalSystemChat("Set godmode " + (enabled ? "ON" : "OFF") + " for @" + targetRef + ".");
      }
      return true;
    }
    if (command === "/clearworld" || command === "/wipeworld") {
      if (!c.hasAdminPermission("clearworld")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      if (!c.inWorld) {
        c.postLocalSystemChat("Enter a world first.");
        return true;
      }
      if (!c.ensureCommandReady("clearworld")) return true;
      if (typeof c.clearCurrentWorldToBedrock === "function") {
        c.clearCurrentWorldToBedrock("chat");
      } else {
        c.postLocalSystemChat("Clear world handler is unavailable.");
      }
      return true;
    }
    const needsTarget = ["/unban", "/kick", "/resetinv"];
    if (command === "/tp") {
      if (!c.hasAdminPermission("tp")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      if (!c.ensureCommandReady("tp")) return true;
      const targetRef = parts[1] || "";
      const accountId = c.findAccountIdByUserRef(targetRef);
      if (!accountId) {
        c.postLocalSystemChat("Target account not found: " + targetRef);
        return true;
      }
      const online = c.findOnlineGlobalPlayerByAccountId(accountId);
      if (!online || !online.world) {
        c.postLocalSystemChat("Target is not online.");
        return true;
      }
      c.applySelfTeleport(online.world, Number(online.x) || 0, Number(online.y) || 0);
      c.postLocalSystemChat("Teleported to @" + targetRef + ".");
      c.pushAdminAuditEntry("tp", accountId, "toWorld=" + (online.world || ""));
      return true;
    }
    if (command === "/reach") {
      if (!c.hasAdminPermission("reach")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      if (!c.ensureCommandReady("reach")) return true;
      const targetRef = (parts[1] || "").trim();
      const amountRaw = Number(parts[2]);
      if (!targetRef || !Number.isFinite(amountRaw)) {
        c.postLocalSystemChat("Usage: /reach <user> <amount>");
        return true;
      }
      const accountId = c.findAccountIdByUserRef(targetRef);
      if (!accountId) {
        c.postLocalSystemChat("Target account not found: " + targetRef);
        return true;
      }
      if (accountId !== c.playerProfileId) {
        const targetRole = c.getAccountRole(accountId, c.adminState.accounts[accountId] && c.adminState.accounts[accountId].username);
        if (!c.canActorAffectTarget(accountId, targetRole)) {
          c.postLocalSystemChat("Permission denied on target role.");
          return true;
        }
        const targetOnline = c.findOnlineGlobalPlayerByAccountId(accountId);
        if (!targetOnline) {
          c.postLocalSystemChat("Target must be online.");
          return true;
        }
      }
      const amount = Math.max(1, Math.min(16, Math.round(amountRaw * 10) / 10));
      c.issueReachCommand(accountId, amount).then((ok) => {
        if (!ok) {
          c.postLocalSystemChat("Failed to set reach for @" + targetRef + ".");
          return;
        }
        c.postLocalSystemChat("Set @" + targetRef + " reach to " + amount.toFixed(1) + " tiles (resets on exit world).");
        c.logAdminAudit("Admin(chat) set reach for @" + targetRef + " to " + amount.toFixed(1) + ".");
        c.pushAdminAuditEntry("reach", accountId, "amount=" + amount.toFixed(1));
      }).catch(() => {
        c.postLocalSystemChat("Failed to set reach for @" + targetRef + ".");
      });
      return true;
    }
    if (command === "/givex") {
      if (!c.hasAdminPermission("give_block")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      const targetRef = parts[1] || "";
      const blockRef = parts[2] || "";
      const blockId = c.parseBlockRef(blockRef);
      const amount = Number(parts[3]);
      const accountId = c.findAccountIdByUserRef(targetRef);
      if (!accountId) {
        c.postLocalSystemChat("Target account not found: " + targetRef);
        return true;
      }
      const normalBlockIds = Array.isArray(c.NORMAL_BLOCK_INVENTORY_IDS) ? c.NORMAL_BLOCK_INVENTORY_IDS : [];
      if (!normalBlockIds.includes(blockId) || !Number.isInteger(amount) || amount <= 0) {
        c.postLocalSystemChat("Usage: /givex <user> <block_key|block_id> <amount>");
        return true;
      }
      if (c.applyInventoryGrant(accountId, blockRef || blockId, amount, "chat", targetRef)) {
        c.postLocalSystemChat("Updated inventory for @" + targetRef + ".");
      }
      return true;
    }
    if (command === "/givefarmable") {
      if (!c.hasAdminPermission("give_block")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      const targetRef = parts[1] || "";
      const farmableRef = parts[2] || "";
      const blockId = c.parseBlockRef(farmableRef);
      const amount = Number(parts[3]);
      const accountId = c.findAccountIdByUserRef(targetRef);
      if (!accountId) {
        c.postLocalSystemChat("Target account not found: " + targetRef);
        return true;
      }
      const farmableIds = Array.isArray(c.FARMABLE_INVENTORY_IDS) ? c.FARMABLE_INVENTORY_IDS : [];
      if (!farmableIds.includes(blockId) || !Number.isInteger(amount) || amount <= 0) {
        c.postLocalSystemChat("Usage: /givefarmable <user> <farmable_key> <amount>");
        return true;
      }
      if (c.applyInventoryGrant(accountId, farmableRef || blockId, amount, "chat", targetRef)) {
        const farmableName = typeof c.getBlockNameById === "function"
          ? (c.getBlockNameById(blockId) || farmableRef || ("block_" + blockId))
          : (farmableRef || ("block_" + blockId));
        c.postLocalSystemChat("Gave farmable " + farmableName + " x" + amount + " to @" + targetRef + ".");
      }
      return true;
    }
    if (command === "/giveitem") {
      if (!c.hasAdminPermission("give_item")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      const targetRef = parts[1] || "";
      const itemRef = parts[2] || "";
      const amount = Number(parts[3]);
      const accountId = c.findAccountIdByUserRef(targetRef);
      if (!accountId) {
        c.postLocalSystemChat("Target account not found: " + targetRef);
        return true;
      }
      const blockId = c.parseBlockRef(itemRef);
      if (c.INVENTORY_IDS && c.INVENTORY_IDS.includes(blockId)) {
        if (c.applyInventoryGrant(accountId, itemRef || blockId, amount, "chat", targetRef)) {
          const blockName = typeof c.getBlockNameById === "function"
            ? (c.getBlockNameById(blockId) || itemRef || ("block_" + blockId))
            : (itemRef || ("block_" + blockId));
          c.postLocalSystemChat("Gave block " + blockName + " x" + amount + " to @" + targetRef + ".");
        }
        return true;
      }
      if (c.applyCosmeticItemGrant(accountId, itemRef, amount, "chat", targetRef)) {
        c.postLocalSystemChat("Gave item " + itemRef + " x" + amount + " to @" + targetRef + ".");
      } else {
        c.postLocalSystemChat("Usage: /giveitem <user> <block_key|block_id|cosmetic_id> <amount>");
      }
      return true;
    }
    if (command === "/spawnd") {
      if (!c.hasAdminPermission("give_item")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      if (!c.inWorld) {
        c.postLocalSystemChat("Enter a world first.");
        return true;
      }
      if (!c.ensureCommandReady("give_item")) return true;
      if (typeof c.spawnAdminWorldDrops !== "function") {
        c.postLocalSystemChat("Drop spawn handler is unavailable.");
        return true;
      }
      const itemRefRaw = String(parts[1] || "").trim();
      const quantityRaw = Number(parts[2]);
      const amountRaw = Number(parts[3]);
      if (!itemRefRaw || !Number.isFinite(quantityRaw) || !Number.isFinite(amountRaw)) {
        c.postLocalSystemChat("Usage: /spawnd <item> <quantity_per_drop> <tile_amount>");
        return true;
      }
      const quantity = Math.max(1, Math.min(300, Math.floor(quantityRaw)));
      const tileAmount = Math.max(1, Math.min(225, Math.floor(amountRaw)));

      let entry = null;
      let label = itemRefRaw;
      const itemRef = itemRefRaw.toLowerCase();

      if (itemRef === "fist" || itemRef === c.TOOL_FIST) {
        entry = { type: "tool", toolId: c.TOOL_FIST };
        label = "Fist";
      } else if (itemRef === "wrench" || itemRef === c.TOOL_WRENCH) {
        entry = { type: "tool", toolId: c.TOOL_WRENCH };
        label = "Wrench";
      } else {
        const blockId = c.parseBlockRef(itemRefRaw);
        if (c.INVENTORY_IDS.includes(blockId)) {
          entry = { type: "block", blockId };
          if (typeof c.getBlockNameById === "function") {
            label = c.getBlockNameById(blockId) || ("Block " + blockId);
          } else {
            label = "Block " + blockId;
          }
        } else {
          const cosmeticItems = typeof c.getCosmeticItems === "function" ? c.getCosmeticItems() : [];
          const cosmetic = Array.isArray(cosmeticItems)
            ? cosmeticItems.find((it) => it && String(it.id || "").toLowerCase() === itemRef)
            : null;
          if (cosmetic) {
            entry = { type: "cosmetic", cosmeticId: cosmetic.id };
            label = cosmetic.name || cosmetic.id;
          }
        }
      }

      if (!entry) {
        c.postLocalSystemChat("Unknown item: " + itemRefRaw + ".");
        return true;
      }

      const centerTx = Math.max(0, Math.min(c.WORLD_W - 1, Math.floor((Number(c.player.x) || 0) / c.TILE)));
      const centerTy = Math.max(0, Math.min(c.WORLD_H - 1, Math.floor((Number(c.player.y) || 0) / c.TILE)));
      const spawnTiles = [];
      const seen = new Set();
      const centerKey = centerTx + "_" + centerTy;
      seen.add(centerKey);
      spawnTiles.push({ tx: centerTx, ty: centerTy });

      let radius = 1;
      while (spawnTiles.length < tileAmount && radius <= Math.max(c.WORLD_W, c.WORLD_H)) {
        for (let dy = -radius; dy <= radius && spawnTiles.length < tileAmount; dy++) {
          for (let dx = -radius; dx <= radius && spawnTiles.length < tileAmount; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
            const tx = centerTx + dx;
            const ty = centerTy + dy;
            if (tx < 0 || ty < 0 || tx >= c.WORLD_W || ty >= c.WORLD_H) continue;
            const key = tx + "_" + ty;
            if (seen.has(key)) continue;
            seen.add(key);
            spawnTiles.push({ tx, ty });
          }
        }
        radius++;
      }

      const dropPoints = spawnTiles.map((tile) => ({
        x: tile.tx * c.TILE,
        y: tile.ty * c.TILE
      }));
      c.spawnAdminWorldDrops(entry, quantity, dropPoints).then((result) => {
        const spawned = Math.max(0, Math.floor(Number(result && result.written) || 0));
        if (!result || !result.ok || spawned <= 0) {
          c.postLocalSystemChat("Failed to spawn drops via backend.");
          return;
        }
        c.postLocalSystemChat("Spawned " + spawned + " drop stacks of " + label + " x" + quantity + ".");
        if (typeof c.logAdminAudit === "function") {
          c.logAdminAudit("Admin(chat) spawned drops: " + label + " x" + quantity + " in " + spawned + " tiles.");
        }
        if (typeof c.pushAdminAuditEntry === "function") {
          c.pushAdminAuditEntry("spawnd", "", label + " qty=" + quantity + " tiles=" + spawned);
        }
      }).catch(() => {
        c.postLocalSystemChat("Failed to spawn drops via backend.");
      });
      return true;
    }
    if (command === "/givetitle" || command === "/removetitle") {
      const removeMode = command === "/removetitle";
      if (!c.hasAdminPermission(removeMode ? "remove_title" : "give_title")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      const targetRef = parts[1] || "";
      const titleId = parts[2] || "";
      const amount = Number(parts[3]);
      const accountId = c.findAccountIdByUserRef(targetRef);
      if (!accountId) {
        c.postLocalSystemChat("Target account not found: " + targetRef);
        return true;
      }
      if (typeof c.applyTitleGrant !== "function") {
        c.postLocalSystemChat("Title grant handler is unavailable.");
        return true;
      }
      if (c.applyTitleGrant(accountId, titleId, amount, "chat", targetRef, removeMode)) {
        c.postLocalSystemChat((removeMode ? "Removed title " : "Added title ") + titleId + " x" + amount + (removeMode ? " from @" : " to @") + targetRef + ".");
      }
      return true;
    }
    if (command === "/bring" || command === "/summon") {
      if (!c.hasAdminPermission("bring")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      if (!c.ensureCommandReady(command === "/summon" ? "summon" : "bring")) return true;
      const targetRef = parts[1] || "";
      const accountId = c.findAccountIdByUserRef(targetRef);
      if (!accountId) {
        c.postLocalSystemChat("Target account not found: " + targetRef);
        return true;
      }
      const targetRole = c.getAccountRole(accountId, c.adminState.accounts[accountId] && c.adminState.accounts[accountId].username);
      if (!c.canActorAffectTarget(accountId, targetRole)) {
        c.postLocalSystemChat("Permission denied on target role.");
        return true;
      }
      if (!c.inWorld) {
        c.postLocalSystemChat("Enter a world first.");
        return true;
      }
      c.issueTeleportCommand(accountId, c.currentWorldId, c.player.x + 24, c.player.y).then((ok) => {
        if (ok) {
          c.postLocalSystemChat("Summon sent to @" + targetRef + ".");
          c.logAdminAudit("Admin(chat) summoned @" + targetRef + " to " + c.currentWorldId + ".");
          c.pushAdminAuditEntry("summon", accountId, "world=" + c.currentWorldId);
        } else {
          c.postLocalSystemChat("Failed to summon target.");
        }
      });
      return true;
    }
    if (command === "/tempban" || command === "/ban") {
      if (!c.hasAdminPermission("tempban")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      const targetRef = parts[1] || "";
      let durationRaw = parts[2] || "";
      let durationMs = c.parseDurationToMs(durationRaw);
      let reasonStartIndex = 3;
      if (command === "/ban" && !durationMs) {
        durationRaw = "60m";
        durationMs = c.parseDurationToMs(durationRaw);
        reasonStartIndex = 2;
      }
      const reason = parts.slice(reasonStartIndex).join(" ").trim() || "Temporarily banned by admin";
      if (!targetRef || !durationMs) {
        c.postLocalSystemChat("Usage: /tempban <user> <60m|12h|7d> [reason]");
        return true;
      }
      const accountId = c.findAccountIdByUserRef(targetRef);
      if (!accountId) {
        c.postLocalSystemChat("Target account not found: " + targetRef);
        return true;
      }
      const ok = c.applyAdminAction("tempban", accountId, "chat", { durationMs, reason, rawDuration: durationRaw });
      if (ok) {
        c.postLocalSystemChat("Temp banned @" + targetRef + " for " + durationRaw + ".");
      }
      return true;
    }
    if (command === "/permban") {
      if (!c.hasAdminPermission("permban")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      const targetRef = parts[1] || "";
      const reason = parts.slice(2).join(" ").trim() || "Permanently banned by admin";
      if (!targetRef) {
        c.postLocalSystemChat("Usage: /permban <user> [reason]");
        return true;
      }
      const accountId = c.findAccountIdByUserRef(targetRef);
      if (!accountId) {
        c.postLocalSystemChat("Target account not found: " + targetRef);
        return true;
      }
      const ok = c.applyAdminAction("permban", accountId, "chat", { reason });
      if (ok) {
        c.postLocalSystemChat("Permanently banned @" + targetRef + ".");
      }
      return true;
    }
    if (command === "/role") {
      const targetRef = parts[1] || "";
      const accountId = c.findAccountIdByUserRef(targetRef);
      if (!accountId) {
        c.postLocalSystemChat("Target account not found: " + targetRef);
        return true;
      }
      const username = (c.adminState.accounts[accountId] && c.adminState.accounts[accountId].username) || accountId;
      const role = c.getAccountRole(accountId, username);
      c.postLocalSystemChat("@" + username + " role: " + role);
      return true;
    }
    if (command === "/setrole") {
      if (!c.hasAdminPermission("setrole") && !c.hasAdminPermission("setrole_limited")) {
        c.postLocalSystemChat("Permission denied.");
        return true;
      }
      const targetRef = parts[1] || "";
      const nextRole = c.normalizeAdminRole(parts[2] || "none");
      if (!["none", "moderator", "admin", "manager", "owner"].includes(nextRole)) {
        c.postLocalSystemChat("Usage: /setrole <user> <none|moderator|admin|manager|owner>");
        return true;
      }
      const accountId = c.findAccountIdByUserRef(targetRef);
      if (!accountId) {
        c.postLocalSystemChat("Target account not found: " + targetRef);
        return true;
      }
      if (c.applyAdminRoleChange(accountId, nextRole, "chat")) {
        c.postLocalSystemChat("Set role " + nextRole + " for @" + targetRef + ".");
      }
      return true;
    }
    if (!needsTarget.includes(command)) return false;
    const targetRef = parts[1] || "";
    const accountId = c.findAccountIdByUserRef(targetRef);
    if (!accountId) {
      c.postLocalSystemChat("Target account not found: " + targetRef);
      return true;
    }
    const map = {
      "/unban": "unban",
      "/kick": "kick",
      "/resetinv": "resetinv"
    };
    const ok = c.applyAdminAction(map[command], accountId, "chat");
    if (ok) {
      c.postLocalSystemChat("Executed " + command + " for @" + (c.adminState.accounts[accountId] && c.adminState.accounts[accountId].username || accountId));
    }
    return true;
  }
};
