Put your audio files in this folder.

Default lookup:
- sounds/<sound_id>.mp3
- sounds/<sound_id>.ogg
- sounds/<sound_id>.wav
- sounds/<sound_id>.m4a

Example:
1) Add file: sounds/break_block.mp3
2) Use in code:
   sound.play("break_block");

Optional explicit config (for custom filenames):
window.GT_SOUND_DEFS = {
  break_block: { file: "blocks/break1.mp3", volume: 0.8 },
  jump: { file: "jump.wav", volume: 0.7 }
};

Quick API (global):
- sound.play(id)
- sound.preload([ids])
- sound.stop(id)
- sound.stopAll()
- sound.mute()
- sound.unmute()
- sound.setVolume(0..1)

Notes:
- No manual register required for basic usage.
- If id is unknown, sounds.js auto-resolves files under sounds/<id>.(mp3|ogg|wav|m4a).

Current game event IDs wired in `core/game.js`:
- sfx_hit
- sfx_place
- sfx_collect
- sfx_ui
- sfx_shop_buy
- sfx_jump
- sfx_door
- sfx_drop
- sfx_vending_purchase
- sfx_chat_sent
- sfx_pm_received
- sfx_pm_sent
- sfx_friend_request_sent
- sfx_friend_request_received
- sfx_friend_request_accepted
- sfx_trade_accept
- sfx_trade_decline
- sfx_trade_request_accept
- sfx_trade_request_decline

You can replace each `sounds/sfx_*.mp3` file with your own custom recording/SFX.
