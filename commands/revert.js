import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { triggerChanceToRevert, timeMachineCache } from "../itemActivation.js";
import { getBalance } from "../database.js";

export const data = new SlashCommandBuilder()
  .setName("revert")
  .setDescription("Kích hoạt 🔄 Chance to Revert để thử vận may đảo ngược kết quả ván thua (Tỷ lệ thắng 30%)!");

export async function execute(interaction) {
  const userId = interaction.user.id;
  const username = interaction.user.username;

  // Lấy dữ liệu ván thua gần nhất từ cache
  const snapshot = timeMachineCache.get(userId);
  if (!snapshot) {
    return interaction.reply({
      content: "⚠️ Không tìm thấy thông tin ván cược thua gần nhất của bạn để kích hoạt đảo ngược kết quả!",
      ephemeral: true
    });
  }

  const now = Date.now();
  if (now - snapshot.timestamp > 60000) {
    timeMachineCache.delete(userId);
    return interaction.reply({
      content: "⚠️ Đã quá thời hạn 60 giây kể từ ván thua gần nhất, bạn không thể sử dụng vật phẩm này nữa!",
      ephemeral: true
    });
  }

  const currentBalance = await getBalance(userId, username);
  const lostAmount = snapshot.balanceBeforeBet - currentBalance;

  if (lostAmount <= 0) {
    return interaction.reply({
      content: "⚠️ Ván cược gần nhất không làm bạn hao hụt chips nào để khôi phục!",
      ephemeral: true
    });
  }

  // Gọi logic kích hoạt Chance to Revert
  const result = await triggerChanceToRevert(userId, lostAmount);

  if (!result.success) {
    return interaction.reply({
      content: result.message,
      ephemeral: true
    });
  }

  // Xóa cache ván cược sau khi đã thực hiện đảo ngược
  timeMachineCache.delete(userId);

  const embed = new EmbedBuilder()
    .setTitle("🔄 KÍCH HOẠT ĐẢO NGƯỢC THẾ CỜ 🔄")
    .setColor(result.reverted ? "#2ecc71" : "#e74c3c")
    .setDescription(result.message)
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}
