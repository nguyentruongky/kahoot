# Debugging Steps for Socket Connection

## What to Check:

1. **Open Browser Console** (F12) on both Host and Player pages
2. **Look for these logs:**

### Host Page Should Show:
```
🔌 Connecting socket...
✅ Host socket connected: <socket-id>
👂 Host listening for events
🎮 Host joining room with PIN: <6-digit-pin>
Socket connected? true
Socket ID: <socket-id>
```

### Player Page Should Show:
```
🔌 Player connecting socket...
✅ Player socket connected: <socket-id>
👤 PLAYER EMITTING join_game: {pin: "123456", name: "PlayerName"}
Socket connected? true
Socket ID: <socket-id>
```

### Server Console Should Show:
```
🟢 Client connected: <socket-id>
🎮 Host created room: <pin>
👤 Player joining: PlayerName to PIN: <pin>
```

### Host Should Then Receive:
```
🟢 HOST RECEIVED: Player joined: {name: "PlayerName"}
Updated players: [{name: "PlayerName", score: 0}]
```

## Common Issues:

1. **Socket not connecting** - Check if `/api/socket` endpoint is accessible
2. **PIN mismatch** - Verify host and player are using the same PIN
3. **Timing issue** - Host needs to join room BEFORE player joins
4. **Multiple connections** - Check for duplicate socket instances

## To Test:

1. Start host, create game, note the PIN
2. Open player in DIFFERENT browser/incognito
3. Enter the exact PIN from host
4. Check console logs on both sides
5. Player should appear in host's player list
