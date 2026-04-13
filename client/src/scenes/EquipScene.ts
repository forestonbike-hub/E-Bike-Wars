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

    // Movement
    if (p.speed) tags.push(tag(`+${p.speed} Speed`, "#4488ff"));
    if (p.pedalSpeed) tags.push(tag(`${p.pedalSpeed} Pedal Speed`, "#4488ff"));
    if (p.turnBoost) tags.push(tag(`+${Math.round((p.turnBoost - 1) * 100)}% Turn`, "#4488ff"));
    if (p.speedPenalty) tags.push(tag(`${Math.round((1 - p.speedPenalty) * 100)}% Slower`, "#ff4444"));
    if (p.turnPenalty) tags.push(tag(`${Math.round((1 - p.turnPenalty) * 100)}% Wider Turn`, "#ff4444"));
    if (p.travel) tags.push(tag(`${p.travel}px Blink`, "#aa55ff"));

    // Battery/energy
    if (p.batteryDuration) tags.push(tag(`${(p.batteryDuration / 1000).toFixed(0)}s Battery`, "#16c79a"));
    if (p.batteryDrain) tags.push(tag(`${Math.round((p.batteryDrain - 1) * 100)}% Faster Drain`, "#ff4444"));

    // Nitro
    if (p.nitroCooldown) tags.push(tag(`${(p.nitroCooldown / 1000).toFixed(0)}s Nitro CD`, "#ff8833"));

    // Combat
    if (p.damage) tags.push(tag(`${p.damage} Dmg`, "#e94560"));
    if (p.accuracy !== undefined) tags.push(tag(`${p.accuracy}% Acc`, "#ffcc22"));
    if (p.velocity) tags.push(tag(`${p.velocity} Vel`, "#ff8833"));
    if (p.range) tags.push(tag(`${p.range}px Range`, "#33ddee"));
    if (p.cooldown) tags.push(tag(`${(p.cooldown / 1000).toFixed(1)}s CD`, "#888899"));
    if (p.uses) tags.push(tag(`${p.uses} Uses`, "#888899"));
    if (p.regenTime) tags.push(tag(`${(p.regenTime / 1000).toFixed(0)}s Regen`, "#888899"));

    // Effects
    if (p.duration) tags.push(tag(`${(p.duration / 1000).toFixed(1)}s Effect`, "#16c79a"));
    if (p.mapEffect) tags.push(tag(`${(p.mapEffect.duration / 1000).toFixed(0)}s ${p.mapEffect.type} Zone`, "#ff66aa"));
    if (p.handlingPenalty && item.category === "weapons") tags.push(tag(`${Math.round((1 - p.handlingPenalty) * 100)}% Handling Hit`, "#e94560"));
    if (p.speedDebuff) tags.push(tag(`${Math.round((1 - p.speedDebuff) * 100)}% Speed Hit`, "#e94560"));

    // Defense
    if (p.damageReduction) tags.push(tag(`-${p.damageReduction} Dmg Taken`, "#16c79a"));
    if (p.shieldUses) tags.push(tag(`${p.shieldUses} Shields`, "#ffcc22"));
    if (p.shieldDuration) tags.push(tag(`${(p.shieldDuration / 1000).toFixed(0)}s Block`, "#ffcc22"));

    // Special
    if (p.nailVulnerability === "instant") tags.push(tag(`Pops on Nails`, "#ff4444"));
    if (p.nailVulnerability === "resistant") tags.push(tag(`Nail Resistant`, "#16c79a"));
    if (p.jousting) tags.push(tag(`Jousting`, "#aa55ff"));
    if (p.dogSpeed) tags.push(tag(`Dog: ${p.dogSpeed} Speed`, "#ff8833"));
    if (p.dogDuration) tags.push(tag(`${(p.dogDuration / 1000).toFixed(0)}s Active`, "#888899"));

    return tags.join("");
  }

  // Check if an item can be selected (prerequisites met, no exclusive conflict)
  private canSelectItem(itemId: string): { allowed: boolean; reason?: string } {
    const item = EQUIP_ITEMS.find((i) => i.id === itemId);
    if (!item) return { allowed: false, reason: "Item not found" };

    // Check prerequisite
    if (item.requires && !this.selectedItems.has(item.requires)) {
      const req = EQUIP_ITEMS.find((i) => i.id === item.requires);
      return { allowed: false, reason: `Requires ${req?.name || item.requires} first` };
    }

    // Check budget
    if (this.getRemainingBudget() < item.price) {
      return { allowed: false, reason: "Not enough budget" };
    }

    return { allowed: true };
  }

  // When selecting an exclusive item, deselect others in the same group
  private handleExclusiveGroup(item: EquipItem) {
    if (!item.exclusiveGroup) return;
    for (const otherId of Array.from(this.selectedItems)) {
      const other = EQUIP_ITEMS.find((i) => i.id === otherId);
      if (other && other.exclusiveGroup === item.exclusiveGroup && other.id !== item.id) {
        this.selectedItems.delete(otherId);
        const socket = getSocket();
        socket.emit("toggleItem", otherId);
      }
    }
  }

  // When deselecting an item, also deselect anything that requires it
  private handleRemoveDependents(itemId: string) {
    for (const otherId of Array.from(this.selectedItems)) {
      const other = EQUIP_ITEMS.find((i) => i.id === otherId);
      if (other && other.requires === itemId) {
        this.selectedItems.delete(otherId);
        const socket = getSocket();
        socket.emit("toggleItem", otherId);
      }
    }
  }

  private renderItems(category: EquipCategory) {
    const container = document.getElementById("equip-item-list")!;
    const items = EQUIP_ITEMS.filter((item) => item.category === category);
    const remaining = this.getRemainingBudget();

    container.innerHTML = items
      .map((item) => {
        const isSelected = this.selectedItems.has(item.id);
        const canAfford = isSelected || remaining >= item.price;
        const missingPrereq = item.requires && !this.selectedItems.has(item.requires);
        const isExcludedByOther = item.exclusiveGroup && !isSelected &&
          Array.from(this.selectedItems).some((id) => {
            const other = EQUIP_ITEMS.find((i) => i.id === id);
            return other && other.exclusiveGroup === item.exclusiveGroup;
          });
        const disabled = this.isReady || (!isSelected && (!canAfford || missingPrereq));

        // Build badge text
        let badge = "";
        if (item.upgradeLabel) {
          badge = `<span style="background:#ff883322;color:#ff8833;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:bold;margin-left:6px;">${item.upgradeLabel}</span>`;
        }
        if (item.exclusiveGroup) {
          badge += `<span style="background:#aa55ff22;color:#aa55ff;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:bold;margin-left:6px;">PICK ONE</span>`;
        }

        // Lock reason
        let lockReason = "";
        if (missingPrereq && !isSelected) {
          const req = EQUIP_ITEMS.find((i) => i.id === item.requires);
          lockReason = `<div style="font-size: 11px; color: #ff8833; margin-top: 3px;">Requires ${req?.name || "prerequisite"}</div>`;
        } else if (isExcludedByOther && !isSelected) {
          lockReason = `<div style="font-size: 11px; color: #aa55ff; margin-top: 3px;">Swap with current tire selection</div>`;
        }

        return `
          <div class="equip-item" data-id="${item.id}" style="
            display: flex;
            align-items: center;
            padding: 14px 12px;
            margin-bottom: 8px;
            background: ${isSelected ? "#2a2a55" : "#222244"};
            border: 2px solid ${isSelected ? "#4488ff" : isExcludedByOther ? "#aa55ff44" : "#333355"};
            border-radius: 10px;
            cursor: ${disabled && !isSelected && !isExcludedByOther ? "not-allowed" : "pointer"};
            opacity: ${disabled && !isSelected && missingPrereq ? "0.4" : "1"};
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
              <div style="font-size: 15px; font-weight: bold; color: #ffffff;">${item.name}${badge}</div>
              <div style="font-size: 12px; color: #888899; margin-top: 2px;">${item.description}</div>
              ${lockReason}
              <div style="font-size: 11px; color: #667788; margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px;">${this.formatStats(item)}</div>
            </div>
            <div style="
              font-size: 16px;
              font-weight: bold;
              color: ${isSelected ? "#ffcc22" : canAfford && !missingPrereq ? "#16c79a" : "#ff4444"};
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
      // Also remove anything that depends on this item
      this.handleRemoveDependents(itemId);

      const socket = getSocket();
      socket.emit("toggleItem", itemId);
    } else {
      // Check prerequisite
      if (item.requires && !this.selectedItems.has(item.requires)) {
        const req = EQUIP_ITEMS.find((i) => i.id === item.requires);
        this.showToast(`Buy ${req?.name || "prerequisite"} first!`);
        return;
      }

      // Check budget (account for exclusive swap refund)
      let effectiveCost = item.price;
      if (item.exclusiveGroup) {
        for (const otherId of this.selectedItems) {
          const other = EQUIP_ITEMS.find((i) => i.id === otherId);
          if (other && other.exclusiveGroup === item.exclusiveGroup) {
            effectiveCost -= other.price; // Refund the swapped item
          }
        }
      }

      if (this.getRemainingBudget() < effectiveCost) {
        this.showToast("Not enough budget!");
        return;
      }

      // Handle exclusive group (deselect conflicting item)
      this.handleExclusiveGroup(item);

      this.selectedItems.add(itemId);

      const socket = getSocket();
      socket.emit("toggleItem", itemId);
    }

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
