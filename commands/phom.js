import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from "discord.js";
import { createGame, getGame, deleteGame } from "../gameManager.js";
import { getBalance, checkAndDeduct, addBalance, User } from "../database.js";
import { freeAllInCache, processGameResult } from "../itemActivation.js";
import { getPhomCardValue, isValidMeld, findBestMelds, canEatCard, canSendCard } from "../phomLogic.js";
import { getRandomGif } from "../werewolfLogic.js";

// --- CÁC HÀM HELPER XỬ LÝ GAME PHỎM ---

// Tạo bộ bài Phỏm 52 lá
function createPhomDeck() {
  const suits = ["♠", "♣", "♦", "♥"];
  const values = [
    { value: "A" }, { value: "2" }, { value: "3" }, { value: "4" }, { value: "5" },
    { value: "6" }, { value: "7" }, { value: "8" }, { value: "9" }, { value: "10" },
    { value: "J" }, { value: "Q" }, { value: "K" }
  ];
  let deck = [];
  for (const suit of suits) {
    for (const val of values) {
      deck.push({ value: val.value, suit });
    }
  }

  // Xáo bài Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Sắp xếp bài Phỏm theo thứ tự tối ưu hiển thị (A=1, 2=2, ..., K=13)
function sortPhomCards(cards) {
  return [...cards].sort((a, b) => {
    const valA = getPhomCardValue(a);
    const valB = getPhomCardValue(b);
    if (valA !== valB) return valA - valB;
    const suitOrder = { "♠": 1, "♣": 2, "♦": 3, "♥": 4 };
    return suitOrder[a.suit] - suitOrder[b.suit];
  });
}

// Định dạng hiển thị mảng bài
function formatCardsList(cards) {
  if (!cards || cards.length === 0) return "*Không có*";
  return cards.map(c => `[${c.value}${c.suit}]`).join(" ");
}

// Xây dựng Embed hiển thị trạng thái bàn Phỏm
function buildPhomGameEmbed(game) {
  const activePlayer = game.players[game.state.turnIndex];
  const { round, pot, lastDiscard, betAmount } = game.state;

  let playerStatuses = "";
  game.players.forEach((p, idx) => {
    const isTurn = idx === game.state.turnIndex;
    const marker = isTurn ? "👉" : "👤";
    
    let eatenStr = p.eatenCards && p.eatenCards.length > 0 ? ` (Ăn: ${formatCardsList(p.eatenCards)})` : "";
    let discardsStr = p.discards && p.discards.length > 0 ? ` | Đã đánh: ${formatCardsList(p.discards)}` : " | Đã đánh: *Chưa đánh*";
    
    // Hiển thị Phỏm đã hạ (nếu có)
    let meldStr = "";
    if (p.melds && p.melds.length > 0) {
      meldStr = `\n  - *Phỏm đã hạ:* ` + p.melds.map(m => `{ ${formatCardsList(m)} }`).join(", ");
    }

    playerStatuses += `${marker} **${p.name}**: **${p.cards.length} lá** trên tay${eatenStr}${discardsStr}${meldStr}\n`;
  });

  const lastDiscardText = lastDiscard ? `[${lastDiscard.value}${lastDiscard.suit}] (của **${game.players.find(p => p.id === game.state.lastDiscardUserId)?.name}**)` : "*Chưa có*";

  const embed = new EmbedBuilder()
    .setTitle("🎴 Sòng Phỏm 🎴")
    .setColor("#1abc9c")
    .setDescription(
      `Vòng: \`${round}/4\` | Cược: **${betAmount.toLocaleString()}** | Pot: **${pot.toLocaleString()} chips**\n` +
      `Lá vừa đánh: ${lastDiscardText}\n\n` +
      `**Trạng thái:**\n${playerStatuses}\n` +
      `Lượt: **${activePlayer.name}** (${game.state.drawState === "DRAW_OR_EAT" ? "Ăn/Bốc" : "Đánh bài"})`
    )
    .setImage(getRandomGif("day"));

  return embed;
}

// Xây dựng các nút hành động cho Phỏm
function buildPhomGameButtons(game) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("phom_viewcards")
      .setLabel("Xem Bài Của Bạn")
      .setStyle(ButtonStyle.Primary)
  );
  return row;
}

// Sinh ra payload menu Đánh bài ẩn danh
function getPhomDiscardPayload(player) {
  const best = findBestMelds(player.cards);
  const embed = new EmbedBuilder()
    .setTitle("🃏 Bài Phỏm Trên Tay Bạn 🃏")
    .setColor("#1abc9c")
    .setDescription(
      `**Danh sách bài:** ${formatCardsList(player.cards)}\n` +
      `**Phỏm hiện có:** ` + (best.melds.length > 0 ? best.melds.map(m => `{ ${formatCardsList(m)} }`).join(", ") : "*Chưa ghép được phỏm nào*") + `\n` +
      `**Điểm rác ước tính:** **${best.score} điểm**\n\n` +
      `🟢 **Tới lượt bạn Đánh Bài!** Vui lòng chọn 1 lá bài dưới Select Menu để đánh:`
    );

  const menu = new StringSelectMenuBuilder()
    .setCustomId("phom_discardcard")
    .setPlaceholder("Chọn quân bài bạn muốn đánh...")
    .setMinValues(1)
    .setMaxValues(1);

  player.cards.forEach((card, idx) => {
    menu.addOptions({
      label: `${card.value}${card.suit}`,
      value: idx.toString()
    });
  });

  const row = new ActionRowBuilder().addComponents(menu);
  return { embeds: [embed], components: [row] };
}

// Thuật toán tự động Gửi Bài cuối trận
function runPhomSendCards(game) {
  let cardSent = true;
  while (cardSent) {
    cardSent = false;
    
    for (const player of game.players) {
      const best = findBestMelds(player.cards);
      if (best.melds.length === 0) continue; 
      
      const trashCards = best.trash;
      for (const card of trashCards) {
        for (const otherPlayer of game.players) {
          if (otherPlayer.id === player.id) continue;
          if (!otherPlayer.melds || otherPlayer.melds.length === 0) continue;
          
          for (let m = 0; m < otherPlayer.melds.length; m++) {
            const meld = otherPlayer.melds[m];
            if (canSendCard(meld, card)) {
              meld.push(card);
              player.cards = player.cards.filter(c => !(c.value === card.value && c.suit === card.suit));
              cardSent = true;
              break;
            }
          }
          if (cardSent) break;
        }
        if (cardSent) break;
      }
    }
  }
}

// Tính điểm, xác định thắng thua và phát thưởng Phỏm
async function finishPhomGame(interaction, game, immediateWinner = null) {
  const { pot, betAmount } = game.state;
  let winnerText = "";

  if (immediateWinner) {
    const newBal = await addBalance(immediateWinner.id, pot, immediateWinner.name);
    const winResult = await processGameResult(immediateWinner.id, true, betAmount, newBal);

    winnerText = `🏆 **${immediateWinner.name}** đạt **Ù (0 rác)**! Thắng Pot **${pot.toLocaleString()} chips**!\n` +
                 `Số dư: **${winResult.newBalance.toLocaleString()} chips**\n> ${winResult.message}\n\n`;

    for (const p of game.players) {
      if (p.id !== immediateWinner.id) {
        let refundText = "";
        let bal = 0;
        if (p.isFreeAllIn) {
          bal = await addBalance(p.id, betAmount, p.name);
          refundText = `Hoàn cược (Free All-In)`;
        } else {
          bal = await getBalance(p.id, p.name);
          refundText = `Mất -${betAmount.toLocaleString()} chips`;
        }
        const loseResult = await processGameResult(p.id, false, betAmount, bal);
        winnerText += `💀 **${p.name}** (Thua): ${refundText} (Số dư: **${loseResult.newBalance.toLocaleString()} chips**)\n> ${loseResult.message}\n\n`;
      }
    }
  } else {
    runPhomSendCards(game);

    const playerResults = game.players.map(p => {
      const best = findBestMelds(p.cards);
      const isMom = best.melds.length === 0;
      const score = isMom ? 999 : best.score;
      return { player: p, score, isMom, melds: best.melds, trash: best.trash };
    });

    const starterIndex = 0;
    playerResults.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      const orderA = (game.players.indexOf(a.player) - starterIndex + game.players.length) % game.players.length;
      const orderB = (game.players.indexOf(b.player) - starterIndex + game.players.length) % game.players.length;
      return orderA - orderB;
    });

    const winners = [playerResults[0]];
    const share = Math.floor(pot / winners.length);

    winnerText = `🔥 **KẾT QUẢ SO ĐIỂM** 🔥\n\n`;

    for (const r of winners) {
      const p = r.player;
      const newBal = await addBalance(p.id, share, p.name);
      const winResult = await processGameResult(p.id, true, betAmount, newBal);
      winnerText += `🏆 **${p.name}** thắng (${r.score === 999 ? "Móm" : r.score + "đ"}):\n` +
                    `> Phỏm: ` + (r.melds.length > 0 ? r.melds.map(m => `{ ${formatCardsList(m)} }`).join(", ") : "*Móm*") + ` | Rác: ${formatCardsList(r.trash)}\n` +
                    `> Nhận: **+${share.toLocaleString()} chips** (Số dư: **${winResult.newBalance.toLocaleString()}**)\n` +
                    `> ${winResult.message}\n\n`;
    }

    for (const r of playerResults) {
      const p = r.player;
      if (winners.some(w => w.player.id === p.id)) continue;

      let refundText = "";
      let bal = 0;
      if (p.isFreeAllIn) {
        bal = await addBalance(p.id, betAmount, p.name);
        refundText = `Hoàn cược (Free All-In)`;
      } else {
        bal = await getBalance(p.id, p.name);
        refundText = `Mất -${betAmount.toLocaleString()} chips`;
      }
      const loseResult = await processGameResult(p.id, false, betAmount, bal);

      winnerText += `💀 **${p.name}** thua (${r.score === 999 ? "Móm" : r.score + "đ"}):\n` +
                    `> Phỏm: ` + (r.melds.length > 0 ? r.melds.map(m => `{ ${formatCardsList(m)} }`).join(", ") : "*Móm*") + `\n` +
                    `> ${refundText} (Số dư: **${loseResult.newBalance.toLocaleString()}**)\n` +
                    `> ${loseResult.message}\n\n`;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle("🏁 Kết Quả Vòng Đấu Phỏm (Tá Lả) 🏁")
    .setColor("#1abc9c")
    .setDescription(winnerText)
    .setImage(getRandomGif("day"))
    .setTimestamp();

  const playAgainRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`phom_playagain_${game.creatorId}_${betAmount}`)
      .setLabel("Chơi Lại 🔄")
      .setStyle(ButtonStyle.Primary)
  );

  const isClickedFromBoard = (interaction.message.id === game.state.boardMessageId);
  if (isClickedFromBoard) {
    await interaction.deferUpdate().catch(() => {});
  } else {
    await interaction.update({ content: "🎉 Trận đấu đã kết thúc! Hãy xem kết quả trong kênh chat.", embeds: [], components: [] }).catch(() => {});
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

    await channel.send({ embeds: [embed], components: [playAgainRow] });
  }

  deleteGame(game.channelId);
}

// --- SLASH COMMAND CONFIG ---

export const data = new SlashCommandBuilder()
  .setName("phom")
  .setDescription("Tạo phòng chơi bài Phỏm (Tá Lả)!")
  .addIntegerOption(option => 
    option.setName("cuoc")
      .setDescription("Mức đặt cược phòng chơi (mặc định là 100 chips)")
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
  await startPhomLobby(interaction, interaction.user, betAmount);
}

async function startPhomLobby(interaction, creator, betAmount) {
  const channelId = interaction.channelId;

  // Hướng dẫn chơi lần đầu
  const [dbUser] = await User.findOrCreate({
    where: { discordId: creator.id },
    defaults: { username: creator.username, balance: 1000 }
  });

  if (!dbUser.hasPlayed) {
    dbUser.hasPlayed = true;
    await dbUser.save();

    const tutorialEmbed = new EmbedBuilder()
      .setTitle("🔰 HƯỚNG DẪN PHỎM 🔰")
      .setColor("#1abc9c")
      .setDescription(
        `• Ghép bài thành Phỏm (3-4 lá cùng số, hoặc sảnh đồng chất).\n` +
        `• Đi lượt: Ăn bài của người trước hoặc bốc bài từ Nọc, sau đó đánh ra 1 lá rác.\n` +
        `• Ù: Không còn bài rác nào (0 rác).\n` +
        `• Hạ bài: Sau 4 vòng, so điểm các lá rác (điểm thấp nhất thắng).`
      );
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [tutorialEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [tutorialEmbed], ephemeral: true });
    }
  }

  // Kiểm tra số dư chủ phòng
  const userBalance = await getBalance(creator.id, creator.username);
  if (userBalance < betAmount) {
    const payload = {
      content: `⚠️ Thiếu chips! Cần: **${betAmount}**, có: **${userBalance}**.`,
      ephemeral: true
    };
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(payload);
    } else {
      return interaction.reply(payload);
    }
  }

  const game = createGame(channelId, "phom", creator);
  game.status = "WAITING";
  game.state = {
    betAmount,
    pot: 0,
    round: 1,
    lastDiscard: null,
    lastDiscardUserId: null,
    drawState: "DRAW_OR_EAT",
    deck: []
  };

  game.players = [
    {
      id: creator.id,
      name: creator.username,
      cards: [],
      eatenCards: [],
      discards: [],
      melds: []
    }
  ];

  const embed = new EmbedBuilder()
    .setTitle("🃏 Phòng Chờ Phỏm 🃏")
    .setColor("#2c3e50")
    .setDescription(
      `Chủ phòng: **${creator.username}**\n` +
      `Mức cược: **${betAmount.toLocaleString()} chips**\n\n` +
      `**Người chơi:**\n1. ${creator.username}`
    )
    .setImage(getRandomGif("night"));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("phom_join")
      .setLabel("Tham Gia (Join)")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("phom_start")
      .setLabel("Bắt Đầu (Start)")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("phom_cancel")
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

  // Xử lý Chơi Lại
  if (customId.startsWith("phom_playagain_")) {
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

    return startPhomLobby(interaction, interaction.user, betAmount);
  }

  const game = getGame(channelId);
  if (!game || game.type !== "phom") {
    return interaction.reply({ content: "⚠️ Không tìm thấy phòng Phỏm.", ephemeral: true });
  }

  const betAmount = game.state.betAmount;

  // --- TRẠNG THÁI WAITING ---
  if (game.status === "WAITING") {
    if (customId === "phom_join") {
      if (game.players.some(p => p.id === interaction.user.id)) {
        return interaction.reply({ content: "⚠️ Bạn đã ở trong phòng!", ephemeral: true });
      }

      if (game.players.length >= 4) {
        return interaction.reply({ content: "⚠️ Phòng đã đầy (tối đa 4 người)!", ephemeral: true });
      }

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
        eatenCards: [],
        discards: [],
        melds: []
      });

      const playerList = game.players.map((p, idx) => `${idx + 1}. ${p.name}${p.id === game.creatorId ? " (Chủ phòng)" : ""}`).join("\n");
      const embed = new EmbedBuilder()
        .setTitle("🃏 Phòng Chờ Game Phỏm (Tá Lả) 🃏")
        .setColor("#2c3e50")
        .setDescription(
          `Mức đặt cược phòng: **${betAmount.toLocaleString()} chips**\n\n` +
          `**Danh sách người chơi:**\n${playerList}`
        )
        .setImage(getRandomGif("night"))
        .setFooter({ text: "Phòng chơi yêu cầu từ 2 đến 4 người chơi." })
        .setTimestamp();

      await interaction.update({ embeds: [embed] });
    }

    else if (customId === "phom_start") {
      if (interaction.user.id !== game.creatorId) {
        return interaction.reply({ content: "⚠️ Chỉ chủ phòng mới được bắt đầu!", ephemeral: true });
      }

      if (game.players.length < 2) {
        return interaction.reply({ content: "⚠️ Cần tối thiểu 2 người để bắt đầu!", ephemeral: true });
      }

      for (const p of game.players) {
        const freeAllIn = freeAllInCache.get(p.id);
        if (freeAllIn && freeAllIn.active) {
          p.isFreeAllIn = true;
          freeAllInCache.delete(p.id);
        }

        const isDeducted = await checkAndDeduct(p.id, betAmount, p.name);
        if (!isDeducted) {
          return interaction.reply({
            content: `⚠️ Không thể bắt đầu! **${p.name}** thiếu chips.`,
            ephemeral: true
          });
        }
      }

      game.status = "PLAYING";
      const deck = createPhomDeck();

      for (let i = 0; i < game.players.length; i++) {
        const count = i === 0 ? 10 : 9;
        game.players[i].cards = [];
        for (let j = 0; j < count; j++) {
          game.players[i].cards.push(deck.pop());
        }
        game.players[i].cards = sortPhomCards(game.players[i].cards);
      }

      game.state.deck = deck;
      game.state.pot = betAmount * game.players.length;
      game.state.round = 1;
      game.state.turnIndex = 0;
      game.state.drawState = "DISCARD";

      const starter = game.players[0];
      const startBest = findBestMelds(starter.cards);
      if (startBest.score === 0) {
        return finishPhomGame(interaction, game, starter);
      }

      const embed = buildPhomGameEmbed(game);
      const row = buildPhomGameButtons(game);

      await interaction.update({ embeds: [embed], components: [row] });
      game.state.boardMessageId = interaction.message.id;
    }

    else if (customId === "phom_cancel") {
      if (interaction.user.id !== game.creatorId) {
        return interaction.reply({ content: "⚠️ Chỉ chủ phòng mới được hủy!", ephemeral: true });
      }
      deleteGame(channelId);
      await interaction.update({ content: "❌ Phòng đã bị hủy.", embeds: [], components: [] });
    }
  }

  // --- TRẠNG THÁI PLAYING ---
  else if (game.status === "PLAYING") {
    const activePlayer = game.players[game.state.turnIndex];
    const lastDiscard = game.state.lastDiscard;

    if (customId === "phom_viewcards") {
      const player = game.players.find(p => p.id === interaction.user.id);
      if (!player) {
        return interaction.reply({ content: "⚠️ Bạn không tham gia ván Phỏm!", ephemeral: true });
      }

      const isMyTurn = (player.id === activePlayer.id);
      const drawState = game.state.drawState;

      const currentBest = findBestMelds(player.cards);
      
      const embed = new EmbedBuilder()
        .setTitle("🃏 Bài Phỏm Trên Tay Bạn 🃏")
        .setColor("#1abc9c")
        .setDescription(
          `**Danh sách bài:** ${formatCardsList(player.cards)}\n` +
          `**Phỏm hiện có:** ` + (currentBest.melds.length > 0 ? currentBest.melds.map(m => `{ ${formatCardsList(m)} }`).join(", ") : "*Chưa ghép được phỏm nào*") + `\n` +
          `**Điểm rác ước tính:** **${currentBest.score} điểm**\n\n` +
          (isMyTurn && drawState === "DISCARD" ? "🟢 **Tới lượt bạn Đánh Bài!** Vui lòng chọn 1 lá bài dưới Select Menu để đánh:" :
           isMyTurn && drawState === "DRAW_OR_EAT" ? "🟢 **Tới lượt bạn Bốc/Ăn Bài!** Chọn hành động trực tiếp dưới đây:" :
           "🔴 Đợi tới lượt đánh bài hoặc thực hiện Bốc/Ăn bài bên ngoài.")
        );

      if (isMyTurn && drawState === "DISCARD") {
        const menu = new StringSelectMenuBuilder()
          .setCustomId("phom_discardcard")
          .setPlaceholder("Chọn quân bài bạn muốn đánh...")
          .setMinValues(1)
          .setMaxValues(1);

        player.cards.forEach((card, idx) => {
          menu.addOptions({
            label: `${card.value}${card.suit}`,
            value: idx.toString()
          });
        });

        const row = new ActionRowBuilder().addComponents(menu);
        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      } else if (isMyTurn && drawState === "DRAW_OR_EAT") {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("phom_draw")
            .setLabel("Bốc Bài")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("phom_eat")
            .setLabel("Ăn Bài")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!lastDiscard || !canEatCard(player.cards, lastDiscard))
        );
        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
      return;
    }

    if (interaction.user.id !== activePlayer.id) {
      return interaction.reply({ content: "⚠️ Chưa tới lượt của bạn!", ephemeral: true });
    }

    // ---- HÀNH ĐỘNG BỐC BÀI ----
    if (customId === "phom_draw") {
      if (game.state.drawState !== "DRAW_OR_EAT") {
        return interaction.reply({ content: "⚠️ Đã bốc/ăn rồi, hãy Đánh bài!", ephemeral: true });
      }

      const newCard = game.state.deck.pop();
      activePlayer.cards.push(newCard);
      activePlayer.cards = sortPhomCards(activePlayer.cards);
      game.state.drawState = "DISCARD";

      const best = findBestMelds(activePlayer.cards);
      if (best.score === 0) {
        return finishPhomGame(interaction, game, activePlayer);
      }

      const isClickedFromBoard = (interaction.message.id === game.state.boardMessageId);
      const payload = getPhomDiscardPayload(activePlayer);

      if (isClickedFromBoard) {
        await interaction.reply({ ...payload, ephemeral: true });
      } else {
        await interaction.update(payload);
      }

      const embed = buildPhomGameEmbed(game);
      const row = buildPhomGameButtons(game);
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

    // ---- HÀNH ĐỘNG ĂN BÀI ----
    else if (customId === "phom_eat") {
      if (game.state.drawState !== "DRAW_OR_EAT") {
        return interaction.reply({ content: "⚠️ Đã bốc/ăn rồi, hãy Đánh bài!", ephemeral: true });
      }

      const discardCard = game.state.lastDiscard;
      if (!discardCard || !canEatCard(activePlayer.cards, discardCard)) {
        return interaction.reply({ content: "⚠️ Không thể ăn quân bài này!", ephemeral: true });
      }

      activePlayer.cards.push(discardCard);
      activePlayer.cards = sortPhomCards(activePlayer.cards);
      activePlayer.eatenCards = activePlayer.eatenCards || [];
      activePlayer.eatenCards.push(discardCard);

      const previousPlayer = game.players.find(p => p.id === game.state.lastDiscardUserId);
      if (previousPlayer) {
        previousPlayer.discards = previousPlayer.discards.filter(c => !(c.value === discardCard.value && c.suit === discardCard.suit));
      }

      game.state.lastDiscard = null;
      game.state.lastDiscardUserId = null;
      game.state.drawState = "DISCARD";

      const best = findBestMelds(activePlayer.cards);
      if (best.score === 0) {
        return finishPhomGame(interaction, game, activePlayer);
      }

      const isClickedFromBoard = (interaction.message.id === game.state.boardMessageId);
      const payload = getPhomDiscardPayload(activePlayer);

      if (isClickedFromBoard) {
        await interaction.reply({ ...payload, ephemeral: true });
      } else {
        await interaction.update(payload);
      }

      const embed = buildPhomGameEmbed(game);
      const row = buildPhomGameButtons(game);
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

    // ---- HÀNH ĐỘNG ĐÀNH BÀI (Select Menu) ----
    else if (interaction.isStringSelectMenu() && customId === "phom_discardcard") {
      if (game.state.drawState !== "DISCARD") {
        return interaction.reply({ content: "⚠️ Hãy Bốc hoặc Ăn bài trước khi Đánh!", ephemeral: true });
      }

      const selectedIdx = parseInt(interaction.values[0]);
      const discardedCard = activePlayer.cards[selectedIdx];

      activePlayer.cards.splice(selectedIdx, 1);
      activePlayer.discards = activePlayer.discards || [];
      activePlayer.discards.push(discardedCard);

      game.state.lastDiscard = discardedCard;
      game.state.lastDiscardUserId = activePlayer.id;

      const best = findBestMelds(activePlayer.cards);
      if (best.score === 0) {
        return finishPhomGame(interaction, game, activePlayer);
      }

      const allDone = game.players.every(p => p.discards.length === 4);
      if (allDone) {
        for (const p of game.players) {
          const pBest = findBestMelds(p.cards);
          p.melds = pBest.melds;
        }
        return finishPhomGame(interaction, game);
      }

      game.state.turnIndex = (game.state.turnIndex + 1) % game.players.length;
      game.state.drawState = "DRAW_OR_EAT";

      if (game.state.turnIndex === 0) {
        game.state.round += 1;
      }

      const embed = buildPhomGameEmbed(game);
      const row = buildPhomGameButtons(game);

      await interaction.update({ content: `✅ Bạn đã đánh lá bài [${discardedCard.value}${discardedCard.suit}] thành công!`, embeds: [], components: [] });

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
