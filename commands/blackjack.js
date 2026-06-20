import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { createGame, getGame, deleteGame } from "../gameManager.js";
import { getBalance, checkAndDeduct, addBalance, User } from "../database.js";
import { freeAllInCache, processGameResult } from "../itemActivation.js";
import { getRandomGif } from "../werewolfLogic.js";

// --- CÁC HÀM HELPER XỬ LÝ BÀI BLACKJACK ---

// Tạo bộ bài 52 lá và xáo bài
function createDeck() {
  const suits = ["♠", "♣", "♦", "♥"];
  const values = [
    { name: "2", val: 2 },
    { name: "3", val: 3 },
    { name: "4", val: 4 },
    { name: "5", val: 5 },
    { name: "6", val: 6 },
    { name: "7", val: 7 },
    { name: "8", val: 8 },
    { name: "9", val: 9 },
    { name: "10", val: 10 },
    { name: "J", val: 10 },
    { name: "Q", val: 10 },
    { name: "K", val: 10 },
    { name: "A", val: 11 }
  ];

  let deck = [];
  for (const suit of suits) {
    for (const val of values) {
      deck.push({ name: val.name, suit, val: val.val });
    }
  }

  // Thuật toán xáo bài Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Tính điểm của một mảng lá bài
function calculateScore(cards) {
  let score = 0;
  let aces = 0;
  for (const card of cards) {
    score += card.val;
    if (card.name === "A") aces++;
  }
  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }
  return score;
}

// Định dạng hiển thị bộ bài
function formatCards(cards, hideSecond = false) {
  if (hideSecond && cards.length >= 2) {
    return `[${cards[0].name}${cards[0].suit}] [🃏 Bài Ẩn]`;
  }
  return cards.map(c => `[${c.name}${c.suit}]`).join(" ");
}

// Xây dựng Embed hiển thị trạng thái bàn Blackjack đông người
function buildBlackjackBoardEmbed(game, revealDealer = false) {
  const { dealerCards, betAmount, turnIndex } = game.state;
  const dealerScore = revealDealer ? calculateScore(dealerCards) : "??";
  
  let playersStatus = "";
  game.players.forEach((p, idx) => {
    const pScore = calculateScore(p.cards);
    let statusIcon = "👤";
    let actionState = "";

    if (game.status === "PLAYING") {
      if (idx === turnIndex) {
        statusIcon = "👉";
        actionState = " *(Đang quyết định...)*";
      } else if (p.stand) {
        statusIcon = "🟢";
        actionState = " *(Đã Dừng - Stand)*";
      } else if (pScore > 21) {
        statusIcon = "💥";
        actionState = " *(Bị Quắc - Bust)*";
      } else {
        statusIcon = "⏳";
        actionState = " *(Đợi lượt)*";
      }
    } else {
      // Đã kết thúc game
      if (pScore > 21) {
        statusIcon = "💥";
      } else if (pScore === 21) {
        statusIcon = "✨";
      } else {
        statusIcon = "🟢";
      }
    }

    playersStatus += `${statusIcon} **${p.name}** (${pScore}đ): ${formatCards(p.cards)}${actionState}\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle("🃏 Sòng Bài Blackjack (Đông Người) 🃏")
    .setColor("#2b2d31")
    .setDescription(
      `Cược phòng: **${betAmount.toLocaleString()} chips** | Pot cược: **${(betAmount * game.players.length).toLocaleString()} chips**\n\n` +
      `**Nhà Cái (Bot) (${dealerScore}đ):**\n${formatCards(dealerCards, !revealDealer)}\n\n` +
      `**Danh sách người chơi:**\n${playersStatus}`
    )
    .setImage(getRandomGif(game.status === "PLAYING" ? "day" : "vote"));

  return embed;
}

// Xây dựng nút điều khiển cho người chơi đang tới lượt
function buildBlackjackControls() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("blackjack_hit")
      .setLabel("Rút Bài (Hit)")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("blackjack_stand")
      .setLabel("Dừng Rút (Stand)")
      .setStyle(ButtonStyle.Success)
  );
  return row;
}

// Chuyển sang lượt chơi của người chơi tiếp theo
async function advanceToNextPlayer(interaction, game) {
  let nextIndex = game.state.turnIndex;

  while (true) {
    nextIndex++;
    if (nextIndex >= game.players.length) {
      // Đã hết lượt tất cả người chơi -> Lượt Nhà Cái tự động rút bài
      await playDealerTurnMultiplayer(interaction, game);
      return;
    }

    const nextPlayer = game.players[nextIndex];
    const score = calculateScore(nextPlayer.cards);
    
    // Nếu người tiếp theo đã Blackjack sẵn thì tự động stand và chuyển tiếp
    if (score === 21) {
      nextPlayer.stand = true;
    } else {
      game.state.turnIndex = nextIndex;
      break;
    }
  }

  // Cập nhật Embed lượt chơi mới
  const embed = buildBlackjackBoardEmbed(game);
  const row = buildBlackjackControls();

  await updateBoardMessage(interaction, game, embed, row);
}

// Hàm hỗ trợ cập nhật tin nhắn bàn cược
async function updateBoardMessage(interaction, game, embed, components = null) {
  const isClickedFromBoard = (interaction.message.id === game.state.boardMessageId);
  if (isClickedFromBoard) {
    await interaction.deferUpdate().catch(() => {});
  } else {
    await interaction.update({ content: "Giao dịch thành công!", embeds: [], components: [] }).catch(() => {});
  }

  const channel = interaction.channel || await interaction.client.channels.fetch(interaction.channelId).catch(() => null);
  if (!channel) return;

  const oldMsgId = game.state.boardMessageId;
  if (oldMsgId) {
    await channel.messages.fetch(oldMsgId).then(async (msg) => {
      await msg.delete().catch(() => {});
    }).catch(() => {});
  }

  const payload = { embeds: [embed] };
  if (components) payload.components = [components];

  const newMsg = await channel.send(payload);
  game.state.boardMessageId = newMsg.id;
}

// --- SLASH COMMAND CONFIG ---
export const data = new SlashCommandBuilder()
  .setName("blackjack")
  .setDescription("Tạo phòng chơi Blackjack (Đông Người) đối đầu với Nhà Cái!")
  .addIntegerOption(option => 
    option.setName("cuoc")
      .setDescription("Mức tiền đặt cược phòng chơi (mặc định là 100 chips)")
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
  await startBlackjackLobby(interaction, interaction.user, betAmount);
}

async function startBlackjackLobby(interaction, creator, betAmount) {
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
      .setTitle("🔰 HƯỚNG DẪN BLACKJACK 🔰")
      .setColor("#3498db")
      .setDescription(
        `• Mục tiêu: Đạt điểm gần 21 nhất, không quá 21 (Quắc).\n` +
        `• Rút Bài (Hit): Nhận thêm 1 lá.\n` +
        `• Dừng Rút (Stand): Giữ điểm so với Nhà cái.\n` +
        `• A tính là 1 hoặc 11. J, Q, K là 10.`
      );
    await interaction.reply({ embeds: [tutorialEmbed], ephemeral: true }).catch(() => {});
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

  // Khởi tạo phòng Blackjack mới
  const game = createGame(channelId, "blackjack", creator);
  game.status = "WAITING";
  game.state = {
    betAmount,
    deck: [],
    dealerCards: [],
    turnIndex: 0,
    boardMessageId: null
  };

  game.players = [
    {
      id: creator.id,
      name: creator.username,
      cards: [],
      stand: false,
      isFreeAllIn: false
    }
  ];

  const embed = new EmbedBuilder()
    .setTitle("🃏 Phòng Chờ Blackjack (Đông Người) 🃏")
    .setColor("#2b2d31")
    .setDescription(
      `Chủ phòng: **${creator.username}**\n` +
      `Mức cược: **${betAmount.toLocaleString()} chips**\n\n` +
      `**Người chơi đã tham gia:**\n1. ${creator.username}`
    )
    .setImage(getRandomGif("night"));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("blackjack_join").setLabel("Tham Gia").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("blackjack_start").setLabel("Bắt Đầu").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("blackjack_cancel").setLabel("Hủy Phòng").setStyle(ButtonStyle.Danger)
  );

  let msg;
  if (interaction.replied || interaction.deferred) {
    msg = await interaction.followUp({ embeds: [embed], components: [row] });
  } else {
    await interaction.reply({ embeds: [embed], components: [row] });
    msg = await interaction.fetchReply();
  }
  game.state.boardMessageId = msg.id;
}

// --- XỬ LÝ TƯƠNG TÁC NÚT BẤM ---
export async function handleInteraction(interaction) {
  const channelId = interaction.channelId;
  const customId = interaction.customId;

  // Nút bấm Chơi Lại ván mới
  if (customId.startsWith("blackjack_playagain_")) {
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

    return startBlackjackLobby(interaction, interaction.user, betAmount);
  }

  const game = getGame(channelId);
  if (!game || game.type !== "blackjack") {
    return interaction.reply({ content: "⚠️ Không tìm thấy phòng Blackjack.", ephemeral: true });
  }

  const betAmount = game.state.betAmount;

  // --- TRẠNG THÁI PHÒNG CHỜ (WAITING) ---
    if (game.status === "WAITING") {
    if (customId === "blackjack_join") {
      if (game.players.some(p => p.id === interaction.user.id)) {
        return interaction.reply({ content: "⚠️ Bạn đã ở trong phòng!", ephemeral: true });
      }

      if (game.players.length >= 7) {
        return interaction.reply({ content: "⚠️ Phòng đã đầy (tối đa 7 người)!", ephemeral: true });
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
        stand: false,
        isFreeAllIn: false
      });

      const playerList = game.players.map((p, idx) => `${idx + 1}. ${p.name}${p.id === game.creatorId ? " (Chủ phòng)" : ""}`).join("\n");
      const embed = new EmbedBuilder()
        .setTitle("🃏 Phòng Chờ Blackjack (Đông Người) 🃏")
        .setColor("#2b2d31")
        .setDescription(
          `Mức đặt cược: **${betAmount.toLocaleString()} chips**\n\n` +
          `**Người chơi đã tham gia:**\n${playerList}`
        )
        .setImage(getRandomGif("night"))
        .setFooter({ text: "Yêu cầu tối thiểu 1 người chơi." });

      await interaction.update({ embeds: [embed] });
    }

    else if (customId === "blackjack_cancel") {
      if (interaction.user.id !== game.creatorId) {
        return interaction.reply({ content: "⚠️ Chỉ chủ phòng mới được hủy!", ephemeral: true });
      }
      deleteGame(channelId);
      await interaction.update({ content: "❌ Phòng đã bị hủy.", embeds: [], components: [] });
    }

    else if (customId === "blackjack_start") {
      if (interaction.user.id !== game.creatorId) {
        return interaction.reply({ content: "⚠️ Chỉ chủ phòng mới được bắt đầu!", ephemeral: true });
      }

      // Khấu trừ tiền cược ban đầu của mỗi người tham gia
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

      // Khởi tạo bài cược
      game.status = "PLAYING";
      const deck = createDeck();

      // Chia bài tẩy (mỗi người 2 lá, dealer 2 lá)
      for (let i = 0; i < game.players.length; i++) {
        game.players[i].cards = [deck.pop(), deck.pop()];
      }
      const dealerCards = [deck.pop(), deck.pop()];

      game.state.deck = deck;
      game.state.dealerCards = dealerCards;
      game.state.turnIndex = 0;

      // Tự động kiểm tra Blackjack (21 điểm) cho người chơi đầu tiên
      const firstScore = calculateScore(game.players[0].cards);
      if (firstScore === 21) {
        game.players[0].stand = true;
        // Chuyển nhanh qua lượt người tiếp theo
        await advanceToNextPlayer(interaction, game);
      } else {
        const embed = buildBlackjackBoardEmbed(game);
        const row = buildBlackjackControls();
        await interaction.update({ embeds: [embed], components: [row] });
      }
    }
  }

  // --- TRẠNG THÁI ĐANG CHƠI (PLAYING) ---
  else if (game.status === "PLAYING") {
    const activePlayer = game.players[game.state.turnIndex];

    if (interaction.user.id !== activePlayer.id) {
      return interaction.reply({ content: "⚠️ Chưa tới lượt của bạn!", ephemeral: true });
    }

    const { deck, playerHand } = game.state;

    // ---- RÚT BÀI (HIT) ----
    if (customId === "blackjack_hit") {
      const newCard = deck.pop();
      activePlayer.cards.push(newCard);

      const score = calculateScore(activePlayer.cards);

      if (score > 21) {
        // Người chơi bị Quắc (Bust) -> Tự động chuyển qua lượt người chơi tiếp theo
        await advanceToNextPlayer(interaction, game);
      } else if (score === 21 || activePlayer.cards.length === 5) {
        // Đạt 21 điểm hoặc đủ 5 lá tự động dằn
        activePlayer.stand = true;
        await advanceToNextPlayer(interaction, game);
      } else {
        // Vẫn có thể rút tiếp
        const embed = buildBlackjackBoardEmbed(game);
        const row = buildBlackjackControls();
        await updateBoardMessage(interaction, game, embed, row);
      }
    }

    // ---- DẰN BÀI (STAND) ----
    else if (customId === "blackjack_stand") {
      activePlayer.stand = true;
      await advanceToNextPlayer(interaction, game);
    }
  }
}

// --- LƯỢT CHƠI CỦA NHÀ CÁI (BOT) VÀ TRAO THƯỞNG ---
async function playDealerTurnMultiplayer(interaction, game) {
  const { deck, dealerCards, betAmount } = game.state;
  let dealerScore = calculateScore(dealerCards);

  // Bot tự rút bài khi điểm nhỏ hơn 17
  while (dealerScore < 17) {
    dealerCards.push(deck.pop());
    dealerScore = calculateScore(dealerCards);
  }

  let resultsText = "";

  for (const p of game.players) {
    const playerScore = calculateScore(p.cards);
    let finalBal = 0;

    if (playerScore > 21) {
      // 1. Người chơi bị Quắc -> Thua luôn
      let refundText = "";
      if (p.isFreeAllIn) {
        finalBal = await addBalance(p.id, betAmount, p.name);
        refundText = ` (Hoàn cược Free All-In)`;
      } else {
        finalBal = await getBalance(p.id, p.name);
      }
      const itemRes = await processGameResult(p.id, false, betAmount, finalBal);
      resultsText += `💀 **${p.name}** thua (Quắc ${playerScore}đ): -${betAmount.toLocaleString()} chips${refundText} (Dư: **${itemRes.newBalance.toLocaleString()}**)\n`;
    } 
    else if (dealerScore > 21) {
      // 2. Nhà cái quắc, người chơi sống -> Người chơi thắng
      finalBal = await addBalance(p.id, betAmount * 2, p.name);
      const itemRes = await processGameResult(p.id, true, betAmount, finalBal);
      resultsText += `🏆 **${p.name}** thắng (Cái quắc ${dealerScore}đ): +${betAmount.toLocaleString()} chips (Dư: **${itemRes.newBalance.toLocaleString()}**)\n`;
    } 
    else if (playerScore > dealerScore) {
      // 3. Điểm người chơi cao hơn nhà cái -> Thắng
      finalBal = await addBalance(p.id, betAmount * 2, p.name);
      const itemRes = await processGameResult(p.id, true, betAmount, finalBal);
      resultsText += `🏆 **${p.name}** thắng (${playerScore}đ > ${dealerScore}đ): +${betAmount.toLocaleString()} chips (Dư: **${itemRes.newBalance.toLocaleString()}**)\n`;
    } 
    else if (playerScore < dealerScore) {
      // 4. Điểm người chơi thấp hơn nhà cái -> Thua
      let refundText = "";
      if (p.isFreeAllIn) {
        finalBal = await addBalance(p.id, betAmount, p.name);
        refundText = ` (Hoàn cược Free All-In)`;
      } else {
        finalBal = await getBalance(p.id, p.name);
      }
      const itemRes = await processGameResult(p.id, false, betAmount, finalBal);
      resultsText += `💀 **${p.name}** thua (${playerScore}đ < ${dealerScore}đ): -${betAmount.toLocaleString()} chips${refundText} (Dư: **${itemRes.newBalance.toLocaleString()}**)\n`;
    } 
    else {
      // 5. Hòa (Push)
      finalBal = await addBalance(p.id, betAmount, p.name);
      resultsText += `🤝 **${p.name}** hòa (${playerScore}đ): Hoàn cược (Dư: **${finalBal.toLocaleString()}**)\n`;
    }
  }

  // Đổi trạng thái phòng về FINISHED
  game.status = "FINISHED";
  const finalEmbed = buildBlackjackBoardEmbed(game, true);
  finalEmbed.setDescription(
    `🏁 **KẾT QUẢ VÁN ĐẤU BLACKJACK** 🏁\n\n` +
    `${resultsText}`
  );

  const playAgainRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`blackjack_playagain_${game.creatorId}_${betAmount}`)
      .setLabel("Chơi Lại 🔄")
      .setStyle(ButtonStyle.Primary)
  );

  // Xóa và gửi lại tin nhắn kết quả ván đấu
  await updateBoardMessage(interaction, game, finalEmbed, playAgainRow);
  
  // Xóa game
  deleteGame(game.channelId);
}
