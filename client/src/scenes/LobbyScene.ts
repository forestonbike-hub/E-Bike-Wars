import Phaser from "phaser";
import { getSocket } from "../network/SocketManager";
import { BIKE_COLORS, type RoomInfo, type Player } from "@shared/types";

export class LobbyScene extends Phaser.Scene {
  private roomCode: string = "";
  private playerName: string = "";
  private roomInfo: RoomInfo | null = null;
  private overlay!: HTMLDivElement;

  constructor() {
    super({ key: "LobbyScene" });
  }

  init(data: { roomCode: string; playerName: string }) {
    this.roomCode = data.roomCode;
    this.playerName = data.playerName;
  }

  create() {
    const sw = this.scale.width;
    const sh = this.scale.height;

    // Background
    this.add.graphics().fillStyle(0x1a1a2e, 1).fillRect(0, 0, sw, sh);

    // Title
    this.add
      .text(sw / 2, 40, "GAME LOBBY", {
        fontSize: "36px",
        color: "#e94560",
        fontFamily: "Arial, sans-serif",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Build the HTML lobby overlay
    this.createLobbyOverlay();

    // Listen for room updates
    const socket = getSocket();

    socket.on("roomUpdated", (room: RoomInfo) => {
      this.roomInfo = room;
      this.updateLobbyDisplay();
    });

    // Request current room state (in case we missed the broadcast during scene transition)
    socket.emit("getRoomInfo", (room) => {
      if (room) {
        this.roomInfo = room;
        this.updateLobbyDisplay();
      }
    });

    socket.on("equipPhaseStarting", () => {
      this.cleanupOverlay();
      this.scene.start("EquipScene", {
        roomCode: this.roomCode,
        playerName: this.playerName,
      });
    });

    socket.on("error", (message: string) => {
      this.showToast(message);
    });

    // Clean up on scene shutdown
    this.events.on("shutdown", () => {
      this.cleanupOverlay();
      socket.off("roomUpdated");
      socket.off("equipPhaseStarting");
      socket.off("error");
    });
  }

  private cleanupOverlay() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }

  private createLobbyOverlay() {
    this.overlay = document.createElement("div");
    this.overlay.id = "lobby-overlay";
    this.overlay.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 400px;
      max-width: 90vw;
      max-height: 90vh;
      max-height: 90dvh;
      overflow-y: auto;
      font-family: Arial, sans-serif;
      color: #ffffff;
      z-index: 10;
    `;

    this.overlay.innerHTML = `
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 14px; color: #888899;">Room Code</div>
        <div id="lobby-room-code" style="font-size: 28px; font-weight: bold; color: #ffcc22; letter-spacing: 4px; margin: 4px 0;">${this.roomCode}</div>
        <button id="lobby-copy-btn" style="
          padding: 6px 16px;
          font-size: 13px;
          border: 1px solid #4488ff;
          border-radius: 6px;
          background: transparent;
          color: #4488ff;
          cursor: pointer;
          font-family: Arial, sans-serif;
        ">Copy Invite Link</button>
      </div>

      <div id="lobby-players" style="
        background: #222244;
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 16px;
        min-height: 100px;
      ">
        <div style="font-size: 13px; color: #888899; margin-bottom: 10px;">PLAYERS</div>
        <div id="lobby-player-list"></div>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-size: 13px; color: #888899; margin-bottom: 8px;">YOUR BIKE COLOR</div>
        <div id="lobby-color-picker" style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;"></div>
      </div>

      <div id="lobby-actions" style="text-align: center;"></div>

      <div id="lobby-toast" style="
        text-align: center;
        font-size: 13px;
        color: #ff4444;
        margin-top: 8px;
        min-height: 20px;
      "></div>

      <div style="text-align: center; margin-top: 12px;">
        <button id="lobby-leave-btn" style="
          padding: 6px 16px;
          font-size: 12px;
          border: 1px solid #666688;
          border-radius: 6px;
          background: transparent;
          color: #666688;
          cursor: pointer;
          font-family: Arial, sans-serif;
        ">Leave Room</button>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Copy link button
    document.getElementById("lobby-copy-btn")!.addEventListener("click", () => {
      const url = `${window.location.origin}/game/${this.roomCode}`;
      navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById("lobby-copy-btn")!;
        btn.textContent = "Copied!";
        btn.style.color = "#16c79a";
        btn.style.borderColor = "#16c79a";
        setTimeout(() => {
          btn.textContent = "Copy Invite Link";
          btn.style.color = "#4488ff";
          btn.style.borderColor = "#4488ff";
        }, 2000);
      });
    });

    // Leave button
    document.getElementById("lobby-leave-btn")!.addEventListener("click", () => {
      const socket = getSocket();
      socket.emit("leaveRoom");
      this.cleanupOverlay();
      window.history.pushState({}, "", "/");
      this.scene.start("HomeScene");
    });

    // Build color picker
    this.buildColorPicker();
  }

  private buildColorPicker() {
    const container = document.getElementById("lobby-color-picker")!;
    container.innerHTML = "";

    BIKE_COLORS.forEach((color, index) => {
      const swatch = document.createElement("div");
      swatch.dataset.index = String(index);
      swatch.title = color.name;
      swatch.style.cssText = `
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: ${color.hex};
        cursor: pointer;
        border: 3px solid transparent;
        transition: border-color 0.15s;
      `;
      swatch.addEventListener("click", () => {
        getSocket().emit("changeColor", index);
      });
      container.appendChild(swatch);
    });
  }

  private updateLobbyDisplay() {
    if (!this.roomInfo) return;

    const socket = getSocket();
    const myId = socket.id;
    const me = this.roomInfo.players.find(p => p.id === myId);
    const isHost = me?.isHost ?? false;

    // Count bots for add-bot limit
    const botCount = this.roomInfo.players.filter(p => p.isBot).length;

    // Update player list
    const listEl = document.getElementById("lobby-player-list");
    if (listEl) {
      listEl.innerHTML = this.roomInfo.players
        .map((p) => {
          const color = BIKE_COLORS[p.colorIndex]?.hex || "#ffffff";
          const hostBadge = p.isHost ? '<span style="color: #ffcc22; font-size: 11px; margin-left: 6px;">HOST</span>' : "";
          const readyBadge = !p.isHost && p.isReady ? '<span style="color: #16c79a; font-size: 11px; margin-left: 6px;">READY</span>' : "";
          const youBadge = p.id === myId ? '<span style="color: #888899; font-size: 11px; margin-left: 6px;">(you)</span>' : "";

          const botBadge = p.isBot ? '<span style="color: #ff8833; font-size: 11px; margin-left: 6px;">BOT</span>' : "";
          const removeBotBtn = (isHost && p.isBot) ? `<button class="remove-bot-btn" data-bot-id="${p.id}" style="
            padding: 2px 8px; font-size: 11px; border: 1px solid #ff4455; border-radius: 4px;
            background: transparent; color: #ff4455; cursor: pointer; font-family: Arial, sans-serif; margin-left: 8px;
          ">X</button>` : "";

          return `
            <div style="display: flex; align-items: center; padding: 6px 0; border-bottom: 1px solid #333355;">
              <div style="width: 20px; height: 20px; border-radius: 50%; background: ${color}; margin-right: 10px; flex-shrink: 0;"></div>
              <div style="flex: 1; font-size: 15px;">${p.name}${youBadge}${hostBadge}${readyBadge}${botBadge}${removeBotBtn}</div>
            </div>
          `;
        })
        .join("");

      // Wire up remove-bot buttons
      listEl.querySelectorAll(".remove-bot-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const botId = (btn as HTMLElement).dataset.botId;
          if (botId) getSocket().emit("removeBot", botId);
        });
      });
    }

    // Update color picker selection
    const swatches = document.querySelectorAll("#lobby-color-picker div");
    const usedColors = new Set(this.roomInfo.players.filter(p => p.id !== myId).map(p => p.colorIndex));

    swatches.forEach((swatch) => {
      const el = swatch as HTMLElement;
      const idx = parseInt(el.dataset.index || "0");

      if (me && idx === me.colorIndex) {
        el.style.borderColor = "#ffffff";
        el.style.transform = "scale(1.15)";
      } else if (usedColors.has(idx)) {
        el.style.borderColor = "transparent";
        el.style.opacity = "0.3";
        el.style.cursor = "not-allowed";
        el.style.transform = "scale(1)";
      } else {
        el.style.borderColor = "transparent";
        el.style.opacity = "1";
        el.style.cursor = "pointer";
        el.style.transform = "scale(1)";
      }
    });

    // Update action buttons
    const actionsEl = document.getElementById("lobby-actions");
    if (actionsEl) {
      if (isHost) {
        const canStart = this.roomInfo.players.length >= 2 &&
          this.roomInfo.players.every(p => p.isHost || p.isReady);

        const canAddBot = botCount < 4 && this.roomInfo!.players.length < this.roomInfo!.maxPlayers;

        actionsEl.innerHTML = `
          <button id="lobby-start-btn" style="
            width: 260px;
            padding: 14px;
            font-size: 18px;
            font-weight: bold;
            border: none;
            border-radius: 8px;
            background: ${canStart ? "#16c79a" : "#444466"};
            color: ${canStart ? "#ffffff" : "#888899"};
            cursor: ${canStart ? "pointer" : "not-allowed"};
            font-family: Arial, sans-serif;
          ">START GAME</button>
          <div style="font-size: 12px; color: #888899; margin-top: 6px;">
            ${this.roomInfo.players.length < 2
              ? "Waiting for more players..."
              : !canStart
                ? "Waiting for all players to ready up..."
                : `${this.roomInfo.players.length} players ready!`
            }
          </div>
          <button id="lobby-add-bot-btn" style="
            margin-top: 12px;
            padding: 8px 20px;
            font-size: 14px;
            border: 1px solid ${canAddBot ? "#ff8833" : "#444466"};
            border-radius: 6px;
            background: transparent;
            color: ${canAddBot ? "#ff8833" : "#666688"};
            cursor: ${canAddBot ? "pointer" : "not-allowed"};
            font-family: Arial, sans-serif;
          ">+ Add Bot${botCount > 0 ? ` (${botCount}/4)` : ""}</button>
        `;

        if (canStart) {
          document.getElementById("lobby-start-btn")!.addEventListener("click", () => {
            getSocket().emit("startGame");
          });
        }
        if (canAddBot) {
          document.getElementById("lobby-add-bot-btn")!.addEventListener("click", () => {
            getSocket().emit("addBot");
          });
        }
      } else {
        const amReady = me?.isReady ?? false;
        actionsEl.innerHTML = `
          <button id="lobby-ready-btn" style="
            width: 260px;
            padding: 14px;
            font-size: 18px;
            font-weight: bold;
            border: 2px solid ${amReady ? "#16c79a" : "#4488ff"};
            border-radius: 8px;
            background: ${amReady ? "#16c79a" : "transparent"};
            color: ${amReady ? "#ffffff" : "#4488ff"};
            cursor: pointer;
            font-family: Arial, sans-serif;
          ">${amReady ? "READY!" : "READY UP"}</button>
        `;

        document.getElementById("lobby-ready-btn")!.addEventListener("click", () => {
          getSocket().emit("toggleReady");
        });
      }
    }
  }

  private showToast(message: string) {
    const el = document.getElementById("lobby-toast");
    if (el) {
      el.textContent = message;
      setTimeout(() => { el.textContent = ""; }, 4000);
    }
  }
}
