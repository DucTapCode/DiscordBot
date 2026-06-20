import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { User, Inventory } from "../database.js";
import { getItemById } from "../itemManager.js";
import { addBalance } from "../database.js";

export const data = new SlashCommandBuilder()
  .setName("give")
  .setDescription("Cấp chips hoặc vật phẩm cho người chơi (Chỉ dành cho Admin / Chủ Server)!")
  .addUserOption(option =>
    option.setName("nguoi_nhan")
      .setDescription("Người chơi nhận quà")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("loai")
      .setDescription("Loại phần thưởng muốn cấp")
      .setRequired(true)
      .addChoices(
        { name: "Chips (Tiền tệ)", value: "chips" },
        { name: "Item (Vật phẩm)", value: "item" }
      )
  )
  .addIntegerOption(option =>
    option.setName("so_luong")
      .setDescription("Số lượng chips hoặc số lượng vật phẩm")
      .setRequired(true)
      .setMinValue(1)
  )
  .addStringOption(option =>
    option.setName("vat_pham")
      .setDescription("Vật phẩm muốn cấp (Bắt buộc nếu chọn loại là Item)")
      .setRequired(false)
      .addChoices(
        { name: "Free All-In Coin 🪙", value: "free_all_in" },
        { name: "Time Machine ⏳", value: "time_machine" },
        { name: "Increase Profit 📈", value: "increase_profit" },
        { name: "Loss Reduction 🛡️", value: "loss_reduction" },
        { name: "Chance to Revert 🔄", value: "chance_to_revert" },
        { name: "Get Ticket 🎟️", value: "get_ticket" },
        { name: "Mystery Box 🎁", value: "mystery_box" },
        { name: "Gun 🔫", value: "gun" }
      )
  );

export async function execute(interaction) {
  const adminId = "1030089627576574023";
  const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
  const isAdmin = interaction.user.id === adminId;

  if (!isAdmin && !isOwner) {
    return interaction.reply({
      content: "❌ Bạn không có quyền sử dụng lệnh này! Lệnh này chỉ dành cho Admin hệ thống hoặc Chủ sở hữu máy chủ.",
      ephemeral: true
    });
  }

  const recipientUser = interaction.options.getUser("nguoi_nhan");
  const recipientId = recipientUser.id;
  const recipientUsername = recipientUser.username;
  const type = interaction.options.getString("loai");
  const amount = interaction.options.getInteger("so_luong");
  const itemId = interaction.options.getString("vat_pham");

  if (type === "chips") {
    // Thêm số dư cho người nhận
    const newBalance = await addBalance(recipientId, amount, recipientUsername);

    const embed = new EmbedBuilder()
      .setTitle("🎁 QUÀ TẶNG TỪ ADMIN/OWNER 🎁")
      .setColor("#2ecc71")
      .setDescription(`Admin/Owner **${interaction.user.username}** đã **cộng thêm +${amount.toLocaleString()} chips** vào tài khoản của **${recipientUsername}**!`)
      .addFields(
        { name: "Người nhận", value: `<@${recipientId}>`, inline: true },
        { name: "Số dư mới", value: `**${newBalance.toLocaleString()} chips** 🪙`, inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  } else if (type === "item") {
    if (!itemId) {
      return interaction.reply({
        content: "⚠️ Bạn đã chọn loại phần thưởng là Vật phẩm, vui lòng chọn cụ thể loại vật phẩm ở ô `vat_pham`!",
        ephemeral: true
      });
    }

    const item = getItemById(itemId);
    if (!item) {
      return interaction.reply({
        content: "❌ Không tìm thấy vật phẩm hợp lệ!",
        ephemeral: true
      });
    }

    // Đảm bảo User nhận đã tồn tại trong DB
    await User.findOrCreate({
      where: { discordId: recipientId },
      defaults: { username: recipientUsername, balance: 1000 }
    });

    // Thêm vật phẩm vào Kho đồ
    const [inv, created] = await Inventory.findOrCreate({
      where: { userId: recipientId, itemId },
      defaults: { quantity: amount }
    });

    if (!created) {
      inv.quantity += amount;
      await inv.save();
    }

    const embed = new EmbedBuilder()
      .setTitle("🎁 VẬT PHẨM TỪ ADMIN/OWNER 🎁")
      .setColor("#9b59b6")
      .setDescription(`Admin/Owner **${interaction.user.username}** đã cấp vật phẩm cho **${recipientUsername}**!`)
      .addFields(
        { name: "Người nhận", value: `<@${recipientId}>`, inline: true },
        { name: "Vật phẩm", value: `**${item.emoji} ${item.name}**`, inline: true },
        { name: "Số lượng cấp", value: `**x${amount}**`, inline: true },
        { name: "Tổng sở hữu hiện tại", value: `**x${inv.quantity}**`, inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
}
