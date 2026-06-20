import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { User, Inventory, sequelize } from "../database.js";
import { items, getItemById } from "../itemManager.js";

// Khai báo Slash Command đăng ký với Discord
export const data = new SlashCommandBuilder()
  .setName("shop")
  .setDescription("Mở cửa hàng Casino để mua các vật phẩm (Hệ số nhân giá được cập nhật mỗi 3 giờ)!");

/**
 * Tính toán hệ số nhân giá dựa trên số dư hiện tại của người chơi
 * @param {number} balance - Số dư hiện tại
 * @returns {number} Hệ số nhân (tối thiểu là 1)
 */
function getPriceScale(balance) {
  return Math.max(1, Math.floor(balance / 1000));
}

/**
 * Lấy ngẫu nhiên n vật phẩm khác nhau từ danh sách cấu hình vật phẩm
 * @param {number} count - Số lượng vật phẩm cần lấy
 * @returns {Array} Mảng chứa các vật phẩm ngẫu nhiên
 */
function getRandomItems(count = 3) {
  const shuffled = [...items].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Xây dựng Embed hiển thị giao diện Shop Casino
 * @param {object} user - Bản ghi người dùng từ Database
 * @param {Array} currentItems - Danh sách 3 vật phẩm đang được bán
 * @param {Array} purchased - Mảng boolean đánh dấu vật phẩm đã mua [bool, bool, bool]
 * @returns {EmbedBuilder} Embed giao diện shop
 */
function buildShopEmbed(user, currentItems, purchased) {
  const scale = user.shopScale || 1;
  const rerollPrice = 100 * scale;

  const now = Date.now();
  const threeHours = 3 * 60 * 60 * 1000;
  const lastReroll = user.shopLastReroll ? Number(user.shopLastReroll) : now;
  const timeLeftMs = Math.max(0, threeHours - (now - lastReroll));
  const hoursLeft = Math.floor(timeLeftMs / (60 * 60 * 1000));
  const minutesLeft = Math.floor((timeLeftMs % (60 * 60 * 1000)) / (60 * 1000));
  const secondsLeft = Math.floor((timeLeftMs % (60 * 1000)) / 1000);

  let timeStr = "";
  if (hoursLeft > 0) {
    timeStr = `${hoursLeft} giờ ${minutesLeft} phút`;
  } else if (minutesLeft > 0) {
    timeStr = `${minutesLeft} phút ${secondsLeft} giây`;
  } else {
    timeStr = `${secondsLeft} giây`;
  }

  const embed = new EmbedBuilder()
    .setTitle("🏪 CỬA HÀNG VẬT PHẨM CASINO 🏪")
    .setColor("#3498db")
    .setDescription(`Chào mừng **${user.username}**! Hãy sử dụng chips để mua vật phẩm hỗ trợ. Hệ số nhân giá được cập nhật mỗi 3 giờ.`)
    .addFields(
      { 
        name: "Thông tin tài chính & Chu kỳ shop", 
        value: `💰 Số dư hiện tại: **${user.balance.toLocaleString()} chips** 🪙\n📈 Hệ số nhân giá đã khóa: **${scale}x** (Làm mới sau: **${timeStr}**)\n🔄 Phí Reroll hiện tại: **${rerollPrice.toLocaleString()} chips**`, 
        inline: false 
      }
    )
    .setFooter({ text: "⚠️ Các nút bấm mua hàng và Reroll chỉ hoạt động trong 60 giây!" })
    .setTimestamp();

  currentItems.forEach((item, index) => {
    const isBought = purchased[index];
    const dynamicPrice = item.price * scale;
    const displayName = isBought ? `~~${item.name}~~ (Đã mua)` : item.name;
    embed.addFields({
      name: `${index + 1}. ${item.emoji} ${displayName} (${dynamicPrice.toLocaleString()} chips)`,
      value: `> *${item.description}*`,
      inline: false
    });
  });

  return embed;
}

/**
 * Tạo ActionRow chứa các nút bấm Mua vật phẩm và Reroll
 * @param {Array} currentItems - Danh sách 3 vật phẩm
 * @param {Array} purchased - Trạng thái đã mua của 3 vật phẩm
 * @param {number} scale - Hệ số nhân giá đã khóa của người chơi
 * @returns {ActionRowBuilder} Chứa các nút bấm
 */
function buildShopButtons(currentItems, purchased, scale) {
  const buttonRow = new ActionRowBuilder();
  const rerollPrice = 100 * scale;

  currentItems.forEach((item, index) => {
    const isBought = purchased[index];
    if (isBought) {
      buttonRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`shop_buy_purchased_${index}_${item.id}`)
          .setLabel(`Đã mua`)
          .setEmoji(item.emoji)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
    } else {
      buttonRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`shop_buy_${index}_${item.id}`)
          .setLabel(`Mua ${item.name}`)
          .setEmoji(item.emoji)
          .setStyle(ButtonStyle.Success)
      );
    }
  });

  buttonRow.addComponents(
    new ButtonBuilder()
      .setCustomId("shop_reroll")
      .setLabel(`Reroll (${rerollPrice.toLocaleString()})`)
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Primary)
  );

  return buttonRow;
}

export async function execute(interaction) {
  const userId = interaction.user.id;
  const username = interaction.user.username;

  // Lấy hoặc tạo thông tin người dùng từ Database
  const [user] = await User.findOrCreate({
    where: { discordId: userId },
    defaults: { username, balance: 1000, quota: 0 }
  });

  const now = Date.now();
  const threeHours = 3 * 60 * 60 * 1000;
  let shopItems = [];
  let shopPurchased = [false, false, false];

  // Tự động Reroll & chốt lại hệ số giá (shopScale) mới sau 3 giờ
  if (!user.shopItems || !user.shopLastReroll || (now - Number(user.shopLastReroll) >= threeHours)) {
    const newItems = getRandomItems(3);
    shopItems = newItems.map(item => item.id);
    shopPurchased = [false, false, false];
    
    // Tính toán và khóa (freeze) hệ số giá dựa trên số dư lúc làm mới shop
    const newScale = getPriceScale(user.balance);

    user.shopItems = JSON.stringify(shopItems);
    user.shopPurchased = JSON.stringify(shopPurchased);
    user.shopScale = newScale;
    user.shopLastReroll = now;
    await user.save();
  } else {
    shopItems = JSON.parse(user.shopItems);
    shopPurchased = JSON.parse(user.shopPurchased);
  }

  // Chuyển danh sách ID thành đối tượng vật phẩm
  const currentItems = shopItems.map(id => getItemById(id)).filter(Boolean);

  // Tạo Embed và Buttons ban đầu (sử dụng hệ số giá đã khóa trong database)
  const embed = buildShopEmbed(user, currentItems, shopPurchased);
  const row = buildShopButtons(currentItems, shopPurchased, user.shopScale);

  // Gửi tin nhắn phản hồi công khai
  const response = await interaction.reply({
    embeds: [embed],
    components: [row],
    fetchReply: true
  });

  // Khởi tạo MessageComponentCollector thu thập tương tác trong 60 giây
  const collector = response.createMessageComponentCollector({
    time: 60000
  });

  collector.on("collect", async i => {
    if (i.user.id !== interaction.user.id) {
      return i.reply({
        content: "⚠️ Đây không phải cửa hàng của bạn! Hãy sử dụng lệnh `/shop` để mở cửa hàng cá nhân của mình.",
        ephemeral: true
      });
    }
    // ---- TRƯỜNG HỢP: REROLL VẬT PHẨM (Phí reroll tính theo hệ số đã khóa trước đó) ----
    if (i.customId === "shop_reroll") {
      let transaction;
      try {
        transaction = await sequelize.transaction();

        const dbUser = await User.findOne({
          where: { discordId: userId },
          transaction,
          lock: true
        });

        // Sử dụng hệ số hiện tại đang khóa để tính phí Reroll
        const currentScale = dbUser.shopScale || 1;
        const rerollPrice = 100 * currentScale;

        if (dbUser.balance < rerollPrice) {
          await transaction.rollback();
          return i.reply({
            content: `⚠️ Số dư không đủ! Bạn cần **${rerollPrice.toLocaleString()} chips** để Reroll. (Số dư của bạn: ${dbUser.balance.toLocaleString()} chips)`,
            ephemeral: true
          });
        }

        // Trừ tiền Reroll
        dbUser.balance -= rerollPrice;

        // Sinh mới 3 vật phẩm khác nhau
        const newItems = getRandomItems(3);
        const newShopItems = newItems.map(item => item.id);
        const newPurchased = [false, false, false];

        dbUser.shopItems = JSON.stringify(newShopItems);
        dbUser.shopPurchased = JSON.stringify(newPurchased);
        // Giữ nguyên dbUser.shopScale và dbUser.shopLastReroll để không đổi hệ số nhân giá và chu kỳ chốt 3 giờ

        await dbUser.save({ transaction });
        await transaction.commit();

        const newEmbed = buildShopEmbed(dbUser, newItems, newPurchased);
        const newRow = buildShopButtons(newItems, newPurchased, dbUser.shopScale);

        await i.update({
          embeds: [newEmbed],
          components: [newRow]
        });

      } catch (error) {
        if (transaction) await transaction.rollback();
        console.error("Lỗi khi Reroll Shop:", error);
        await i.reply({
          content: "❌ Có lỗi xảy ra trong quá trình Reroll. Vui lòng thử lại!",
          ephemeral: true
        });
      }
    }

    // ---- TRƯỜNG HỢP: MUA VẬT PHẨM (Giá vật phẩm tính theo hệ số đã khóa) ----
    else if (i.customId.startsWith("shop_buy_")) {
      const parts = i.customId.split("_"); // ["shop", "buy", slotIndex, itemId...]
      const slotIndex = parseInt(parts[2]);
      const itemId = parts.slice(3).join("_");
      
      const item = getItemById(itemId);
      if (!item) {
        return i.reply({
          content: "❌ Không tìm thấy thông tin vật phẩm này trong hệ thống!",
          ephemeral: true
        });
      }

      let transaction;
      try {
        transaction = await sequelize.transaction();

        const dbUser = await User.findOne({
          where: { discordId: userId },
          transaction,
          lock: true
        });

        const currentShopItems = JSON.parse(dbUser.shopItems);
        const currentShopPurchased = JSON.parse(dbUser.shopPurchased);

        // Kiểm tra xem vị trí này đã được mua chưa
        if (currentShopPurchased[slotIndex]) {
          await transaction.rollback();
          return i.reply({
            content: `⚠️ Vật phẩm này đã được mua rồi! Bạn cần Reroll để làm mới danh sách.`,
            ephemeral: true
          });
        }

        // Giá được tính theo hệ số shopScale đã khóa
        const lockedScale = dbUser.shopScale || 1;
        const dynamicPrice = item.price * lockedScale;

        if (dbUser.balance < dynamicPrice) {
          await transaction.rollback();
          return i.reply({
            content: `⚠️ Bạn không đủ tiền mua **${item.name}**! Giá đã khóa của vật phẩm này: **${dynamicPrice.toLocaleString()} chips** (Với hệ số ${lockedScale}x).`,
            ephemeral: true
          });
        }

        // Trừ tiền
        dbUser.balance -= dynamicPrice;
        
        // Đánh dấu đã mua tại slotIndex
        currentShopPurchased[slotIndex] = true;
        dbUser.shopPurchased = JSON.stringify(currentShopPurchased);
        await dbUser.save({ transaction });

        // Thêm vào kho đồ
        const [inventoryItem, created] = await Inventory.findOrCreate({
          where: { userId: dbUser.discordId, itemId: item.id },
          defaults: { quantity: 1 },
          transaction
        });

        if (!created) {
          inventoryItem.quantity += 1;
          await inventoryItem.save({ transaction });
        }

        await transaction.commit();

        await i.reply({
          content: `🎉 Bạn đã mua thành công **${item.emoji} ${item.name}** với giá **${dynamicPrice.toLocaleString()} chips**!`,
          ephemeral: true
        });

        // Cập nhật lại giao diện shop hiển thị trạng thái đã mua của slot đó
        const updatedItems = currentShopItems.map(id => getItemById(id)).filter(Boolean);
        const updatedEmbed = buildShopEmbed(dbUser, updatedItems, currentShopPurchased);
        const updatedRow = buildShopButtons(updatedItems, currentShopPurchased, dbUser.shopScale);

        await interaction.editReply({
          embeds: [updatedEmbed],
          components: [updatedRow]
        });

      } catch (error) {
        if (transaction) await transaction.rollback();
        console.error("Lỗi khi mua vật phẩm Casino:", error);
        await i.reply({
          content: "❌ Giao dịch thất bại do lỗi hệ thống Database. Vui lòng thử lại!",
          ephemeral: true
        });
      }
    }
  });

  // Khi hết hạn collector, khóa các nút bấm dựa theo trạng thái đã mua mới nhất
  collector.on("end", async () => {
    try {
      const latestUser = await User.findOne({ where: { discordId: userId } });
      let latestPurchased = [false, false, false];
      let latestItems = [];
      let latestScale = user.shopScale || 1;

      if (latestUser && latestUser.shopItems && latestUser.shopPurchased) {
        latestItems = JSON.parse(latestUser.shopItems).map(id => getItemById(id)).filter(Boolean);
        latestPurchased = JSON.parse(latestUser.shopPurchased);
        latestScale = latestUser.shopScale || 1;
      } else {
        latestItems = currentItems;
      }

      const disabledRow = new ActionRowBuilder();
      latestItems.forEach((item, index) => {
        const isBought = latestPurchased[index];
        disabledRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`shop_buy_disabled_${index}_${item.id}`)
            .setLabel(isBought ? "Đã mua" : `Mua ${item.name}`)
            .setEmoji(item.emoji)
            .setStyle(isBought ? ButtonStyle.Secondary : ButtonStyle.Success)
            .setDisabled(true)
        );
      });

      const rerollPrice = 100 * latestScale;

      disabledRow.addComponents(
        new ButtonBuilder()
          .setCustomId("shop_reroll_disabled")
          .setLabel(`Reroll (${rerollPrice.toLocaleString()}) (Hết hạn)`)
          .setEmoji("🔄")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true)
      );

      await interaction.editReply({
        components: [disabledRow]
      });
    } catch (err) {
      // Bỏ qua nếu tin nhắn bị xóa
    }
  });
}
