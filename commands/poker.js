import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { createGame, getGame, deleteGame } from "../gameManager.js";
import { getBalance, checkAndDeduct, addBalance, User } from "../database.js";
import { freeAllInCache, processGameResult } from "../itemActivation.js";
import { evaluate7CardHand, getCardScore } from "../pokerLogic.js";
import { getRandomGif } from "../werewolfLogic.js";

// --- CÁC HÀM HELPER XỬ LÝ BÀI POKER ---

// Tạo bộ bài Poker 52 lá
function createPokerDeck() {
  const suits = ["♠", "♣", "♦", "♥"];
  const values = [
    { value: "2" }, { value: "3" }, { value: "4" }, { value: "5" },
    { value: "6" }, { value: "7" }, { value: "8" }, { value: "9" },
    { value: "10" }, { value: "J" }, { value: "Q" }, { value: "K" }, { value: "A" }
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

// Định dạng hiển thị mảng bài
function formatCardsList(cards) {
  if (!cards || cards.length === 0) return "*Chưa có*";
  return cards.map(c => `[${c.value}${c.suit}]`).join(" ");
}

// Xây dựng Embed hiển thị trạng thái bàn Poker
function buildPokerGameEmbed(game) {
  const activePlayer = game.players[game.state.turnIndex];
  const { round, pot, communityCards, betAmount } = game.state;

  let playerStatuses = "";
  game.players.forEach((p, idx) => {
    const isTurn = idx === game.state.turnIndex;
    const marker = isTurn ? "👉" : "👤";
    if (p.folded) {
      playerStatuses += `💀 **${p.name}**: Đã Úp bài (Folded)\n`;
    } else {
      playerStatuses += `${marker} **${p.name}**: Bet vòng này: **${p.roundBet.toLocaleString()} chips** (Tổng bet: ${p.totalBet.toLocaleString()} chips)\n`;
    }
  });

  const embed = new EmbedBuilder()
    .setTitle("♣️ Poker Texas Hold'em ♥️")
    .setColor("#9b59b6")
    .setDescription(
      `Vòng: \`${round}\` | Cược: **${betAmount.toLocaleString()}** | Pot: **${pot.toLocaleString()} chips**\n` +
      `Bài chung: ${formatCardsList(communityCards)}\n\n` +
      `**Người chơi:**\n${playerStatuses}\n` +
      `Lượt: **${activePlayer.name}**`
    )
    .setImage(getRandomGif("day"));

  return embed;
}

// Xây dựng các nút hành động cho Poker
function buildPokerGameButtons(game, isEphemeral = false) {
  const activePlayer = game.players[game.state.turnIndex];
  const maxRoundBet = game.state.maxRoundBet;
  const playerBet = activePlayer.roundBet;
  const betAmount = game.state.betAmount;

  const components = [];
  if (!isEphemeral) {
    components.push(
      new ButtonBuilder()
        .setCustomId("poker_viewcards")
        .setLabel("Xem Bài Của Bạn")
        .setStyle(ButtonStyle.Primary)
    );
  }

  components.push(
    new ButtonBuilder()
      .setCustomId("poker_check")
      .setLabel("Check (Xem)")
      .setStyle(ButtonStyle.Success)
      .setDisabled(playerBet !== maxRoundBet),

    new ButtonBuilder()
      .setCustomId("poker_call")
      .setLabel(`Call (Theo: ${(maxRoundBet - playerBet).toLocaleString()})`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(playerBet === maxRoundBet),

    new ButtonBuilder()
      .setCustomId("poker_raise")
      .setLabel(`Raise (+${betAmount.toLocaleString()})`)
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("poker_fold")
      .setLabel("Fold (Úp)")
      .setStyle(ButtonStyle.Danger)
  );

  return new ActionRowBuilder().addComponents(components);
}

function startNextBettingRound(game) {
  for (const p of game.players) {
    p.roundBet = 0;
    p.hasActed = false;
  }
  game.state.maxRoundBet = 0;
  
  // Lượt đầu tiên thuộc về người chơi đầu tiên chưa fold
  let firstActiveIndex = 0;
  for (let i = 0; i < game.players.length; i++) {
    if (!game.players[i].folded) {
      firstActiveIndex = i;
      break;
    }
  }
  game.state.turnIndex = firstActiveIndex;
}

function advancePokerRound(game) {
  const { deck, communityCards } = game.state;
  if (game.state.round === "PREFLOP") {
    game.state.round = "FLOP";
    deck.pop(); // Burn card
    communityCards.push(deck.pop(), deck.pop(), deck.pop());
    startNextBettingRound(game);
  } else if (game.state.round === "FLOP") {
    game.state.round = "TURN";
    deck.pop(); // Burn card
    communityCards.push(deck.pop());
    startNextBettingRound(game);
  } else if (game.state.round === "TURN") {
    game.state.round = "RIVER";
    deck.pop(); // Burn card
    communityCards.push(deck.pop());
    startNextBettingRound(game);
  } else if (game.state.round === "RIVER") {
    game.state.round = "SHOWDOWN";
  }
}

// Chuyển lượt chơi và kiểm tra hoàn thành vòng cược
function moveToNextPokerTurn(game) {
  const players = game.players;
  let nextIndex = game.state.turnIndex;

  const nonFolded = players.filter(p => !p.folded);
  const allActedAndMatched = nonFolded.every(p => p.hasActed && p.roundBet === game.state.maxRoundBet);

  if (allActedAndMatched) {
    advancePokerRound(game);
    if (game.state.round === "SHOWDOWN") {
      return true; // Cần dừng để showdown kết thúc ván
    }
    return false;
  }

  // Chuyển sang người tiếp theo chưa Fold
  while (true) {
    nextIndex = (nextIndex + 1) % players.length;
    if (!players[nextIndex].folded) {
      game.state.turnIndex = nextIndex;
      break;
    }
  }
  return false;
}

// Đóng gói kết quả ván Poker và phát thưởng
async function finishPokerGame(interaction, game) {
  const { pot, communityCards, betAmount } = game.state;
  const nonFolded = game.players.filter(p => !p.folded);

  let winnerText = "";

  if (nonFolded.length === 1) {
    // 1. Chỉ còn 1 người duy nhất chưa Fold -> Thắng toàn bộ Pot
    const winner = nonFolded[0];
    const newBal = await addBalance(winner.id, pot, winner.name);
    const winResult = await processGameResult(winner.id, true, betAmount, newBal);

    winnerText = `🏆 **${winner.name}** thắng Pot **${pot.toLocaleString()} chips** (mọi người đã Fold)!\n` +
                 `Số dư: **${winResult.newBalance.toLocaleString()} chips**\n> ${winResult.message}\n\n`;

    for (const p of game.players) {
      if (p.id !== winner.id) {
        let refundText = "";
        let bal = 0;
        if (p.isFreeAllIn) {
          bal = await addBalance(p.id, betAmount, p.name);
          refundText = `Hoàn cược (Free All-In)`;
        } else {
          bal = await getBalance(p.id, p.name);
          refundText = `Mất -${p.totalBet.toLocaleString()} chips`;
        }
        const loseResult = await processGameResult(p.id, false, betAmount, bal);
        winnerText += `💀 **${p.name}** (Fold): ${refundText} (Số dư: **${loseResult.newBalance.toLocaleString()}**)\n> ${loseResult.message}\n\n`;
      }
    }
  } else {
    // 2. So bài (Showdown)
    const results = nonFolded.map(p => {
      const best = evaluate7CardHand([...p.cards, ...communityCards]);
      return { player: p, best };
    });

    // Sắp xếp bài từ cao xuống thấp
    results.sort((a, b) => b.best.score - a.best.score);
    const maxScore = results[0].best.score;
    const winners = results.filter(r => r.best.score === maxScore);

    // Chia đều Pot nếu hoà (Split Pot)
    const share = Math.floor(pot / winners.length);

    winnerText = `🔥 **KẾT QUẢ SHOWDOWN** 🔥\n\n`;

    for (const r of winners) {
      const p = r.player;
      const newBal = await addBalance(p.id, share, p.name);
      const winResult = await processGameResult(p.id, true, betAmount, newBal);
      winnerText += `🏆 **${p.name}** thắng **+${share.toLocaleString()} chips** (${r.best.label}):\n` +
                    `> Bài: ${formatCardsList(r.best.cards)}\n` +
                    `> Số dư: **${winResult.newBalance.toLocaleString()} chips**\n> ${winResult.message}\n\n`;
    }

    for (const r of results) {
      const p = r.player;
      if (winners.some(w => w.player.id === p.id)) continue;

      let refundText = "";
      let bal = 0;
      if (p.isFreeAllIn) {
        bal = await addBalance(p.id, betAmount, p.name);
        refundText = `Hoàn cược (Free All-In)`;
      } else {
        bal = await getBalance(p.id, p.name);
        refundText = `Mất -${p.totalBet.toLocaleString()} chips`;
      }
      const loseResult = await processGameResult(p.id, false, betAmount, bal);

      winnerText += `💀 **${p.name}** thua (${r.best.label}):\n` +
                    `> Bài tẩy: ${formatCardsList(p.cards)}\n` +
                    `> ${refundText} (Số dư: **${loseResult.newBalance.toLocaleString()} chips**)\n> ${loseResult.message}\n\n`;
    }

    for (const p of game.players) {
      if (p.folded) {
        let refundText = "";
        let bal = 0;
        if (p.isFreeAllIn) {
          bal = await addBalance(p.id, betAmount, p.name);
          refundText = `Hoàn cược (Free All-In)`;
        } else {
          bal = await getBalance(p.id, p.name);
          refundText = `Mất -${p.totalBet.toLocaleString()} chips`;
        }
        const loseResult = await processGameResult(p.id, false, betAmount, bal);
        winnerText += `💀 **${p.name}** (Folded trước đó): ${refundText} (Số dư: **${loseResult.newBalance.toLocaleString()} chips**)\n> ${loseResult.message}\n\n`;
      }
    }
  }

  const embed = new EmbedBuilder()
    .setTitle("🏁 Kết Quả Ván Đấu Texas Hold'em Poker 🏁")
    .setColor("#e74c3c")
    .setDescription(winnerText)
    .addFields(
      { name: "Bài chung trên bàn", value: formatCardsList(communityCards) }
    )
    .setImage(getRandomGif("day"))
    .setTimestamp();

  const playAgainRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`poker_playagain_${game.creatorId}_${betAmount}`)
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

// --- SLASH COMMAND EXPORTS ---

export const data = new SlashCommandBuilder()
  .setName("poker")
  .setDescription("Tạo phòng chơi Texas Hold'em Poker!")
  .addIntegerOption(option => 
    option.setName("cuoc")
      .setDescription("Mức đặt cược tối thiểu (mặc định là 100 chips)")
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
  await startPokerLobby(interaction, interaction.user, betAmount);
}

async function startPokerLobby(interaction, creator, betAmount) {
  const channelId = interaction.channelId;

  // Kiểm tra hướng dẫn chơi lần đầu
  const [dbUser] = await User.findOrCreate({
    where: { discordId: creator.id },
    defaults: { username: creator.username, balance: 1000 }
  });

  if (!dbUser.hasPlayed) {
    dbUser.hasPlayed = true;
    await dbUser.save();

    const tutorialEmbed = new EmbedBuilder()
      .setTitle("🔰 HƯỚNG DẪN POKER 🔰")
      .setColor("#9b59b6")
      .setDescription(
        `• Mục tiêu: Ghép 5 lá bài mạnh nhất từ 2 lá tẩy + 5 lá chung.\n` +
        `• 4 vòng cược: Pre-flop, Flop, Turn, River.\n` +
        `• Các hành động: Check (Xem), Call (Theo), Raise (Tăng cược), Fold (Úp bài).`
      );
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [tutorialEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [tutorialEmbed], ephemeral: true });
    }
  }

  // Kiểm tra số dư người tạo phòng
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

  const game = createGame(channelId, "poker", creator);
  game.status = "WAITING";
  game.state = {
    betAmount,
    pot: 0,
    round: "PREFLOP",
    communityCards: [],
    deck: []
  };

  // Thay đổi thông tin người chơi mặc định
  game.players = [
    {
      id: creator.id,
      name: creator.username,
      cards: [],
      roundBet: 0,
      totalBet: 0,
      folded: false,
      hasActed: false
    }
  ];

  const embed = new EmbedBuilder()
    .setTitle("🃏 Phòng Chờ Poker 🃏")
    .setColor("#2c3e50")
    .setDescription(
      `Chủ phòng: **${creator.username}**\n` +
      `Mức cược: **${betAmount.toLocaleString()} chips**\n\n` +
      `**Người chơi:**\n1. ${creator.username}`
    )
    .setImage(getRandomGif("night"));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("poker_join")
      .setLabel("Tham Gia (Join)")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("poker_start")
      .setLabel("Bắt Đầu (Start)")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("poker_cancel")
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
  if (customId.startsWith("poker_playagain_")) {
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

    return startPokerLobby(interaction, interaction.user, betAmount);
  }

  const game = getGame(channelId);
  if (!game || game.type !== "poker") {
    return interaction.reply({ content: "⚠️ Không tìm thấy phòng Poker.", ephemeral: true });
  }

  const betAmount = game.state.betAmount;

  // --- TRẠNG THÁI WAITING ---
  if (game.status === "WAITING") {
    if (customId === "poker_join") {
      if (game.players.some(p => p.id === interaction.user.id)) {
        return interaction.reply({ content: "⚠️ Bạn đã ở trong phòng!", ephemeral: true });
      }

      if (game.players.length >= 8) {
        return interaction.reply({ content: "⚠️ Phòng đã đầy (tối đa 8 người)!", ephemeral: true });
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
        roundBet: 0,
        totalBet: 0,
        folded: false,
        hasActed: false
      });

      const playerList = game.players.map((p, idx) => `${idx + 1}. ${p.name}${p.id === game.creatorId ? " (Chủ phòng)" : ""}`).join("\n");
      const embed = new EmbedBuilder()
        .setTitle("🃏 Phòng Chờ Texas Hold'em Poker 🃏")
        .setColor("#2c3e50")
        .setDescription(
          `Mức đặt cược tối thiểu: **${betAmount.toLocaleString()} chips**\n\n` +
          `**Danh sách người chơi:**\n${playerList}`
        )
        .setImage(getRandomGif("night"))
        .setFooter({ text: "Phòng chơi yêu cầu tối thiểu 2 người chơi." })
        .setTimestamp();

      await interaction.update({ embeds: [embed] });
    }

    else if (customId === "poker_start") {
      if (interaction.user.id !== game.creatorId) {
        return interaction.reply({ content: "⚠️ Chỉ chủ phòng mới được bắt đầu!", ephemeral: true });
      }

      if (game.players.length < 2) {
        return interaction.reply({ content: "⚠️ Cần tối thiểu 2 người để bắt đầu!", ephemeral: true });
      }

      // Khấu trừ tiền cược ban đầu của mỗi người
      for (const p of game.players) {
        // Tích hợp Free All-In
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
        p.roundBet = betAmount;
        p.totalBet = betAmount;
      }

      // Khởi tạo bộ bài & chia bài tẩy (2 lá)
      game.status = "PLAYING";
      const deck = createPokerDeck();
      
      for (let i = 0; i < game.players.length; i++) {
        game.players[i].cards = [deck.pop(), deck.pop()];
      }

      game.state.deck = deck;
      game.state.pot = betAmount * game.players.length;
      game.state.maxRoundBet = betAmount;
      game.state.round = "PREFLOP";
      game.state.turnIndex = 0; // Bắt đầu từ người chơi đầu tiên (Chủ phòng)

      const embed = buildPokerGameEmbed(game);
      const row = buildPokerGameButtons(game);

      await interaction.update({ embeds: [embed], components: [row] });
      game.state.boardMessageId = interaction.message.id;
    }

    else if (customId === "poker_cancel") {
      if (interaction.user.id !== game.creatorId) {
        return interaction.reply({ content: "⚠️ Chỉ chủ phòng mới được hủy phòng!", ephemeral: true });
      }
      deleteGame(channelId);
      await interaction.update({ content: "❌ Phòng đã bị hủy.", embeds: [], components: [] });
    }
  }

  // --- TRẠNG THÁI PLAYING ---
  else if (game.status === "PLAYING") {
    const activePlayer = game.players[game.state.turnIndex];

    // Nút Xem Bài Tẩy (Mọi người chơi đều có thể click bất kỳ lúc nào)
    if (customId === "poker_viewcards") {
      const player = game.players.find(p => p.id === interaction.user.id);
      if (!player) {
        return interaction.reply({ content: "⚠️ Bạn không tham gia ván Poker!", ephemeral: true });
      }
      if (player.folded) {
        return interaction.reply({ content: "⚠️ Bạn đã úp bài!", ephemeral: true });
      }

      // Đánh giá bộ bài tốt nhất hiện tại với bài chung
      const currentCombo = evaluate7CardHand([...player.cards, ...game.state.communityCards]);
      const comboLabel = currentCombo ? currentCombo.label : "Chưa có";

      const isMyTurn = (player.id === activePlayer.id);

      const embed = new EmbedBuilder()
        .setTitle("🃏 Bài Tẩy Của Bạn 🃏")
        .setColor("#9b59b6")
        .setDescription(
          `🃏 **Bài tẩy của bạn:** ${formatCardsList(player.cards)}\n` +
          `📈 **Sức mạnh hiện tại:** **${comboLabel}**\n\n` +
          (isMyTurn ? "🟢 **Tới lượt chơi của bạn!** Hãy thực hiện hành động cược bên dưới:" : "🔴 Chưa tới lượt chơi của bạn. Hãy đợi đối thủ hành động.")
        );

      if (isMyTurn) {
        const row = buildPokerGameButtons(game, true);
        return interaction.reply({
          embeds: [embed],
          components: [row],
          ephemeral: true
        });
      } else {
        return interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }
    }

    // Các nút hành động khác: Chỉ dành cho người chơi đang tới lượt
    if (interaction.user.id !== activePlayer.id) {
      return interaction.reply({ content: "⚠️ Chưa tới lượt của bạn!", ephemeral: true });
    }

    let isRoundEnded = false;

    // ---- HÀNH ĐỘNG CHECK ----
    if (customId === "poker_check") {
      if (activePlayer.roundBet !== game.state.maxRoundBet) {
        return interaction.reply({ content: "⚠️ Không thể Check lúc này!", ephemeral: true });
      }
      activePlayer.hasActed = true;
      isRoundEnded = moveToNextPokerTurn(game);
    }

    // ---- HÀNH ĐỘNG CALL ----
    else if (customId === "poker_call") {
      const callDiff = game.state.maxRoundBet - activePlayer.roundBet;
      if (callDiff <= 0) {
        return interaction.reply({ content: "⚠️ Bạn đã theo đủ cược!", ephemeral: true });
      }

      // Khấu trừ tiền call trực tiếp từ balance
      const isDeducted = await checkAndDeduct(activePlayer.id, callDiff, activePlayer.name);
      if (!isDeducted) {
        return interaction.reply({
          content: `⚠️ Thiếu chips để Call! Cần thêm: **${callDiff.toLocaleString()}**.`,
          ephemeral: true
        });
      }

      activePlayer.roundBet += callDiff;
      activePlayer.totalBet += callDiff;
      game.state.pot += callDiff;
      activePlayer.hasActed = true;

      isRoundEnded = moveToNextPokerTurn(game);
    }

    // ---- HÀNH ĐỘNG RAISE ----
    else if (customId === "poker_raise") {
      const raiseDiff = (game.state.maxRoundBet - activePlayer.roundBet) + betAmount;

      // Khấu trừ tiền raise trực tiếp từ balance
      const isDeducted = await checkAndDeduct(activePlayer.id, raiseDiff, activePlayer.name);
      if (!isDeducted) {
        return interaction.reply({
          content: `⚠️ Thiếu chips để Raise! Cần thêm: **${raiseDiff.toLocaleString()}**.`,
          ephemeral: true
        });
      }

      activePlayer.roundBet += raiseDiff;
      activePlayer.totalBet += raiseDiff;
      game.state.pot += raiseDiff;
      game.state.maxRoundBet = activePlayer.roundBet;
      activePlayer.hasActed = true;

      // Buộc mọi người chơi chưa Fold khác phải hành động lại sau cú Raise này
      for (const p of game.players) {
        if (p.id !== activePlayer.id && !p.folded) {
          p.hasActed = false;
        }
      }

      isRoundEnded = moveToNextPokerTurn(game);
    }

    // ---- HÀNH ĐỘNG FOLD ----
    else if (customId === "poker_fold") {
      activePlayer.folded = true;
      activePlayer.hasActed = true;

      // Kiểm tra xem có phải chỉ còn 1 người chơi chưa fold
      const nonFolded = game.players.filter(p => !p.folded);
      if (nonFolded.length === 1) {
        // Trận đấu kết thúc ngay lập tức, người cuối cùng thắng pot
        return finishPokerGame(interaction, game);
      }

      isRoundEnded = moveToNextPokerTurn(game);
    }

    // Nếu vòng cược hoàn thành và chuyển sang SHOWDOWN
    if (isRoundEnded) {
      return finishPokerGame(interaction, game);
    }

    // Cập nhật Embed sau hành động
    const newEmbed = buildPokerGameEmbed(game);
    const newRow = buildPokerGameButtons(game);
    
    const isClickedFromBoard = (interaction.message.id === game.state.boardMessageId);
    if (isClickedFromBoard) {
      await interaction.deferUpdate().catch(() => {});
    } else {
      let actionName = "";
      if (customId === "poker_check") actionName = "Check (Xem bài)";
      else if (customId === "poker_call") actionName = "Call (Theo cược)";
      else if (customId === "poker_raise") actionName = "Raise (Tăng cược)";
      else if (customId === "poker_fold") actionName = "Fold (Úp bài)";
      
      await interaction.update({ content: `✅ Bạn đã chọn ${actionName} thành công! Lượt đi đã được chuyển.`, embeds: [], components: [] }).catch(() => {});
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

      const newMsg = await channel.send({ embeds: [newEmbed], components: [newRow] });
      game.state.boardMessageId = newMsg.id;
    }
  }
}
