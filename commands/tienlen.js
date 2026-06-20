import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from "discord.js";
import { createGame, getGame, deleteGame } from "../gameManager.js";
import { evaluateHand, canPlay, sortCards, compareCards } from "../tienLenLogic.js";
import { getBalance, checkAndDeduct, addBalance, User } from "../database.js";
import { freeAllInCache, processGameResult } from "../itemActivation.js";
import { getRandomGif } from "../werewolfLogic.js";

// --- CÁC HÀM HELPER XỬ LÝ BÀI TIẾN LÊN ---

// Tạo bộ bài Tiến Lên 52 lá
function createTienLenDeck() {
  const suits = ["♠", "♣", "♦", "♥"];
  const values = [
    { value: "3", rank: 3 },
    { value: "4", rank: 4 },
    { value: "5", rank: 5 },
    { value: "6", rank: 6 },
    { value: "7", rank: 7 },
    { value: "8", rank: 8 },
    { value: "9", rank: 9 },
    { value: "10", rank: 10 },
    { value: "J", rank: 11 },
    { value: "Q", rank: 12 },
    { value: "K", rank: 13 },
    { value: "A", rank: 14 },
    { value: "2", rank: 15 }
  ];

  let deck = [];
  for (const suit of suits) {
    for (const val of values) {
      deck.push({ value: val.value, suit, rank: val.rank });
    }
  }

  // Xáo bài Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Định dạng hiển thị mảng bài
function formatCardsList(cards) {
  if (!cards || cards.length === 0) return "*Chưa đánh bài*";
  return cards.map(c => `[${c.value}${c.suit}]`).join(" ");
}

// Chuyển lượt đi
function moveToNextTurn(game) {
  const players = game.players;
  let nextIndex = game.state.turnIndex;

  while (true) {
    nextIndex = (nextIndex + 1) % players.length;

    // Nếu quay lại đúng người chơi vừa ra bộ bài cuối cùng, vòng chơi kết thúc
    if (players[nextIndex].id === game.state.lastPlayedUserId) {
      game.state.lastPlayedCards = []; // Bắt đầu vòng mới
      // Reset trạng thái bỏ lượt của tất cả người chơi
      for (const p of players) {
        p.hasPassed = false;
      }
      game.state.turnIndex = nextIndex;
      return;
    }

    // Nếu người này chưa bỏ lượt và còn bài trên tay
    if (!players[nextIndex].hasPassed && players[nextIndex].cards.length > 0) {
      game.state.turnIndex = nextIndex;
      return;
    }
  }
}

// --- COMMAND MODULE ---

export const data = new SlashCommandBuilder()
  .setName("tienlen")
  .setDescription("Tạo phòng chơi bài Tiến Lên Miền Nam!")
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
  await startTienLenLobby(interaction, interaction.user, betAmount);
}

async function startTienLenLobby(interaction, creator, betAmount) {
  const channelId = interaction.channelId;

  // Kiểm tra người dùng chơi lần đầu để hiện hướng dẫn
  const [dbUser] = await User.findOrCreate({
    where: { discordId: creator.id },
    defaults: { username: creator.username, balance: 1000 }
  });

  if (!dbUser.hasPlayed) {
    dbUser.hasPlayed = true;
    await dbUser.save();

    const tutorialEmbed = new EmbedBuilder()
      .setTitle("🔰 HƯỚNG DẪN TIẾN LÊN 🔰")
      .setColor("#e74c3c")
      .setDescription(
        `• Mục tiêu: Đánh hết 13 lá bài trên tay nhanh nhất để thắng.\n` +
        `• Đi đầu ván 1: Người có lá 3♠.\n` +
        `• Luật đè: Đánh bộ cùng loại nhưng lớn hơn bộ trước.\n` +
        `• Chặt Heo: Dùng Tứ quý hoặc Đôi thông để chặt Heo (2).`
      );
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [tutorialEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [tutorialEmbed], ephemeral: true });
    }
  }

  // Kiểm tra số dư của chủ phòng
  const userBalance = await getBalance(creator.id, creator.username);
  if (userBalance < betAmount) {
    const replyPayload = {
      content: `⚠️ Thiếu chips! Cần: **${betAmount}**, có: **${userBalance}**.`,
      ephemeral: true
    };
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(replyPayload);
    } else {
      return interaction.reply(replyPayload);
    }
  }

  // Khởi tạo phòng chơi Tiến Lên mới
  const game = createGame(channelId, "tienlen", creator);
  game.status = "WAITING";
  game.state.betAmount = betAmount; // Lưu mức cược phòng

  const embed = new EmbedBuilder()
    .setTitle("🃏 Phòng Chờ Tiến Lên 🃏")
    .setColor("#2c3e50")
    .setDescription(
      `Chủ phòng: **${creator.username}**\n` +
      `Mức cược: **${betAmount.toLocaleString()} chips**\n\n` +
      `**Người chơi:**\n1. ${creator.username}`
    )
    .setImage(getRandomGif("night"));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tienlen_join")
      .setLabel("Tham Gia (Join)")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("tienlen_start")
      .setLabel("Bắt Đầu (Start)")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("tienlen_cancel")
      .setLabel("Hủy Phòng")
      .setStyle(ButtonStyle.Danger)
  );

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({ embeds: [embed], components: [row] });
  } else {
    await interaction.reply({ embeds: [embed], components: [row] });
  }
}

export async function handleInteraction(interaction) {
  const channelId = interaction.channelId;
  const customId = interaction.customId;

  // Xử lý nút bấm Chơi Lại
  if (customId.startsWith("tienlen_playagain_")) {
    const parts = customId.split("_");
    const creatorId = parts[2];
    const betAmount = parseInt(parts[3]);

    if (interaction.user.id !== creatorId) {
      return interaction.reply({ content: "⚠️ Bạn không phải chủ phòng!", ephemeral: true });
    }

    const existingGame = getGame(channelId);
    if (existingGame) {
      return interaction.reply({ content: "⚠️ Kênh này đang có ván game diễn ra.", ephemeral: true });
    }

    return startTienLenLobby(interaction, interaction.user, betAmount);
  }

  const game = getGame(channelId);
  if (!game || game.type !== "tienlen") {
    return interaction.reply({ content: "⚠️ Không tìm thấy ván Tiến Lên ở kênh này.", ephemeral: true });
  }

  const betAmount = game.state.betAmount;

  // --- TRẠNG THÁI PHÒNG CHỜ (WAITING) ---
  if (game.status === "WAITING") {
    if (customId === "tienlen_join") {
      // Kiểm tra xem đã có trong phòng chưa
      if (game.players.some(p => p.id === interaction.user.id)) {
        return interaction.reply({ content: "⚠️ Bạn đã ở trong phòng!", ephemeral: true });
      }

      if (game.players.length >= 4) {
        return interaction.reply({ content: "⚠️ Phòng đã đầy (tối đa 4 người)!", ephemeral: true });
      }

      // Kiểm tra số dư người tham gia
      const userBalance = await getBalance(interaction.user.id, interaction.user.username);
      if (userBalance < betAmount) {
        return interaction.reply({
          content: `⚠️ Thiếu chips! Cần: **${betAmount}**, có: **${userBalance}**.`,
          ephemeral: true
        });
      }

      game.players.push({
        id: interaction.user.id,
        name: interaction.user.username,
        cards: [],
        hasPassed: false
      });

      const playerList = game.players.map((p, idx) => `${idx + 1}. ${p.name}${p.id === game.creatorId ? " (Chủ phòng)" : ""}`).join("\n");
      const embed = new EmbedBuilder()
        .setTitle("🃏 Phòng Chờ Tiến Lên Miền Nam 🃏")
        .setColor("#2c3e50")
        .setDescription(
          `Mức đặt cược: **${betAmount.toLocaleString()} chips**\n\n` +
          `**Danh sách người chơi:**\n${playerList}`
        )
        .setImage(getRandomGif("night"))
        .setFooter({ text: "Yêu cầu tối thiểu 2 người chơi, tối đa 4 người chơi để bắt đầu." })
        .setTimestamp();

      await interaction.update({ embeds: [embed] });
    }

    else if (customId === "tienlen_start") {
      // Chỉ chủ phòng mới được bắt đầu
      if (interaction.user.id !== game.creatorId) {
        return interaction.reply({ content: "⚠️ Chỉ chủ phòng mới được bắt đầu!", ephemeral: true });
      }

      if (game.players.length < 2) {
        return interaction.reply({ content: "⚠️ Cần tối thiểu 2 người để bắt đầu!", ephemeral: true });
      }

      // TRỪ TIỀN CƯỢC CỦA MỌI NGƯỜI CHƠI
      for (const p of game.players) {
        const freeAllIn = freeAllInCache.get(p.id);
        if (freeAllIn && freeAllIn.active) {
          p.isFreeAllIn = true;
          freeAllInCache.delete(p.id); // Tiêu thụ trạng thái chờ
        }

        const isDeducted = await checkAndDeduct(p.id, betAmount, p.name);
        if (!isDeducted) {
          return interaction.reply({
            content: `⚠️ Không thể bắt đầu! **${p.name}** thiếu chips.`,
            ephemeral: true
          });
        }
      }

      // Chia bài
      game.status = "PLAYING";
      const deck = createTienLenDeck();
      
      for (let i = 0; i < game.players.length; i++) {
        game.players[i].cards = [];
        for (let j = 0; j < 13; j++) {
          game.players[i].cards.push(deck.pop());
        }
        game.players[i].cards = sortCards(game.players[i].cards);
      }

      // Tìm người đi đầu tiên (Có 3 Bích)
      let starterIndex = 0;
      let foundStarter = false;
      for (let i = 0; i < game.players.length; i++) {
        if (game.players[i].cards.some(c => c.rank === 3 && c.suit === "♠")) {
          starterIndex = i;
          foundStarter = true;
          break;
        }
      }

      if (!foundStarter) starterIndex = 0;

      // Tính tổng số tiền cược trong Pot
      const totalPot = betAmount * game.players.length;

      game.state = {
        turnIndex: starterIndex,
        lastPlayedCards: [],
        lastPlayedUserId: null,
        isFirstTurn: true,
        betAmount,
        totalPot
      };

      const starterPlayer = game.players[starterIndex];
      const embed = new EmbedBuilder()
        .setTitle("🔥 Tiến Lên Miền Nam - Bắt Đầu! 🔥")
        .setColor("#2ecc71")
        .setDescription(
          `Mức cược: **${betAmount.toLocaleString()}** | Pot: **${totalPot.toLocaleString()} chips**\n` +
          `Lượt đi: **${starterPlayer.name}** (có 3♠)\n\n` +
          `*Nhấp **Xem Bài Của Bạn** để chơi.*`
        )
        .setImage(getRandomGif("day"));

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("tienlen_viewcards")
          .setLabel("Xem Bài Của Bạn")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("tienlen_pass")
          .setLabel("Bỏ Lượt (Pass)")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.update({ embeds: [embed], components: [row] });
      game.state.boardMessageId = interaction.message.id;
    }

    else if (customId === "tienlen_cancel") {
      if (interaction.user.id !== game.creatorId) {
        return interaction.reply({ content: "⚠️ Chỉ chủ phòng mới được hủy phòng!", ephemeral: true });
      }
      deleteGame(channelId);
      await interaction.update({ content: "❌ Phòng chơi đã bị hủy bởi chủ phòng.", embeds: [], components: [] });
    }
  }

  // --- TRẠNG THÁI ĐANG CHƠI (PLAYING) ---
  else if (game.status === "PLAYING") {
    
    if (customId === "tienlen_viewcards") {
      const player = game.players.find(p => p.id === interaction.user.id);
      if (!player) {
        return interaction.reply({ content: "⚠️ Bạn không tham gia ván bài!", ephemeral: true });
      }

      if (player.cards.length === 0) {
        return interaction.reply({ content: "⚠️ Bạn đã đánh hết bài!", ephemeral: true });
      }

      const activePlayer = game.players[game.state.turnIndex];
      const isMyTurn = (player.id === activePlayer.id);

      const embed = new EmbedBuilder()
        .setTitle("🃏 Bài Trên Tay Của Bạn 🃏")
        .setColor("#9b59b6")
        .setDescription(
          `**Mức cược:** ${betAmount.toLocaleString()} chips | **Tổng tiền cược (Pot):** ${game.state.totalPot.toLocaleString()} chips\n` +
          `**Số lá còn lại:** ${player.cards.length} lá\n` +
          `**Danh sách bài:** ${formatCardsList(player.cards)}\n\n` +
          (isMyTurn ? "🟢 **Đang tới lượt của bạn!** Hãy chọn các lá bài muốn đánh bên dưới:" : "🔴 Chưa tới lượt của bạn. Hãy chờ đối thủ ra bài.")
        );

      if (isMyTurn) {
        const menu = new StringSelectMenuBuilder()
          .setCustomId("tienlen_playcards")
          .setPlaceholder("Chọn các lá bài muốn đánh...")
          .setMinValues(1)
          .setMaxValues(player.cards.length);

        player.cards.forEach((card, idx) => {
          menu.addOptions({
            label: `${card.value}${card.suit}`,
            value: idx.toString(),
            description: `Rank so sánh: ${card.rank}`
          });
        });

        const rowSelect = new ActionRowBuilder().addComponents(menu);
        const rowPass = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("tienlen_pass")
            .setLabel("Bỏ Lượt (Pass)")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(game.state.lastPlayedCards.length === 0)
        );

        await interaction.reply({ embeds: [embed], components: [rowSelect, rowPass], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    else if (customId === "tienlen_pass") {
      const player = game.players.find(p => p.id === interaction.user.id);
      if (!player) {
        return interaction.reply({ content: "⚠️ Bạn không tham gia ván bài!", ephemeral: true });
      }

      const activePlayer = game.players[game.state.turnIndex];
      if (player.id !== activePlayer.id) {
        return interaction.reply({ content: "⚠️ Chưa tới lượt của bạn!", ephemeral: true });
      }

      if (game.state.lastPlayedCards.length === 0) {
        return interaction.reply({ content: "⚠️ Vòng mới bắt đầu, không được bỏ lượt!", ephemeral: true });
      }

      player.hasPassed = true;

      const oldPlayerName = player.name;
      moveToNextTurn(game);
      const nextPlayer = game.players[game.state.turnIndex];

      const embed = new EmbedBuilder()
        .setTitle("🔥 Tiến Lên Miền Nam 🔥")
        .setColor("#e67e22")
        .setDescription(
          `🔴 **${oldPlayerName}** bỏ lượt.\n\n` +
          `**Bộ trên bàn:** ${formatCardsList(game.state.lastPlayedCards)} (bởi **${game.players.find(p => p.id === game.state.lastPlayedUserId)?.name || "?"}**)\n\n` +
          `👉 Lượt tiếp theo: **${nextPlayer.name}**`
        )
        .setImage(getRandomGif("day"));

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("tienlen_viewcards")
          .setLabel("Xem Bài Của Bạn")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("tienlen_pass")
          .setLabel("Bỏ Lượt (Pass)")
          .setStyle(ButtonStyle.Secondary)
      );

      const isClickedFromBoard = (interaction.message.id === game.state.boardMessageId);
      if (isClickedFromBoard) {
        await interaction.deferUpdate().catch(() => {});
      } else {
        await interaction.update({ content: "✅ Bạn đã chọn Bỏ Lượt!", embeds: [], components: [] }).catch(() => {});
      }

      // Xoá tin nhắn cũ
      const channel = interaction.channel || await interaction.client.channels.fetch(interaction.channelId).catch(() => null);
      if (channel) {
        const oldMsgId = game.state.boardMessageId;
        if (oldMsgId) {
          await channel.messages.fetch(oldMsgId).then(async (msg) => {
            await msg.delete().catch(() => {});
          }).catch(() => {});
        }

        const newMsg = await channel.send({ embeds: [embed], components: [row] });
        game.state.boardMessageId = newMsg.id;
      }
    }

    else if (interaction.isStringSelectMenu() && customId === "tienlen_playcards") {
      const player = game.players.find(p => p.id === interaction.user.id);
      const activePlayer = game.players[game.state.turnIndex];

      if (!player || player.id !== activePlayer.id) {
        return interaction.reply({ content: "⚠️ Chưa tới lượt của bạn!", ephemeral: true });
      }

      const selectedIndices = interaction.values.map(v => parseInt(v));
      const selectedCards = selectedIndices.map(idx => player.cards[idx]);

      if (game.state.isFirstTurn) {
        const hasThreeSpade = selectedCards.some(c => c.rank === 3 && c.suit === "♠");
        if (!hasThreeSpade) {
          return interaction.reply({
            content: "⚠️ Lượt đầu phải đánh 3 Bích (3♠)!",
            ephemeral: true
          });
        }
      }

      const canPlayCard = canPlay(selectedCards, game.state.lastPlayedCards);
      if (!canPlayCard) {
        return interaction.reply({
          content: "⚠️ Bộ chọn không hợp lệ hoặc không đè được bộ cũ!",
          ephemeral: true
        });
      }

      // Đánh bài thành công
      game.state.isFirstTurn = false;
      game.state.lastPlayedCards = selectedCards;
      game.state.lastPlayedUserId = player.id;

      player.cards = player.cards.filter((_, idx) => !selectedIndices.includes(idx));

      // Kiểm tra người chơi HẾT BÀI và chiến thắng
      if (player.cards.length === 0) {
        const totalPot = game.state.totalPot;
        
        // Cộng tổng tiền Pot (chips cược của tất cả mọi người) cho người về Nhất
        const newBalance = await addBalance(player.id, totalPot, player.name);
        const winnerResult = await processGameResult(player.id, true, betAmount, newBalance);

        let detailsText = "";
        for (const p of game.players) {
          if (p.id === player.id) {
            detailsText += `🏆 **${p.name}** (Thắng): +${totalPot.toLocaleString()} chips (Số dư: ${winnerResult.newBalance.toLocaleString()})\n> ${winnerResult.message}\n\n`;
          } else {
            let refundText = "";
            let balance = 0;
            if (p.isFreeAllIn) {
              balance = await addBalance(p.id, betAmount, p.name);
              refundText = `Hoàn cược (Free All-In)`;
            } else {
              balance = await getBalance(p.id, p.name);
              refundText = `Mất -${betAmount.toLocaleString()} chips`;
            }
            const loserResult = await processGameResult(p.id, false, betAmount, balance);
            detailsText += `💀 **${p.name}** (Thua): ${refundText} (Số dư: ${loserResult.newBalance.toLocaleString()})\n> ${loserResult.message}\n\n`;
          }
        }

        const winEmbed = new EmbedBuilder()
          .setTitle("🏆 KẾT QUẢ TIẾN LÊN 🏆")
          .setColor("#f1c40f")
          .setDescription(
            `🎉 **${player.name}** đã đánh hết bài và giành chiến thắng!\n\n` +
            `${detailsText}`
          )
          .setImage(getRandomGif("day"));

        const playAgainRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`tienlen_playagain_${game.creatorId}_${betAmount}`)
            .setLabel("Chơi Lại 🔄")
            .setStyle(ButtonStyle.Primary)
        );

        deleteGame(channelId);

        // Xoá tin nhắn cũ
        const channel = interaction.channel || await interaction.client.channels.fetch(interaction.channelId).catch(() => null);
        if (channel) {
          const oldMsgId = game.state.boardMessageId;
          if (oldMsgId) {
            await channel.messages.fetch(oldMsgId).then(async (msg) => {
              await msg.delete().catch(() => {});
            }).catch(() => {});
          }

          await channel.send({ embeds: [winEmbed], components: [playAgainRow] });
        }
        return interaction.update({ content: "🎉 Trận đấu đã kết thúc! Hãy xem kết quả trong kênh chat.", embeds: [], components: [] }).catch(() => {});
      }

      // Chuyển lượt đi
      const prevPlayerName = player.name;
      moveToNextTurn(game);
      const nextPlayer = game.players[game.state.turnIndex];

      const embed = new EmbedBuilder()
        .setTitle("🔥 Tiến Lên Miền Nam 🔥")
        .setColor("#2ecc71")
        .setDescription(
          `🟢 **${prevPlayerName}** đánh: ${formatCardsList(selectedCards)} (Còn lại: ${player.cards.length} lá)\n\n` +
          `👉 Lượt tiếp theo: **${nextPlayer.name}**`
        )
        .setImage(getRandomGif("day"));

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("tienlen_viewcards")
          .setLabel("Xem Bài Của Bạn")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("tienlen_pass")
          .setLabel("Bỏ Lượt (Pass)")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.update({ content: `✅ Bạn đã đánh bộ bài: ${formatCardsList(selectedCards)} thành công! Lượt đi đã được chuyển.`, embeds: [], components: [] });
      
      // Xoá tin nhắn cũ
      const channel = interaction.channel || await interaction.client.channels.fetch(interaction.channelId).catch(() => null);
      if (channel) {
        const oldMsgId = game.state.boardMessageId;
        if (oldMsgId) {
          await channel.messages.fetch(oldMsgId).then(async (msg) => {
            await msg.delete().catch(() => {});
          }).catch(() => {});
        }

        const newMsg = await channel.send({ embeds: [embed], components: [row] });
        game.state.boardMessageId = newMsg.id;
      }
    }
  }
}
