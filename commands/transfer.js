import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { User, sequelize } from "../database.js";

export const data = new SlashCommandBuilder()
  .setName("transfer")
  .setDescription("Chuyển khoản chips cho người chơi khác!")
  .addUserOption(option =>
    option.setName("nguoi_nhan")
      .setDescription("Người nhận chips")
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option.setName("so_luong")
      .setDescription("Số lượng chips muốn chuyển")
      .setRequired(true)
      .setMinValue(1)
  );

export async function execute(interaction) {
  const senderId = interaction.user.id;
  const senderUsername = interaction.user.username;
  const recipientUser = interaction.options.getUser("nguoi_nhan");
  const recipientId = recipientUser.id;
  const recipientUsername = recipientUser.username;
  const amount = interaction.options.getInteger("so_luong");

  if (senderId === recipientId) {
    return interaction.reply({
      content: "⚠️ Bạn không thể chuyển khoản chips cho chính mình!",
      ephemeral: true
    });
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();

    // Lấy thông tin người gửi
    const [sender] = await User.findOrCreate({
      where: { discordId: senderId },
      defaults: { username: senderUsername, balance: 1000 },
      transaction,
      lock: true
    });

    if (sender.balance < amount) {
      await transaction.rollback();
      return interaction.reply({
        content: `⚠️ Số dư của bạn không đủ để thực hiện giao dịch! Bạn hiện có **${sender.balance.toLocaleString()} chips** (Yêu cầu chuyển: **${amount.toLocaleString()} chips**).`,
        ephemeral: true
      });
    }

    // Lấy thông tin người nhận
    const [recipient] = await User.findOrCreate({
      where: { discordId: recipientId },
      defaults: { username: recipientUsername, balance: 1000 },
      transaction,
      lock: true
    });

    // Thực hiện chuyển khoản
    sender.balance -= amount;
    recipient.balance += amount;

    await sender.save({ transaction });
    await recipient.save({ transaction });

    await transaction.commit();

    const embed = new EmbedBuilder()
      .setTitle("💸 CHUYỂN KHOẢN CHIPS THÀNH CÔNG 💸")
      .setColor("#2ecc71")
      .setDescription(`Bạn đã chuyển khoản thành công **${amount.toLocaleString()} chips** cho **${recipientUsername}**!`)
      .addFields(
        { name: "Người gửi", value: `<@${senderId}>`, inline: true },
        { name: "Người nhận", value: `<@${recipientId}>`, inline: true },
        { name: "Số dư còn lại của bạn", value: `**${sender.balance.toLocaleString()} chips** 🪙`, inline: false }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Lỗi khi chuyển khoản chips:", error);
    return interaction.reply({
      content: "❌ Giao dịch thất bại do lỗi hệ thống! Vui lòng thử lại sau.",
      ephemeral: true
    });
  }
}
