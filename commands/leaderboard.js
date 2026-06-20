import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { User } from "../database.js";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Xem bảng xếp hạng Top 10 đại gia sở hữu nhiều chips nhất!");

export async function execute(interaction) {
  try {
    const topUsers = await User.findAll({
      order: [["balance", "DESC"]],
      limit: 10
    });

    const embed = new EmbedBuilder()
      .setTitle("🏆 BẢNG XẾP HẠNG ĐẠI GIA CASINO 🏆")
      .setColor("#f1c40f")
      .setTimestamp()
      .setFooter({ text: "Hãy tích cực chơi Blackjack và Tiến Lên để lên đỉnh bảng xếp hạng!" });

    if (!topUsers || topUsers.length === 0) {
      embed.setDescription("Chưa có dữ liệu người chơi nào trong bảng xếp hạng!");
    } else {
      let descriptionText = "Dưới đây là danh sách 10 người chơi giàu nhất hệ thống:\n\n";
      
      topUsers.forEach((user, index) => {
        let rankEmoji = "";
        if (index === 0) rankEmoji = "🥇";
        else if (index === 1) rankEmoji = "🥈";
        else if (index === 2) rankEmoji = "🥉";
        else rankEmoji = `🔹 **#${index + 1}**`;

        descriptionText += `${rankEmoji} **${user.username}** - \`${user.balance.toLocaleString()} chips\` 🪙\n`;
      });
      
      embed.setDescription(descriptionText);
    }

    return interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Lỗi khi tải bảng xếp hạng:", error);
    return interaction.reply({
      content: "❌ Không thể tải bảng xếp hạng do lỗi hệ thống! Vui lòng thử lại sau.",
      ephemeral: true
    });
  }
}
