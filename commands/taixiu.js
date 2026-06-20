import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getBalance, checkAndDeduct, addBalance } from "../database.js";
import { getRandomGif } from "../werewolfLogic.js";

// Bộ emoji xúc xắc tương ứng từ 1 đến 6
const DICE_EMOJIS = {
  1: "⚀",
  2: "⚁",
  3: "⚂",
  4: "⚃",
  5: "⚄",
  6: "⚅"
};

export const data = new SlashCommandBuilder()
  .setName("taixiu")
  .setDescription("Chơi cá cược Tài Xỉu (Sicbo) bằng chips!")
  .addIntegerOption(option =>
    option.setName("cuoc")
      .setDescription("Số tiền chips muốn cược")
      .setRequired(true)
      .setMinValue(10)
  )
  .addStringOption(option =>
    option.setName("lua_chon")
      .setDescription("Chọn Tài hoặc Xỉu")
      .setRequired(true)
      .addChoices(
        { name: "Tài (11 - 17)", value: "tai" },
        { name: "Xỉu (4 - 10)", value: "xiu" }
      )
  );

export async function execute(interaction) {
  const betAmount = interaction.options.getInteger("cuoc");
  const choice = interaction.options.getString("lua_chon");
  const userId = interaction.user.id;
  const username = interaction.user.username;

  // 1. Kiểm tra số dư người chơi
  const userBalance = await getBalance(userId, username);
  if (userBalance < betAmount) {
    return interaction.reply({
      content: `⚠️ Không đủ chips! Có: **${userBalance}**, cần cược: **${betAmount}**.`,
      ephemeral: true
    });
  }

  // 2. Trừ tiền cược
  const isDeducted = await checkAndDeduct(userId, betAmount, username);
  if (!isDeducted) {
    return interaction.reply({
      content: `❌ Lỗi trừ cược.`,
      ephemeral: true
    });
  }

  // 3. Lắc 3 viên xúc xắc ngẫu nhiên
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const d3 = Math.floor(Math.random() * 6) + 1;
  const total = d1 + d2 + d3;

  // Xử lý bộ ba đồng nhất (3 viên giống nhau)
  const isTriple = (d1 === d2 && d2 === d3);
  let result = "";
  let isWin = false;

  if (isTriple) {
    result = "TRIPLE";
    isWin = false; // Bộ ba đồng nhất nhà cái ăn sạch
  } else {
    result = (total >= 11) ? "tai" : "xiu";
    isWin = (choice === result);
  }

  // 4. Cộng thưởng nếu thắng
  let changeText = "";
  let finalBalance = 0;
  if (isWin) {
    // 1 ăn 1: Cộng lại vốn + tiền thắng (tổng 2 lần betAmount)
    finalBalance = await addBalance(userId, betAmount * 2, username);
    changeText = `🎉 Thắng **+${betAmount.toLocaleString()}** chips!`;
  } else {
    finalBalance = await getBalance(userId, username);
    changeText = `😢 Thua **-${betAmount.toLocaleString()}** chips!`;
    if (isTriple) {
      changeText += `\n*(Bộ ba đồng nhất, Nhà cái ăn sạch)*`;
    }
  }

  // 5. Khởi tạo Embed kết quả
  const resultEmbed = new EmbedBuilder()
    .setTitle("🎲 Kết Quả Tài Xỉu (Sicbo) 🎲")
    .setDescription(
      `👤 Người chơi: **${username}**\n` +
      `💵 Cược: **${betAmount.toLocaleString()} chips** (${choice === "tai" ? "Tài" : "Xỉu"})\n` +
      `🎲 Xúc xắc: **${DICE_EMOJIS[d1]} ${DICE_EMOJIS[d2]} ${DICE_EMOJIS[d3]}** (Tổng: **${total}**)\n` +
      `📈 Kết quả: **${isTriple ? "Bộ ba" : (result === "tai" ? "TÀI" : "XỈU")}**\n\n` +
      `${changeText}\n` +
      `💰 Số dư: **${finalBalance.toLocaleString()} chips**`
    )
    .setColor(isWin ? "#2ecc71" : (isTriple ? "#f1c40f" : "#e74c3c"))
    .setImage(getRandomGif("day"))
    .setTimestamp();

  await interaction.reply({ embeds: [resultEmbed] });
}
