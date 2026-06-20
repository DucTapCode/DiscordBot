import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } from "discord.js";
import { User, Inventory, sequelize } from "../database.js";

export const data = new SlashCommandBuilder()
  .setName("reset")
  .setDescription("Reset toàn bộ dữ liệu chips và kho đồ của tất cả người chơi! (Chỉ dành cho Admin / Chủ Server)");

export async function execute(interaction) {
  const adminId = "1030089627576574023";
  const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
  const isAdminRole = interaction.member && interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
  const isHardcodedAdmin = interaction.user.id === adminId;

  if (!isOwner && !isAdminRole && !isHardcodedAdmin) {
    return interaction.reply({
      content: "❌ Bạn không có quyền sử dụng lệnh này! Lệnh này chỉ dành cho Admin hệ thống, Admin Server hoặc Chủ sở hữu máy chủ.",
      ephemeral: true
    });
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();

    // Xoá toàn bộ hàng trong Inventory
    await Inventory.destroy({
      where: {},
      truncate: true,
      transaction
    });

    // Xoá toàn bộ hàng trong User
    await User.destroy({
      where: {},
      truncate: true,
      transaction
    });

    await transaction.commit();

    const embed = new EmbedBuilder()
      .setTitle("⚠️ RESET TOÀN BỘ CƠ SỞ DỮ LIỆU CASINO ⚠️")
      .setColor("#e74c3c")
      .setDescription(
        `🛠️ Admin **${interaction.user.username}** đã thực hiện reset toàn bộ cơ sở dữ liệu hệ thống Casino.\n\n` +
        `- 💰 Toàn bộ số dư (balance) của tất cả người chơi đã được reset về mặc định.\n` +
        `- 🎒 Toàn bộ kho đồ (Inventory) đã bị xóa sạch.\n` +
        `- ⏱️ Thời gian quà tặng hàng ngày (daily quota) đã được đặt lại.`
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Lỗi khi reset cơ sở dữ liệu:", error);
    return interaction.reply({
      content: "❌ Reset thất bại do lỗi hệ thống Database! Vui lòng thử lại sau.",
      ephemeral: true
    });
  }
}
