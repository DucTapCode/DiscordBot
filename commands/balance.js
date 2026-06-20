import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getBalance } from "../database.js";

export const data = new SlashCommandBuilder()
  .setName("balance")
  .setDescription("Kiểm tra số dư chips tài khoản của bạn!");

export async function execute(interaction) {
  const userId = interaction.user.id;
  const username = interaction.user.username;

  // Lấy số dư từ database
  const balance = await getBalance(userId, username);

  const embed = new EmbedBuilder()
    .setTitle("💰 Ví Tiền Casino 💰")
    .setColor("#f1c40f")
    .setDescription(`Xin chào **${username}**! Dưới đây là số dư hiện tại trong ví của bạn:`)
    .addFields(
      { name: "Số dư hiện tại", value: `**${balance} chips** 🪙`, inline: true }
    )
    .setFooter({ text: "Sử dụng chips để đặt cược trong các game Tiến Lên, Blackjack!" })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
