import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Inventory } from "../database.js";
import { getItemById } from "../itemManager.js";

export const data = new SlashCommandBuilder()
  .setName("inventory")
  .setDescription("Xem danh sách vật phẩm (kho đồ) bạn đang sở hữu!");

export async function execute(interaction) {
  const userId = interaction.user.id;
  const username = interaction.user.username;

  try {
    const invItems = await Inventory.findAll({
      where: { userId }
    });

    const embed = new EmbedBuilder()
      .setTitle(`🎒 Kho Đồ Của ${username} 🎒`)
      .setColor("#3498db")
      .setTimestamp();

    if (!invItems || invItems.length === 0) {
      embed.setDescription(
        "Túi đồ của bạn hiện đang trống rỗng! 🏜️\n" +
        "Hãy ghé thăm cửa hàng bằng lệnh `/shop` để mua sắm vật phẩm hỗ trợ nhé."
      );
    } else {
      embed.setDescription("Dưới đây là danh sách các vật phẩm bạn đang sở hữu trong hành trang:");
      
      invItems.forEach(inv => {
        const item = getItemById(inv.itemId);
        if (item) {
          embed.addFields({
            name: `${item.emoji} ${item.name} (Số lượng: **x${inv.quantity}**)`,
            value: `> *${item.description}*`,
            inline: false
          });
        }
      });
    }

    return interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error("Lỗi khi đọc kho đồ:", error);
    return interaction.reply({
      content: "❌ Không thể mở kho đồ do lỗi hệ thống! Vui lòng thử lại sau.",
      ephemeral: true
    });
  }
}
