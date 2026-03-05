# 🌍 PIXELBUILD

[![Join Discord](https://img.shields.io/badge/Discord-Join%20Server-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/xnaG8dSeRJ)

**PIXELBUILD** is a browser-based 2D sandbox MMO inspired by Growtopia, built entirely with **HTML, CSS, JavaScript, and Firebase Realtime Database**.

> No traditional backend server is required for gameplay.

Sound Effect by <a href="https://pixabay.com/users/universfield-28281460/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=144751">Universfield</a> from <a href="https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=144751">Pixabay</a>

---

## ✨ Features

- Account system (register/login)
- Multiplayer worlds
- World ownership + admin roles
- World browser with player counts
- Block placing, breaking, rotating
- Seeds, trees, growth, harvesting
- Gems + inventory system
- Dropped items + stacking
- Cosmetics (hats, wings, swords, etc.)
- Chat, private messages, friends, trading
- Vending machines + donation boxes
- Storage chests
- Signs, doors, weather machines
- Admin panel + command system
- Backup / restore system with JSON export/import

---

## 🛠 Tech Stack

- Vanilla JavaScript modules
- Firebase Realtime Database
- Firebase Auth
- Firebase App Check *(optional but supported)*
- Font Awesome icons

---

## 🚀 Quick Start

1. Open:

index.html

2. Configure Firebase  
Either:
- place config inside `firebase-config.js`  
OR
- use runtime API-key fetching if configured.

3. Make sure your Firebase rules allow your environment.

4. Create account → play.

---

## ⚙️ Configuration Notes

- Database path controlled by  
  SETTINGS.BASE_PATH

- Admin roles configured in:
  admin.js
  settings.js

- Asset cache-busting:
  window.GT_ASSET_VERSION

---

## 💾 Backup System

Owner panel actions:

- Backup database
- Restore backup
- Download JSON
- Upload JSON

Backups are stored under:

{BASE_PATH}/backups

Restore keeps existing backups intact.

---

## 🎮 Controls

| Action | Key |
|------|-----|
Move | A / D or Arrows |
Jump | W or Space |
Chat | Enter |
Drop Item | Q |
Place/Break | Mouse / Tap |
Rotate | Right click |
Slots | 1 = fist, 2 = wrench |

---

## 📁 Module Overview

Core
- game.js

Database/Auth
- db.js
- auth.js

Admin System
- admin.js
- admins.js
- commands.js

Sync Systems
- sync_player.js
- sync_blocks.js
- sync_worlds.js
- sync_hits.js

Gameplay Systems
- vending.js
- donation.js
- chest.js
- plants.js
- trade.js
- friends.js
- shop.js
- sign.js

Content
- blocks.js
- seeds.js
- items.js
- titles.js
- clothes/*

Utilities
- backup.js

---

## 📜 Disclaimer

This project is a **fan-made sandbox game** inspired by Growtopia.  
It is not affiliated with or endorsed by Ubisoft or the original Growtopia developers.
