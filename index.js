import "dotenv/config";
import http from "http";
import { Client, GatewayIntentBits, Collection } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Tạo server web để UptimeRobot ping vào
http.createServer((req, res) => {
  res.write("Bot dang online!");
  res.end();
}).listen(process.env.PORT || 3000); // Render sẽ tự cấp cổng PORT

// 1. Tái tạo lại __dirname cho chuẩn ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// (TÙY CHỌN) Import Database. Tạm thời bọc trong try-catch để bot không chết nếu bạn chưa tạo file database.js
let sequelize;
try {
  const dbModule = await import("./database.js");
  sequelize = dbModule.default || dbModule.sequelize;
} catch (error) {
  console.log(
    "⚠️ Chưa tìm thấy hoặc chưa cài đặt file database.js. Tạm thời bỏ qua DB.",
  );
}

// 2. Khởi tạo Bot
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// 3. Hàm khởi động (Bọc trong async để dùng được await)
async function startBot() {
  try {
    // Kiểm tra và tự động tạo thư mục commands nếu chưa có
    const commandsPath = path.join(__dirname, "commands");
    if (!fs.existsSync(commandsPath)) {
      fs.mkdirSync(commandsPath);
      console.log('📁 Đã tự động tạo thư mục "commands".');
    }

    // Quét và nạp các file game (Tiến lên, Poker...)
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".js"));

    for (const file of commandFiles) {
      // ES Module trên Windows yêu cầu thêm file:// trước đường dẫn tuyệt đối khi import động
      const filePath = `file://${path.join(commandsPath, file)}`;
      const commandModule = await import(filePath);

      // Hỗ trợ cả 'export default' và 'export const'
      const command = commandModule.default || commandModule;

      if (command.data && command.data.name) {
        client.commands.set(command.data.name, command);
      }
    }

    // Kết nối Database (nếu có)
    if (sequelize) {
      await sequelize.sync();
      try {
        await sequelize.query("ALTER TABLE Users ADD COLUMN hasPlayed BOOLEAN DEFAULT 0;");
        console.log("🛠️ Đã thêm cột hasPlayed vào database SQLite.");
      } catch (err) {
        // Cột đã tồn tại
      }
      try {
        await sequelize.query("ALTER TABLE Users ADD COLUMN shopItems TEXT DEFAULT NULL;");
        console.log("🛠️ Đã thêm cột shopItems vào database SQLite.");
      } catch (err) {
        // Cột đã tồn tại
      }
      try {
        await sequelize.query("ALTER TABLE Users ADD COLUMN shopPurchased TEXT DEFAULT NULL;");
        console.log("🛠️ Đã thêm cột shopPurchased vào database SQLite.");
      } catch (err) {
        // Cột đã tồn tại
      }
      try {
        await sequelize.query("ALTER TABLE Users ADD COLUMN shopLastReroll BIGINT DEFAULT NULL;");
        console.log("🛠️ Đã thêm cột shopLastReroll vào database SQLite.");
      } catch (err) {
        // Cột đã tồn tại
      }
      try {
        await sequelize.query("ALTER TABLE Users ADD COLUMN shopScale INTEGER DEFAULT 1;");
        console.log("🛠️ Đã thêm cột shopScale vào database SQLite.");
      } catch (err) {
        // Cột đã tồn tại
      }
      console.log("💾 Database đã đồng bộ.");
    }

    // Đăng nhập Bot
    await client.login(process.env.TOKEN);
    console.log(
      `🤖 Bot Casino đã online dưới tên ${client.user.tag}! Đã tải ${commandFiles.length} lệnh.`,
    );

    // Tự động đăng ký (deploy) slash commands lên Discord
    if (client.application) {
      const commandsData = Array.from(client.commands.values()).map((cmd) => {
        // Hỗ trợ toJSON() của SlashCommandBuilder
        return cmd.data.toJSON ? cmd.data.toJSON() : cmd.data;
      });
      await client.application.commands.set(commandsData);
      console.log(`✅ Đã tự động cập nhật ${commandsData.length} slash commands lên Discord.`);
    }
  } catch (error) {
    console.error("❌ Lỗi khởi động hệ thống:", error);
  }
}

// 4. Lắng nghe tương tác từ Discord
client.on("interactionCreate", async (interaction) => {
  // 4a. Xử lý Slash Command (/)
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Lỗi khi chạy lệnh ${interaction.commandName}:`, error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "Đã có lỗi hệ thống khi chạy game này!",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "Đã có lỗi hệ thống khi chạy game này!",
          ephemeral: true,
        });
      }
    }
  }

  // 4b. Xử lý Nút bấm (Button) hoặc Select Menu tương tác
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    const customId = interaction.customId;
    // Tách phần tiền tố để định tuyến (Ví dụ: "tienlen_join" -> lấy "tienlen")
    const commandName = customId.split("_")[0];
    const command = client.commands.get(commandName);

    if (command && typeof command.handleInteraction === "function") {
      try {
        await command.handleInteraction(interaction);
      } catch (error) {
        console.error(`Lỗi khi xử lý tương tác ${customId}:`, error);
        await interaction.reply({
          content: "Lỗi tương tác game! Vui lòng thử lại.",
          ephemeral: true,
        }).catch(() => {});
      }
    }
  }
});

// Chạy bot
startBot();
