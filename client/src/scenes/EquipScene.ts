import Phaser from "phaser";
import { getSocket } from "../network/SocketManager";
import {
  EQUIP_ITEMS,
  STARTING_BUDGET,
  type EquipCategory,
  type EquipItem,
  type PlayerLoadout,
} from "@shared/types";

export class EquipScene extends Phaser.Scene {
  private roomCode: string = "";
  private playerName: string = "";
  private overlay!: HTMLDivElement;
  private selectedItems: Set<string> = new Set();
  private isReady: boolean = false;
  private activeCategory: EquipCategory = "bike";

  constructor() {
    super({ key: "EquipScene" });
  }

  init(data: { roomCode: string; playerName: string }) {
    this.roomCode = data.roomCode;
    this.playerName = data.playerName;
    this.selectedItems.clear();
    this.isReady = false;
  }

  create() {
    // Dark background
    this.add.graphics().fillStyle(0x1a1a2e, 1).fillRect(0, 0, 800, 600);

    this.createOverlay();

    const socket = getSocket();

    // Listen for other players' equip updates (for future "ready" status display)
    socket.on("equipUpdate", (data) => {
      this.updateReadyCount();
    });

    socket.on("battleStarting", () => {
      this.cleanupOverlay();
      this.scene.start("GameScene", {
        roomCode: this.roomCode,
        loadout: {
          itemIds: Array.from(this.selectedItems),
          budgetRemaining: this.getRemainingBudget(),
        },
      });
    });

    socket.on("error", (message: string) => {
      this.showToast(message);
    });

    this.events.on("shutdown", () => {
      this.cleanupOverlay();
      socket.off("equipUpdate");
      socket.off("battleStarting");
      socket.off("error");
    });
  }

  private cleanupOverlay() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }

  private getRemainingBudget(): number {
    let spent = 0;
    for (const itemId of this.selectedItems) {
      const item = EQUIP_ITEMS.find((i) => i.id === itemId);
      if (item) spent += item.price;
    }
    return STARTING_BUDGET - spent;
  }

  private createOverlay() {
    this.overlay = document.createElement("div");
    this.overlay.id = "equip-overlay";
    this.overlay.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex;
      flex-direction: column;
      font-family: Arial, sans-serif;
      color: #ffffff;
      z-index: 10;
      overflow: hidden;
    `;

    this.overlay.innerHTML = `
      <div id="equip-header" style="
        padding: 16px 20px;
        background: #16162a;
        border-bottom: 2px solid #333355;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
      ">
        <div>
          <div style="font-size: 12px; color: #888899; text-transform: uppercase; letter-spacing: 1px;">Equip Phase</div>
          <div style="font-size: 20px; font-weight: bold; color: #ffffff;">${this.playerName}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 12px; color: #888899;">BUDGET</div>
          <div id="equip-budget" style="font-size: 28px; font-weight: bold; color: #16c79a;">$${STARTING_BUDGET}</div>
        </div>
      </div>

      <div id="equip-tabs" style="
        display: flex;
        gap: 0;
        flex-shrink: 0;
        background: #16162a;
      ">
        <button class="equip-tab active" data-category="bike" style="
          flex: 1;
          padding: 12px 8px;
          font-size: 14px;
          font-weight: bold;
          border: none;
          border-bottom: 3px solid #4488ff;
          background: #222244;
          color: #4488ff;
          cursor: pointer;
          font-family: Arial, sans-serif;
          transition: all 0.15s;
        ">🚲 BIKE</button>
        <button class="equip-tab" data-category="armor" style="
          flex: 1;
          padding: 12px 8px;
          font-size: 14px;
          font-weight: bold;
          border: none;
          border-bottom: 3px solid transparent;
          background: #1a1a33;
          color: #888899;
          cursor: pointer;
          font-family: Arial, sans-serif;
          transition: all 0.15s;
        ">🛡️ ARMOR</button>
        <button class="equip-tab" data-category="weapons" style="
          flex: 1;
          padding: 12px 8px;
          font-size: 14px;
          font-weight: bold;
          border: none;
          border-bottom: 3px solid transparent;
          background: #1a1a33;
          color: #888899;
          cursor: pointer;
          font-family: Arial, sans-serif;
          transition: all 0.15s;
        ">⚔️ WEAPONS</button>
      </div>

      <div id="equip-items-scroll" style="
        flex: 1;
        overflow-y: auto;
        padding: 12px 16px;
        background: #1e1e38;
      ">
        <div id="equip-item-list"></div>
      </div>

      <div id="equip-footer" style="
        padding: 12px 20px;
        background: #16162a;
        border-top: 2px solid #333355;
        flex-shrink: 0;
        text-align: center;
      ">
        <div id="equip-ready-info" style="font-size: 12px; color: #888899; margin-bottom: 8px;"></div>
        <button id="equip-ready-btn" style="
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
          transition: all 0.15s;
        ">READY FOR BATTLE</button>
        <div id="equip-toast" style="
          font-size: 13px;
          color: #ff4444;
          margin-top: 8px;
          min-height: 18px;
        "></div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Tab switching
    const tabs = this.overlay.querySelectorAll(".equip-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const category = (tab as HTMLElement).dataset.category as EquipCategory;
        this.switchTab(category);
      });
    });

    // Ready button
    document.getElementById("equip-ready-btn")!.addEventListener("click", () => {
      this.toggleReady();
    });

    // Show bike tab by default
    this.renderItems("bike");
    this.updateReadyCount();
  }

  private switchTab(category: EquipCategory) {
    this.activeCategory = category;

    const tabs = this.overlay.querySelectorAll(".equip-tab");
    const colors: Record<EquipCategory, string> = {
      bike: "#4488ff",
      armor: "#16c79a",
      weapons: "#e94560",
    };
    const activeColor = colors[category];

    tabs.forEach((tab) => {
      const el = tab as HTMLElement;
      const isActive = el.dataset.category === category;
      el.style.borderBottomColor = isActive ? activeColor : "transparent";
      el.style.background = isActive ? "#222244" : "#1a1a33";
      el.style.color = isActive ? activeColor : "#888899";
    });

    this.renderItems(category);
  }

  private formatStats(item: EquipItem): string {
    const p = item.params;
    const tags: string[] = [];
    const tag = (label: string, color: string) =>
      `<span style="background:${color}22;color:${color};padding:1px 6px;border-radius:4px;font-weight:bold;">${label}</span>`;

    if (p.speed) tags.push(tag(`+${p.speed} Speed`, "#4488ff"));
    if (p.travel) tags.push(tag(`${p.travel}px Blink`, "#aa55ff"));
    if (p.damage) tags.push(tag(`${p.damage} Dmg`, "#e94560"));
    if (p.accuracy !== undefined) tags.push(tag(`${p.accuracy}% Acc`, "#ffcc22"));
    if (p.velocity) tags.push(tag(`${p.velocity} Vel`, "#ff8833"));
    if (p.range) tags.push(tag(`${p.range}px Range`, "#33ddee"));
    if (p.duration) tags.push(tag(`${(p.duration / 1000).toFixed(1)}s Effect`, "#16c79a"));
    if (p.mapEffect) tags.push(tag(`${(p.mapEffect.duration / 1000).toFixed(0)}s Zone`, "#ff66aa"));
    if (p.cooldown) tags.push(tag(`${(p.cooldown / 1000).toFixed(0)}s CD`, "#888899"));
    if (p.uses) tags.push(tag(`${p.uses} Uses`, "#888899"));
    if (p.turnBoost) tags.push(tag(`${Math.round((p.turnBoost - 1) * 100)}% Turn`, "#4488ff"));
    if (p.stunReduction) tags.push(tag(`-${(p.stunReduction / 1000).toFixed(1)}s Stun`, "#16c79a"));
    if (p.damageReduction) tags.push(tag(`-${p.damageReduction} Dmg Taken`, "#16c79a"));
    if (p.rearBlock) tags.push(tag(`${p.rearBlock}% Rear Block`, "#ffcc22"));
    if (p.boostDuration) tags.push(tag(`+${(p.boostDuration / 1000).toFixed(1)}s Boost`, "#ff8833"));

    return tags.join("");
  }

  private renderItems(category: EquipCategory) {
    const container = document.getElementById("equip-item-list")!;
    const items = EQUIP_ITEMS.filter((item) => item.category === category);
    const remaining = this.getRemainingBudget();

    container.innerHTML = items
      .map((item) => {
        const isSelected = this.selectedItems.has(item.id);
        const canAfford = isSelected || remaining >= item.price;
        const disabled = !canAfford || this.isReady;

        return `
          <div class="equip-item" data-id="${item.id}" style="
            display: flex;
            align-items: center;
            padding: 14px 12px;
            margin-bottom: 8px;
            background: ${isSelected ? "#2a2a55" : "#222244"};
            border: 2px solid ${isSelected ? "#4488ff" : "#333355"};
            border-radius: 10px;
            cursor: ${disabled && !isSelected ? "not-allowed" : "pointer"};
            opacity: ${disabled && !isSelected ? "0.45" : "1"};
            transition: all 0.15s;
          ">
            <div style="
              width: 28px;
              height: 28px;
              border: 3px solid ${isSelected ? "#4488ff" : "#555577"};
              border-radius: 6px;
              background: ${isSelected ? "#4488ff" : "transparent"};
              margin-right: 12px;
              flex-shrink: 0;
              position: relative;
            ">${isSelected ? `<svg viewBox="0 0 24 24" width="22" height="22" style="position:absolute;top:0;left:0;"><polyline points="4,12 10,18 20,6" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ""}</div>
            <div style="font-size: 24px; margin-right: 12px; flex-shrink: 0;">${item.icon}</div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 15px; font-weight: bold; color: #ffffff;">${item.name}</div>
              <div style="font-size: 12px; color: #888899; margin-top: 2px;">${item.description}</div>
              <div style="font-size: 11px; color: #667788; margin-top: 4px; display: flex; flex-wrap: wrap; gap: 6px;">${this.formatStats(item)}</div>
            </div>
            <div style="
              font-size: 16px;
              font-weight: bold;
              color: ${isSelected ? "#ffcc22" : canAfford ? "#16c79a" : "#ff4444"};
              margin-left: 12px;
              flex-shrink: 0;
            ">$${item.price}</div>
          </div>
        `;
      })
      .join("");

    // Attach click handlers
    container.querySelectorAll(".equip-item").forEach((el) => {
      el.addEventListener("click", () => {
        const itemId = (el as HTMLElement).dataset.id!;
        this.toggleItem(itemId);
      });
    });
  }

  private toggleItem(itemId: string) {
    if (this.isReady) return;

    const item = EQUIP_ITEMS.find((i) => i.id === itemId);
    if (!item) return;

    if (this.selectedItems.has(itemId)) {
      // Deselect
      this.selectedItems.delete(itemId);
    } else {
      // Check budget
      if (this.getRemainingBudget() < item.price) {
        this.showToast("Not enough budget!");
        return;
      }
      this.selectedItems.add(itemId);
    }

    // Tell server
    const socket = getSocket();
    socket.emit("toggleItem", itemId);

    // Re-render current tab and budget
    this.updateBudget();
    this.renderItems(this.activeCategory);
  }

  private updateBudget() {
    const remaining = this.getRemainingBudget();
    const budgetEl = document.getElementById("equip-budget");
    if (budgetEl) {
      budgetEl.textContent = `$${remaining}`;
      budgetEl.style.color = remaining > 300 ? "#16c79a" : remaining > 0 ? "#ffcc22" : "#ff4444";
    }
  }

  private toggleReady() {
    this.isReady = !this.isReady;

    const btn = document.getElementById("equip-ready-btn") as HTMLButtonElement;
    if (btn) {
      if (this.isReady) {
        btn.textContent = "WAITING FOR OTHERS...";
        btn.style.background = "#16c79a";
        btn.style.borderColor = "#16c79a";
        btn.style.color = "#ffffff";
      } else {
        btn.textContent = "READY FOR BATTLE";
        btn.style.background = "transparent";
        btn.style.borderColor = "#4488ff";
        btn.style.color = "#4488ff";
      }
    }

    const socket = getSocket();
    socket.emit("equipReady");

    // Re-render items (disables checkboxes when ready)
    this.renderItems(this.activeCategory);
  }

  private updateReadyCount() {
    const infoEl = document.getElementById("equip-ready-info");
    if (infoEl) {
      infoEl.textContent = "Select your gear, then hit ready when done";
    }
  }

  private showToast(message: string) {
    const el = document.getElementById("equip-toast");
    if (el) {
      el.textContent = message;
      setTimeout(() => {
        el.textContent = "";
      }, 3000);
    }
  }
}
