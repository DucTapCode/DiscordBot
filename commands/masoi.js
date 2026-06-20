import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder 
} from "discord.js";
import { createGame, getGame, deleteGame } from "../gameManager.js";
import { ALL_CHARACTERS, PRESETS, getRandomGif } from "../werewolfLogic.js";
import { getBalance, checkAndDeduct, addBalance, User } from "../database.js";

// --- CÁC HÀM KHỞI TẠO VÀ PHÂN VAI ---

// Phân vai trò dựa trên Deck và người chơi
function distributeRoles(players, deckConfig) {
  let rolePool = [];
  
  // Khai triển deckConfig thành mảng các vai trò
  for (const [roleName, count] of Object.entries(deckConfig)) {
    for (let i = 0; i < count; i++) {
      rolePool.push(roleName);
    }
  }

  // Shuffle rolePool bằng Fisher-Yates
  for (let i = rolePool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
  }

  // Phân vai trò cho từng người chơi
  players.forEach((player, idx) => {
    let role = "Dân Thường";
    if (idx < rolePool.length) {
      role = rolePool[idx];
    }
    player.role = role;
    player.isAlive = true;
    player.lastProtected = null; // Tránh bảo vệ trùng liên tiếp
    player.votedTarget = null;
    player.nightActed = false;
  });
}

// Kiểm tra điều kiện thắng
// Trả về 'Werewolves', 'Villagers', hoặc null
function checkWinCondition(players) {
  const alivePlayers = players.filter(p => p.isAlive);
  const wolfCount = alivePlayers.filter(p => ALL_CHARACTERS[p.role]?.faction === "Werewolves").length;
  const nonWolfCount = alivePlayers.length - wolfCount;

  if (wolfCount === 0) {
    return "Villagers"; // Dân làng thắng nếu hết Sói
  }
  if (wolfCount >= nonWolfCount) {
    return "Werewolves"; // Sói thắng nếu số Sói bằng hoặc lớn hơn số dân
  }
  return null;
}

// Định dạng danh sách người chơi trong phòng chờ
function formatPlayerList(players, creatorId) {
  return players.map((p, idx) => `${idx + 1}. **${p.name}**${p.id === creatorId ? " (Chủ phòng)" : ""}`).join("\n");
}

// --- KHỞI ĐỘNG COMMAND ---
export const data = new SlashCommandBuilder()
  .setName("masoi")
  .setDescription("Tạo phòng chơi game Ma Sói mở rộng (120 lá)!")
  .addIntegerOption(option =>
    option.setName("cuoc")
      .setDescription("Mức đặt cược của phòng chơi (mặc định là 100 chips)")
      .setRequired(false)
      .setMinValue(10)
  );

export async function execute(interaction) {
  const channelId = interaction.channelId;
  const existingGame = getGame(channelId);

  if (existingGame) {
    return interaction.reply({
      content: "⚠️ Kênh này đang có ván game diễn ra!",
      ephemeral: true
    });
  }

  const betAmount = interaction.options.getInteger("cuoc") || 100;
  await startWerewolfLobby(interaction, interaction.user, betAmount);
}

async function startWerewolfLobby(interaction, creator, betAmount) {
  const channelId = interaction.channelId;

  // Kiểm tra số dư chủ phòng
  const userBalance = await getBalance(creator.id, creator.username);
  if (userBalance < betAmount) {
    return interaction.reply({
      content: `⚠️ Thiếu chips! Cần: **${betAmount}**, có: **${userBalance}**.`,
      ephemeral: true
    });
  }

  // Khởi tạo trạng thái game Ma Sói
  const game = createGame(channelId, "masoi", creator);
  game.status = "WAITING";
  game.state = {
    betAmount,
    presetName: "basic",
    currentDeck: { ...PRESETS.basic },
    phase: "waiting",
    dayCount: 1,
    nightActions: {
      wolfKillVotes: {}, // userId -> targetId
      seerTarget: null,
      bodyguardTarget: null,
      witchSaveUsed: false,
      witchPoisonTarget: null,
    },
    votes: {}, // userId -> targetId
    boardMessageId: null
  };

  const embed = new EmbedBuilder()
    .setTitle("🐺 Phòng Chờ Ma Sói (120 Lá) 🐺")
    .setColor("#2c3e50")
    .setDescription(
      `Chủ phòng: **${creator.username}**\n` +
      `Mức cược: **${betAmount.toLocaleString()} chips**\n` +
      `Cấu hình Preset: **${game.state.presetName}**\n\n` +
      `**Danh sách người chơi:**\n${formatPlayerList(game.players, creator.id)}`
    )
    .setFooter({ text: "Chọn Preset bên dưới và nhấn Bắt Đầu khi đủ người chơi." });

  // Select menu chọn Preset
  const presetMenu = new StringSelectMenuBuilder()
    .setCustomId("masoi_select_preset")
    .setPlaceholder("Chọn cấu hình bộ bài mẫu...")
    .addOptions([
      { label: "Basic (8-10 người)", value: "basic", description: "Cấu hình chuẩn cho người mới chơi" },
      { label: "Chaos (12-15 người)", value: "chaos", description: "Hỗn loạn và nhiều chức năng đặc biệt" },
      { label: "Advanced (15+ người)", value: "advanced", description: "Cực kỳ thử thách cho cao thủ" }
    ]);

  const rowPreset = new ActionRowBuilder().addComponents(presetMenu);

  const rowButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("masoi_join").setLabel("Tham Gia").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("masoi_leave").setLabel("Rời Phòng").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("masoi_start").setLabel("Bắt Đầu").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("masoi_cancel").setLabel("Hủy Phòng").setStyle(ButtonStyle.Danger)
  );

  await interaction.reply({ embeds: [embed], components: [rowPreset, rowButtons] });
  const msg = await interaction.fetchReply();
  game.state.boardMessageId = msg.id;
}

// --- PHASE EMBEDS SENT TO CHANNEL ---

async function sendNightEmbed(interaction, game) {
  const embed = new EmbedBuilder()
    .setTitle(`🌑 ĐÊM THỨ ${game.state.dayCount}`)
    .setDescription("Trò chơi đã bắt đầu! Màn đêm buông xuống, dân làng chìm vào giấc ngủ...\n\nHãy nhấn nút bên dưới để xem vai trò và thực hiện chức năng của mình trong đêm nay.")
    .setColor("#2f3136")
    .setImage(getRandomGif("night"))
    .setFooter({ text: "Thời gian hành động: 90 giây" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("masoi_view_role").setLabel("Xem vai trò").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("masoi_village_status").setLabel("Tình hình trong làng").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("masoi_next_day").setLabel("Tiếp tục ban ngày (Host)").setStyle(ButtonStyle.Primary)
  );

  // Xóa tin nhắn cũ và gửi tin mới
  const channel = interaction.channel || await interaction.client.channels.fetch(interaction.channelId).catch(() => null);
  if (channel) {
    if (game.state.boardMessageId) {
      await channel.messages.fetch(game.state.boardMessageId).then(m => m.delete().catch(() => {})).catch(() => {});
    }
    const newMsg = await channel.send({ embeds: [embed], components: [row] });
    game.state.boardMessageId = newMsg.id;
  }
}

async function sendDayEmbed(interaction, game, announcements) {
  const embed = new EmbedBuilder()
    .setTitle(`☀️ NGÀY THỨ ${game.state.dayCount}`)
    .setDescription(`${announcements}\n\nDân làng hãy thảo luận trong 3 phút để tìm ra kẻ tình nghi. Sau đó, tiến hành biểu quyết treo cổ.`)
    .setColor("#f1c40f")
    .setImage(getRandomGif("day"))
    .setFooter({ text: "Thời gian thảo luận: 3 phút" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("masoi_village_status").setLabel("Tình hình trong làng").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("masoi_start_vote").setLabel("Bắt đầu biểu quyết (Host)").setStyle(ButtonStyle.Primary)
  );

  const channel = interaction.channel || await interaction.client.channels.fetch(interaction.channelId).catch(() => null);
  if (channel) {
    if (game.state.boardMessageId) {
      await channel.messages.fetch(game.state.boardMessageId).then(m => m.delete().catch(() => {})).catch(() => {});
    }
    const newMsg = await channel.send({ embeds: [embed], components: [row] });
    game.state.boardMessageId = newMsg.id;
  }
}

async function sendVoteEmbed(interaction, game) {
  const embed = new EmbedBuilder()
    .setTitle(`⚖️ NGÀY THỨ ${game.state.dayCount} - BIỂU QUYẾT`)
    .setDescription("Hãy bỏ phiếu cho người bạn nghi ngờ là Ma Sói.\n\n**Tình hình biểu quyết:**\n*(Chưa có ai bỏ phiếu)*")
    .setColor("#e74c3c")
    .setImage(getRandomGif("vote"))
    .setFooter({ text: "Bỏ phiếu treo cổ kẻ tình nghi" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("masoi_vote_button").setLabel("Bỏ Phiếu").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("masoi_village_status").setLabel("Tình hình trong làng").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("masoi_end_vote").setLabel("Kết thúc biểu quyết (Host)").setStyle(ButtonStyle.Primary)
  );

  const channel = interaction.channel || await interaction.client.channels.fetch(interaction.channelId).catch(() => null);
  if (channel) {
    if (game.state.boardMessageId) {
      await channel.messages.fetch(game.state.boardMessageId).then(m => m.delete().catch(() => {})).catch(() => {});
    }
    const newMsg = await channel.send({ embeds: [embed], components: [row] });
    game.state.boardMessageId = newMsg.id;
  }
}

// --- INTERACTION HANDLER ---

export async function handleInteraction(interaction) {
  const channelId = interaction.channelId;
  const customId = interaction.customId;
  const game = getGame(channelId);

  if (!game || game.type !== "masoi") {
    return interaction.reply({ content: "⚠️ Không tìm thấy ván Ma Sói ở kênh này.", ephemeral: true });
  }

  const betAmount = game.state.betAmount;

  // --- TRẠNG THÁI CHỜ (WAITING) ---
  if (game.status === "WAITING") {
    if (customId === "masoi_join") {
      if (game.players.some(p => p.id === interaction.user.id)) {
        return interaction.reply({ content: "⚠️ Bạn đã ở trong phòng!", ephemeral: true });
      }

      // Kiểm tra số dư
      const userBalance = await getBalance(interaction.user.id, interaction.user.username);
      if (userBalance < betAmount) {
        return interaction.reply({
          content: `⚠️ Thiếu chips! Cần: **${betAmount}**, có: **${userBalance}**.`,
          ephemeral: true
        });
      }

      game.players.push({
        id: interaction.user.id,
        name: interaction.user.username
      });

      const embed = new EmbedBuilder()
        .setTitle("🐺 Phòng Chờ Ma Sói (120 Lá) 🐺")
        .setColor("#2c3e50")
        .setDescription(
          `Chủ phòng: **${game.creatorName}**\n` +
          `Mức cược: **${betAmount.toLocaleString()} chips**\n` +
          `Cấu hình Preset: **${game.state.presetName}**\n\n` +
          `**Danh sách người chơi:**\n${formatPlayerList(game.players, game.creatorId)}`
        )
        .setFooter({ text: "Chọn Preset bên dưới và nhấn Bắt Đầu khi đủ người chơi." });

      await interaction.update({ embeds: [embed] });
    }

    else if (customId === "masoi_leave") {
      if (!game.players.some(p => p.id === interaction.user.id)) {
        return interaction.reply({ content: "⚠️ Bạn không ở trong phòng!", ephemeral: true });
      }
      if (interaction.user.id === game.creatorId) {
        return interaction.reply({ content: "⚠️ Chủ phòng không thể rời phòng. Hãy Hủy Phòng để giải tán.", ephemeral: true });
      }

      game.players = game.players.filter(p => p.id !== interaction.user.id);

      const embed = new EmbedBuilder()
        .setTitle("🐺 Phòng Chờ Ma Sói (120 Lá) 🐺")
        .setColor("#2c3e50")
        .setDescription(
          `Chủ phòng: **${game.creatorName}**\n` +
          `Mức cược: **${betAmount.toLocaleString()} chips**\n` +
          `Cấu hình Preset: **${game.state.presetName}**\n\n` +
          `**Danh sách người chơi:**\n${formatPlayerList(game.players, game.creatorId)}`
        )
        .setFooter({ text: "Chọn Preset bên dưới và nhấn Bắt Đầu khi đủ người chơi." });

      await interaction.update({ embeds: [embed] });
    }

    else if (customId === "masoi_select_preset") {
      if (interaction.user.id !== game.creatorId) {
        return interaction.reply({ content: "⚠️ Chỉ chủ phòng mới được chọn Preset!", ephemeral: true });
      }

      const selectedValue = interaction.values[0];
      game.state.presetName = selectedValue;
      game.state.currentDeck = { ...PRESETS[selectedValue] };

      const embed = new EmbedBuilder()
        .setTitle("🐺 Phòng Chờ Ma Sói (120 Lá) 🐺")
        .setColor("#2c3e50")
        .setDescription(
          `Chủ phòng: **${game.creatorName}**\n` +
          `Mức cược: **${betAmount.toLocaleString()} chips**\n` +
          `Cấu hình Preset: **${game.state.presetName}**\n\n` +
          `**Danh sách người chơi:**\n${formatPlayerList(game.players, game.creatorId)}`
        )
        .setFooter({ text: "Chọn Preset bên dưới và nhấn Bắt Đầu khi đủ người chơi." });

      await interaction.update({ embeds: [embed] });
    }

    else if (customId === "masoi_cancel") {
      if (interaction.user.id !== game.creatorId) {
        return interaction.reply({ content: "⚠️ Chỉ chủ phòng mới được hủy phòng!", ephemeral: true });
      }
      deleteGame(channelId);
      await interaction.update({ content: "❌ Phòng chơi đã bị hủy bởi chủ phòng.", embeds: [], components: [] });
    }

    else if (customId === "masoi_start") {
      if (interaction.user.id !== game.creatorId) {
        return interaction.reply({ content: "⚠️ Chỉ chủ phòng mới được bắt đầu game!", ephemeral: true });
      }

      if (game.players.length < 4) {
        return interaction.reply({ content: "⚠️ Cần tối thiểu 4 người chơi để bắt đầu!", ephemeral: true });
      }

      // Trừ tiền cược của tất cả mọi người
      for (const p of game.players) {
        const deducted = await checkAndDeduct(p.id, betAmount, p.name);
        if (!deducted) {
          return interaction.reply({
            content: `⚠️ **${p.name}** không đủ số dư cược!`,
            ephemeral: true
          });
        }
      }

      // Lưu tổng tiền Pot cược
      game.state.totalPot = betAmount * game.players.length;

      // Phân vai
      distributeRoles(game.players, game.state.currentDeck);

      // Chuyển sang chơi
      game.status = "PLAYING";
      game.state.phase = "night";
      await interaction.deferUpdate().catch(() => {});
      await sendNightEmbed(interaction, game);
    }
  }

  // --- TRẠNG THÁI ĐANG CHƠI (PLAYING) ---
  else if (game.status === "PLAYING") {

    // Nút "Tình hình trong làng"
    if (customId === "masoi_village_status") {
      const statusText = game.players.map((p, idx) => {
        if (p.isAlive) {
          return `🔹 **${p.name}**: [SỐNG]`;
        } else {
          return `💀 **${p.name}**: [CHẾT] (Vai trò: **${p.role}**)`;
        }
      }).join("\n");

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏘️ Tình Hình Dân Làng")
            .setDescription(statusText)
            .setColor("#34495e")
        ],
        ephemeral: true
      });
    }

    // Nút "Xem vai trò"
    else if (customId === "masoi_view_role") {
      const player = game.players.find(p => p.id === interaction.user.id);
      if (!player) {
        return interaction.reply({ content: "⚠️ Bạn không tham gia ván chơi!", ephemeral: true });
      }

      const roleDetail = ALL_CHARACTERS[player.role] || { faction: "Dân Làng", description: "Dân thường." };
      let actionRow = null;

      // Nếu người chơi còn sống và là ban đêm
      if (player.isAlive && game.state.phase === "night") {
        const aliveOthers = game.players.filter(p => p.isAlive && p.id !== player.id);

        if (roleDetail.faction === "Werewolves") {
          // Giao diện chọn nạn nhân cho Sói
          const wolfKillMenu = new StringSelectMenuBuilder()
            .setCustomId("masoi_action_wolf")
            .setPlaceholder("Chọn nạn nhân cắn đêm nay...")
            .addOptions(
              aliveOthers.map(p => ({ label: p.name, value: p.id }))
            );
          actionRow = new ActionRowBuilder().addComponents(wolfKillMenu);
        }
        else if (player.role === "Tiên Tri" && !player.nightActed) {
          const seerMenu = new StringSelectMenuBuilder()
            .setCustomId("masoi_action_seer")
            .setPlaceholder("Chọn người để soi bài...")
            .addOptions(
              aliveOthers.map(p => ({ label: p.name, value: p.id }))
            );
          actionRow = new ActionRowBuilder().addComponents(seerMenu);
        }
        else if (player.role === "Bảo Vệ" && !player.nightActed) {
          // Bảo Vệ có thể tự bảo vệ bản thân nhưng không được bảo vệ cùng 1 người 2 đêm liền
          const protectable = game.players.filter(p => p.isAlive && p.id !== player.lastProtected);
          if (protectable.length > 0) {
            const guardMenu = new StringSelectMenuBuilder()
              .setCustomId("masoi_action_guard")
              .setPlaceholder("Chọn người để bảo vệ...")
              .addOptions(
                protectable.map(p => ({ label: p.name, value: p.id }))
              );
            actionRow = new ActionRowBuilder().addComponents(guardMenu);
          }
        }
      }

      const roleEmbed = new EmbedBuilder()
        .setTitle(`🎭 Vai trò: ${player.role}`)
        .setDescription(
          `**Phe cánh:** ${roleDetail.faction === "Villagers" ? "Dân Làng" : roleDetail.faction === "Werewolves" ? "Ma Sói" : "Phe thứ ba (Độc Lập)"}\n` +
          `**Trạng thái:** ${player.isAlive ? "🟢 Còn sống" : "💀 Đã chết"}\n` +
          `**Chức năng:** ${roleDetail.description}`
        )
        .setColor(roleDetail.faction === "Werewolves" ? "#c0392b" : "#27ae60");

      return interaction.reply({
        embeds: [roleEmbed],
        components: actionRow ? [actionRow] : [],
        ephemeral: true
      });
    }

    // Hành động ban đêm của Sói
    else if (customId === "masoi_action_wolf") {
      const player = game.players.find(p => p.id === interaction.user.id);
      if (!player || ALL_CHARACTERS[player.role]?.faction !== "Werewolves") {
        return interaction.reply({ content: "⚠️ Bạn không thuộc phe Sói!", ephemeral: true });
      }

      const targetId = interaction.values[0];
      const targetPlayer = game.players.find(p => p.id === targetId);

      game.state.nightActions.wolfKillVotes[player.id] = targetId;

      // Thống kê bình bầu của Sói
      const votesText = Object.entries(game.state.nightActions.wolfKillVotes)
        .map(([voterId, tId]) => {
          const voter = game.players.find(p => p.id === voterId)?.name;
          const target = game.players.find(p => p.id === tId)?.name;
          return `• **${voter}** chọn cắn: **${target}**`;
        }).join("\n");

      await interaction.update({
        content: `✅ Bạn đã chọn cắn **${targetPlayer.name}**.\n\n**Ý kiến đàn Sói:**\n${votesText}`,
        components: []
      });
    }

    // Hành động ban đêm của Tiên Tri
    else if (customId === "masoi_action_seer") {
      const player = game.players.find(p => p.id === interaction.user.id);
      if (!player || player.role !== "Tiên Tri") {
        return interaction.reply({ content: "⚠️ Bạn không phải Tiên Tri!", ephemeral: true });
      }

      const targetId = interaction.values[0];
      const targetPlayer = game.players.find(p => p.id === targetId);
      const targetRoleDetail = ALL_CHARACTERS[targetPlayer.role];

      player.nightActed = true;
      const side = targetRoleDetail?.faction === "Werewolves" ? "Phe Ma Sói 🐺" : "Phe Dân Làng 🧑";

      await interaction.update({
        content: `🔮 Kết quả soi bài: **${targetPlayer.name}** thuộc **${side}**.`,
        components: []
      });
    }

    // Hành động ban đêm của Bảo Vệ
    else if (customId === "masoi_action_guard") {
      const player = game.players.find(p => p.id === interaction.user.id);
      if (!player || player.role !== "Bảo Vệ") {
        return interaction.reply({ content: "⚠️ Bạn không phải Bảo Vệ!", ephemeral: true });
      }

      const targetId = interaction.values[0];
      const targetPlayer = game.players.find(p => p.id === targetId);

      player.nightActed = true;
      player.lastProtected = targetId;
      game.state.nightActions.bodyguardTarget = targetId;

      await interaction.update({
        content: `🛡️ Bạn đã chọn bảo vệ **${targetPlayer.name}** đêm nay thành công.`,
        components: []
      });
    }

    // Host chuyển phase từ Đêm sang Ngày
    else if (customId === "masoi_next_day") {
      if (interaction.user.id !== game.creatorId) {
        return interaction.reply({ content: "⚠️ Chỉ chủ phòng mới được chuyển sang Ban Ngày!", ephemeral: true });
      }

      // Xử lý cắn người của Sói
      const votes = Object.values(game.state.nightActions.wolfKillVotes);
      let victimId = null;

      if (votes.length > 0) {
        // Tìm người bị vote nhiều nhất
        const frequency = {};
        votes.forEach(id => frequency[id] = (frequency[id] || 0) + 1);
        victimId = Object.keys(frequency).reduce((a, b) => frequency[a] > frequency[b] ? a : b);
      }

      let announcements = "Đêm qua đã trôi qua. Một bầu không khí tĩnh mịch bao trùm toàn bộ làng...";
      let diedCount = 0;

      // Bảo vệ cứu
      if (victimId) {
        if (game.state.nightActions.bodyguardTarget === victimId) {
          announcements += "\n🛡️ Đêm qua là một đêm yên bình, Bảo Vệ đã bảo vệ thành công nạn nhân của Sói!";
        } else {
          const victim = game.players.find(p => p.id === victimId);
          victim.isAlive = false;
          announcements += `\n💀 Sáng hôm sau, dân làng bàng hoàng phát hiện xác của **${victim.name}** (chức năng cũ: **${victim.role}**).`;
          diedCount++;
        }
      } else {
        announcements += "\n🟢 Đêm qua là một đêm hoàn toàn yên bình, không có bất kỳ ai bị sát hại.";
      }

      // Reset các hành động cho đêm kế tiếp
      game.players.forEach(p => {
        p.nightActed = false;
      });
      game.state.nightActions = {
        wolfKillVotes: {},
        seerTarget: null,
        bodyguardTarget: null,
        witchSaveUsed: false,
        witchPoisonTarget: null,
      };

      // Kiểm tra game kết thúc
      const winSide = checkWinCondition(game.players);
      if (winSide) {
        return handleGameOver(interaction, game, winSide);
      }

      game.state.phase = "day";
      await interaction.deferUpdate().catch(() => {});
      await sendDayEmbed(interaction, game, announcements);
    }

    // Host bắt đầu biểu quyết (chuyển sang vote)
    else if (customId === "masoi_start_vote") {
      if (interaction.user.id !== game.creatorId) {
        return interaction.reply({ content: "⚠️ Chỉ chủ phòng mới được chuyển sang biểu quyết!", ephemeral: true });
      }

      game.state.phase = "vote";
      game.state.votes = {};
      await interaction.deferUpdate().catch(() => {});
      await sendVoteEmbed(interaction, game);
    }

    // Nút Bỏ Phiếu
    else if (customId === "masoi_vote_button") {
      const player = game.players.find(p => p.id === interaction.user.id);
      if (!player || !player.isAlive) {
        return interaction.reply({ content: "⚠️ Bạn không thể bỏ phiếu (đã chết hoặc không tham gia)!", ephemeral: true });
      }

      const aliveOthers = game.players.filter(p => p.isAlive);
      const voteMenu = new StringSelectMenuBuilder()
        .setCustomId("masoi_cast_vote")
        .setPlaceholder("Chọn người bạn muốn treo cổ...")
        .addOptions(
          aliveOthers.map(p => ({ label: p.name, value: p.id }))
        );

      return interaction.reply({
        content: "Chọn người bạn nghi ngờ là Sói nhất bên dưới để treo cổ:",
        components: [new ActionRowBuilder().addComponents(voteMenu)],
        ephemeral: true
      });
    }

    // Người chơi chọn vote trong menu
    else if (customId === "masoi_cast_vote") {
      const player = game.players.find(p => p.id === interaction.user.id);
      if (!player || !player.isAlive) {
        return interaction.reply({ content: "⚠️ Bạn đã chết hoặc không có trong phòng!", ephemeral: true });
      }

      const targetId = interaction.values[0];
      game.state.votes[player.id] = targetId;

      await interaction.update({ content: "✅ Ghi nhận phiếu vote thành công!", components: [] });

      // Cập nhật hiển thị biểu quyết công khai trên kênh
      const voteCount = {};
      Object.values(game.state.votes).forEach(tId => {
        voteCount[tId] = (voteCount[tId] || 0) + 1;
      });

      const votingStatus = Object.entries(voteCount).map(([tId, count]) => {
        const targetName = game.players.find(p => p.id === tId)?.name;
        const voters = Object.entries(game.state.votes)
          .filter(([_, votedId]) => votedId === tId)
          .map(([voterId, _]) => `<@${voterId}>`)
          .join(", ");
        return `• **${targetName}**: **${count} phiếu** (từ ${voters})`;
      }).join("\n");

      const embed = new EmbedBuilder()
        .setTitle(`⚖️ NGÀY THỨ ${game.state.dayCount} - BIỂU QUYẾT`)
        .setDescription(`Hãy bỏ phiếu cho người bạn nghi ngờ là Ma Sói.\n\n**Tình hình biểu quyết:**\n${votingStatus || "Chưa có ai bỏ phiếu."}`)
        .setColor("#e74c3c")
        .setImage(getRandomGif("vote"))
        .setFooter({ text: "Bỏ phiếu treo cổ kẻ tình nghi" });

      const channel = interaction.channel || await interaction.client.channels.fetch(interaction.channelId).catch(() => null);
      if (channel) {
        const msg = await channel.messages.fetch(game.state.boardMessageId).catch(() => null);
        if (msg) {
          await msg.edit({ embeds: [embed] }).catch(() => {});
        }
      }
    }

    // Host kết thúc biểu quyết
    else if (customId === "masoi_end_vote") {
      if (interaction.user.id !== game.creatorId) {
        return interaction.reply({ content: "⚠️ Chỉ chủ phòng mới được kết thúc biểu quyết!", ephemeral: true });
      }

      const votes = Object.values(game.state.votes);
      let executedId = null;

      if (votes.length > 0) {
        const frequency = {};
        votes.forEach(id => frequency[id] = (frequency[id] || 0) + 1);
        const sorted = Object.entries(frequency).sort((a, b) => b[1] - a[1]);

        // Nếu cao nhất huề phiếu thì không có ai bị treo
        if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) {
          executedId = null;
        } else {
          executedId = sorted[0][0];
        }
      }

      let announceText = "";
      if (executedId) {
        const executed = game.players.find(p => p.id === executedId);
        executed.isAlive = false;
        announceText = `📢 Dân làng đã biểu quyết đồng lòng và treo cổ thành công **${executed.name}** (chức năng: **${executed.role}**).`;
      } else {
        announceText = "📢 Không có ai bị treo cổ ngày hôm nay (huề phiếu hoặc không ai bầu chọn).";
      }

      // Check điều kiện thắng
      const winSide = checkWinCondition(game.players);
      if (winSide) {
        return handleGameOver(interaction, game, winSide, announceText);
      }

      // Sang đêm kế tiếp
      game.state.dayCount++;
      game.state.phase = "night";
      
      const channel = interaction.channel || await interaction.client.channels.fetch(interaction.channelId).catch(() => null);
      if (channel) {
        await channel.send({ content: `${announceText}\n\n*Chuẩn bị chuyển sang đêm tiếp theo...*` });
      }

      setTimeout(async () => {
        await sendNightEmbed(interaction, game);
      }, 5000);
    }
  }
}

// --- XỬ LÝ KẾT THÚC GAME ---

async function handleGameOver(interaction, game, winSide, lastAnnouncement = "") {
  const totalPot = game.state.totalPot;
  const winners = [];
  const losers = [];

  game.players.forEach(p => {
    const roleDetail = ALL_CHARACTERS[p.role];
    const playerSide = roleDetail?.faction;

    if ((winSide === "Werewolves" && playerSide === "Werewolves") ||
        (winSide === "Villagers" && playerSide === "Villagers")) {
      winners.push(p);
    } else {
      losers.push(p);
    }
  });

  let balanceText = "";

  if (winners.length > 0) {
    const splitPot = Math.floor(totalPot / winners.length);
    for (const w of winners) {
      const newBal = await addBalance(w.id, splitPot, w.name);
      balanceText += `🏆 **${w.name}** (${w.role}): +${splitPot.toLocaleString()} chips (Số dư: ${newBal.toLocaleString()})\n`;
    }
    for (const l of losers) {
      const curBal = await getBalance(l.id, l.name);
      balanceText += `💀 **${l.name}** (${l.role}): -${game.state.betAmount.toLocaleString()} chips (Số dư: ${curBal.toLocaleString()})\n`;
    }
  } else {
    // Hoàn tiền nếu không ai thắng
    for (const p of game.players) {
      const newBal = await addBalance(p.id, game.state.betAmount, p.name);
      balanceText += `➖ **${p.name}** (${p.role}): Hoàn cược (Số dư: ${newBal.toLocaleString()})\n`;
    }
  }

  const resultEmbed = new EmbedBuilder()
    .setTitle("🏆 KẾT QUẢ TRẬN MA SÓI 🏆")
    .setDescription(
      `${lastAnnouncement}\n\n` +
      `🔥 Phe chiến thắng: **${winSide === "Werewolves" ? "Phe Ma Sói 🐺" : "Phe Dân Làng 🧑"}**\n` +
      `Tổng tiền thưởng Pot: **${totalPot.toLocaleString()} chips**\n\n` +
      `**Thay đổi số dư chi tiết:**\n${balanceText}`
    )
    .setColor(winSide === "Werewolves" ? "#c0392b" : "#27ae60");

  const channel = interaction.channel || await interaction.client.channels.fetch(interaction.channelId).catch(() => null);
  if (channel) {
    if (game.state.boardMessageId) {
      await channel.messages.fetch(game.state.boardMessageId).then(m => m.delete().catch(() => {})).catch(() => {});
    }

    deleteGame(game.channelId);

    await channel.send({ embeds: [resultEmbed] });
  }
}
