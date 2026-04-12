import Phaser from "phaser";
import { getSocket } from "../network/SocketManager";

export class HomeScene extends Phaser.Scene {
  private nameInput!: HTMLInputElement;
  private codeInput!: HTMLInputElement;
  private overlay!: HTMLDivElement;
  private errorText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "HomeScene" });
  }

  init(data: { roomCode?: string }) {
    // If we arrived with a room code from the URL, store it
    if (data.roomCode) {
      this.registry.set("joinRoomCode", data.roomCode);
    }
  }

  create() {
    // Background
    const graphics = this.add.graphics();
    graphics.fillStyle(0x1a1a2e, 1);
    graphics.fillRect(0, 0, 800, 600);

    // Title
    this.add
      .text(400, 80, "E-BIKE WARS", {
        fontSize: "52px",
        color: "#e94560",
        fontFamily: "Arial, sans-serif",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(400, 130, "Arena Combat", {
        fontSize: "18px",
        color: "#aaaacc",
        fontFamily: "Arial, sans-serif",
      })
      .setOrigin(0.5);

    // Error text (hidden by default)
    this.errorText = this.add
      .text(400, 480, "", {
        fontSize: "14px",
        color: "#ff4444",
        fontFamily: "Arial, sans-serif",
        wordWrap: { width: 350 },
        align: "center",
      })
      .setOrigin(0.5);

    // Create the HTML overlay for inputs (Phaser doesn't have native text inputs)
    this.createHTMLOverlay();

    // Check if we have a room code to auto-join
    const pendingCode = this.registry.get("joinRoomCode");
    if (pendingCode) {
      this.codeInput.value = pendingCode;
      this.registry.remove("joinRoomCode");
    }

    // Connect socket
    getSocket();

    // Clean up HTML when leaving this scene
    this.events.on("shutdown", () => {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
    });
  }

  private createHTMLOverlay() {
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      z-index: 10;
      font-family: Arial, sans-serif;
    `;

    // Name input
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Your Name";
    nameLabel.style.cssText = "color: #aabbcc; font-size: 14px; margin-top: 20px;";

    this.nameInput = document.createElement("input");
    this.nameInput.type = "text";
    this.nameInput.placeholder = "Enter your name";
    this.nameInput.maxLength = 16;
    this.nameInput.style.cssText = `
      width: 260px;
      padding: 12px 16px;
      font-size: 18px;
      border: 2px solid #4444aa;
      border-radius: 8px;
      background: #222244;
      color: #ffffff;
      outline: none;
      text-align: center;
      font-family: Arial, sans-serif;
    `;
    this.nameInput.addEventListener("focus", () => {
      this.nameInput.style.borderColor = "#6666cc";
    });
    this.nameInput.addEventListener("blur", () => {
      this.nameInput.style.borderColor = "#4444aa";
    });

    // Create Game button
    const createBtn = document.createElement("button");
    createBtn.textContent = "CREATE GAME";
    createBtn.style.cssText = `
      width: 260px;
      padding: 14px;
      font-size: 18px;
      font-weight: bold;
      border: none;
      border-radius: 8px;
      background: #16c79a;
      color: #ffffff;
      cursor: pointer;
      font-family: Arial, sans-serif;
      margin-top: 8px;
    `;
    createBtn.addEventListener("mouseenter", () => {
      createBtn.style.background = "#1dd9a8";
    });
    createBtn.addEventListener("mouseleave", () => {
      createBtn.style.background = "#16c79a";
    });
    createBtn.addEventListener("click", () => this.handleCreateGame());

    // Divider
    const divider = document.createElement("div");
    divider.style.cssText = `
      color: #666688;
      font-size: 14px;
      margin: 4px 0;
    `;
    divider.textContent = "or join an existing game";

    // Room code input
    this.codeInput = document.createElement("input");
    this.codeInput.type = "text";
    this.codeInput.placeholder = "Room code (e.g. BIKE-7X3Q)";
    this.codeInput.maxLength = 9;
    this.codeInput.style.cssText = `
      width: 260px;
      padding: 12px 16px;
      font-size: 18px;
      border: 2px solid #4444aa;
      border-radius: 8px;
      background: #222244;
      color: #ffffff;
      outline: none;
      text-align: center;
      text-transform: uppercase;
      font-family: Arial, sans-serif;
      letter-spacing: 2px;
    `;
    this.codeInput.addEventListener("focus", () => {
      this.codeInput.style.borderColor = "#6666cc";
    });
    this.codeInput.addEventListener("blur", () => {
      this.codeInput.style.borderColor = "#4444aa";
    });

    // Join button
    const joinBtn = document.createElement("button");
    joinBtn.textContent = "JOIN GAME";
    joinBtn.style.cssText = `
      width: 260px;
      padding: 14px;
      font-size: 18px;
      font-weight: bold;
      border: 2px solid #4488ff;
      border-radius: 8px;
      background: transparent;
      color: #4488ff;
      cursor: pointer;
      font-family: Arial, sans-serif;
    `;
    joinBtn.addEventListener("mouseenter", () => {
      joinBtn.style.background = "#4488ff";
      joinBtn.style.color = "#ffffff";
    });
    joinBtn.addEventListener("mouseleave", () => {
      joinBtn.style.background = "transparent";
      joinBtn.style.color = "#4488ff";
    });
    joinBtn.addEventListener("click", () => this.handleJoinGame());

    // Allow Enter key to submit
    this.codeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handleJoinGame();
    });
    this.nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handleCreateGame();
    });

    this.overlay.appendChild(nameLabel);
    this.overlay.appendChild(this.nameInput);
    this.overlay.appendChild(createBtn);
    this.overlay.appendChild(divider);
    this.overlay.appendChild(this.codeInput);
    this.overlay.appendChild(joinBtn);

    document.body.appendChild(this.overlay);
  }

  private validateName(): string | null {
    const name = this.nameInput.value.trim();
    if (!name) {
      this.showError("Please enter your name");
      return null;
    }
    if (name.length < 1 || name.length > 16) {
      this.showError("Name must be 1-16 characters");
      return null;
    }
    return name;
  }

  private showError(message: string) {
    this.errorText.setText(message);
    this.time.delayedCall(4000, () => {
      this.errorText.setText("");
    });
  }

  private handleCreateGame() {
    const name = this.validateName();
    if (!name) return;

    const socket = getSocket();
    socket.emit("createRoom", { playerName: name }, (response) => {
      if (response.success && response.roomCode) {
        // Update URL without reload
        window.history.pushState({}, "", `/game/${response.roomCode}`);
        this.scene.start("LobbyScene", { roomCode: response.roomCode, playerName: name });
      } else {
        this.showError(response.error || "Failed to create game");
      }
    });
  }

  private handleJoinGame() {
    const name = this.validateName();
    if (!name) return;

    const code = this.codeInput.value.trim().toUpperCase();
    if (!code) {
      this.showError("Please enter a room code");
      return;
    }

    const socket = getSocket();
    socket.emit("joinRoom", { roomCode: code, playerName: name }, (response) => {
      if (response.success) {
        window.history.pushState({}, "", `/game/${code}`);
        this.scene.start("LobbyScene", { roomCode: code, playerName: name });
      } else {
        this.showError(response.error || "Failed to join game");
      }
    });
  }
}
