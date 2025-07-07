import discord
from discord.ext import commands
import json
import random
import os
from dotenv import load_dotenv
# --- CÀI ĐẶT BAN ĐẦU ---
load_dotenv()
my_token = os.getenv("Discord_Token")
# Thay 'YOUR_BOT_TOKEN' bằng token của bạn
TOKEN = my_token

# Thiết lập intents để bot có thể nhận các sự kiện cụ thể
intents = discord.Intents.default()
intents.message_content = True  # Bật intent để đọc nội dung tin nhắn
intents.members = True  # Bật intent để theo dõi thành viên

# Khởi tạo bot với tiền tố lệnh là '!'
bot = commands.Bot(command_prefix="!", intents=intents)

# --- QUẢN LÝ DỮ LIỆU JSON ---

# Tải hoặc tạo dữ liệu level
try:
    with open("levels.json", "r") as f:
        users = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    users = {}

# Tải hoặc tạo lệnh tùy chỉnh
try:
    with open("custom_commands.json", "r") as f:
        custom_cmds = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    custom_cmds = {}


def save_json_file(data, filename):
    """Lưu dữ liệu vào tệp JSON."""
    with open(filename, "w") as f:
        json.dump(data, f, indent=4)


# --- SỰ KIỆN CỦA BOT ---


@bot.event
async def on_ready():
    """Sự kiện khi bot đã sẵn sàng và kết nối thành công."""
    print(f"Đã đăng nhập với tư cách là {bot.user}")
    print("Bot đã sẵn sàng hoạt động! 🚀")


@bot.event
async def on_member_join(member):
    """Sự kiện khi có thành viên mới tham gia server."""
    # Tìm kênh chào mừng (thay 'welcome' bằng tên kênh của bạn)
    welcome_channel = discord.utils.get(member.guild.text_channels, name="welcome")
    if welcome_channel:
        await welcome_channel.send(f"Chào mừng {member.mention} đã đến với server! 🎉")


@bot.event
async def on_message(message):
    """Sự kiện khi có tin nhắn mới (xử lý XP và lệnh tùy chỉnh)."""
    # Bỏ qua tin nhắn từ chính bot và tin nhắn riêng
    if message.author.bot or message.guild is None:
        return

    # --- Xử lý hệ thống Level ---
    author_id = str(message.author.id)

    # Khởi tạo dữ liệu cho người dùng mới
    if author_id not in users:
        users[author_id] = {"xp": 0, "level": 1}

    # Thêm XP ngẫu nhiên cho mỗi tin nhắn
    users[author_id]["xp"] += random.randint(5, 15)
    save_json_file(users, "levels.json")

    # Kiểm tra lên cấp
    current_xp = users[author_id]["xp"]
    current_level = users[author_id]["level"]
    xp_for_next_level = current_level * 100

    if current_xp >= xp_for_next_level:
        users[author_id]["level"] += 1
        # Giữ lại XP dư sau khi lên cấp
        users[author_id]["xp"] = current_xp - xp_for_next_level
        new_level = users[author_id]["level"]
        await message.channel.send(
            f"Chúc mừng {message.author.mention} đã lên cấp {new_level}! 🌟"
        )
        save_json_file(users, "levels.json")

    # --- Xử lý lệnh tùy chỉnh ---
    if message.content.startswith(bot.command_prefix):
        # Tách tên lệnh ra khỏi nội dung tin nhắn
        cmd_name = message.content[len(bot.command_prefix) :].lower().split()[0]
        if cmd_name in custom_cmds:
            # Nếu là lệnh tùy chỉnh, gửi phản hồi và không xử lý tiếp
            await message.channel.send(custom_cmds[cmd_name])
            return

    # Xử lý các lệnh chính thức của bot
    await bot.process_commands(message)


@bot.event
async def on_command_error(ctx, error):
    """Xử lý lỗi chung cho các lệnh."""
    if isinstance(error, commands.MissingPermissions):
        await ctx.send("🚫 Bạn không có quyền để thực hiện lệnh này!")
    elif isinstance(error, commands.MissingRequiredArgument):
        await ctx.send("🤔 Lệnh bị thiếu tham số. Vui lòng kiểm tra lại.")
    elif isinstance(error, commands.CommandNotFound):
        # Lỗi này được bỏ qua vì đã xử lý lệnh tùy chỉnh ở on_message
        pass
    else:
        # In ra console để debug các lỗi khác
        print(f"Lỗi không xác định: {error}")
        await ctx.send("Có lỗi xảy ra khi thực hiện lệnh.")


# --- CÁC LỆNH CỦA BOT ---


# 1. Lệnh hệ thống Level
@bot.command(name="level", help="Kiểm tra cấp độ của bạn hoặc người khác.")
async def level(ctx, member: discord.Member = None):
    """Kiểm tra level của bản thân hoặc người khác."""
    member = member or ctx.author
    member_id = str(member.id)

    if member_id in users:
        user_data = users[member_id]
        await ctx.send(
            f'**{member.display_name}** đang ở **Cấp {user_data["level"]}** với **{user_data["xp"]} XP**.'
        )
    else:
        await ctx.send(f"Không tìm thấy dữ liệu cho {member.display_name}.")


# 2. Lệnh Quản lý (Moderation)
@bot.command(name="clear", help="Xóa một số lượng tin nhắn nhất định.")
@commands.has_permissions(manage_messages=True)
async def clear(ctx, amount: int):
    """Xóa một số lượng tin nhắn trong kênh."""
    await ctx.channel.purge(limit=amount + 1)
    await ctx.send(f"🗑️ Đã xóa {amount} tin nhắn.", delete_after=5)


@bot.command(name="kick", help="Kick một thành viên khỏi server.")
@commands.has_permissions(kick_members=True)
async def kick(ctx, member: discord.Member, *, reason="Không có lý do"):
    """Kick một thành viên ra khỏi server."""
    await member.kick(reason=reason)
    await ctx.send(f"👢 Đã kick **{member.mention}** với lý do: {reason}")


# 3. Lệnh tùy chỉnh (Custom Commands)
@bot.command(name="addcmd", help="Thêm một lệnh tùy chỉnh mới (chỉ dành cho admin).")
@commands.has_permissions(administrator=True)
async def add_command(ctx, name: str, *, response):
    """Thêm một lệnh tùy chỉnh mới."""
    name = name.lower()
    custom_cmds[name] = response
    save_json_file(custom_cmds, "custom_commands.json")
    await ctx.send(f"✅ Đã thêm lệnh tùy chỉnh `!{name}`.")


@bot.command(name="delcmd", help="Xóa một lệnh tùy chỉnh (chỉ dành cho admin).")
@commands.has_permissions(administrator=True)
async def delete_command(ctx, name: str):
    """Xóa một lệnh tùy chỉnh."""
    name = name.lower()
    if name in custom_cmds:
        del custom_cmds[name]
        save_json_file(custom_cmds, "custom_commands.json")
        await ctx.send(f"🗑️ Đã xóa lệnh tùy chỉnh `!{name}`.")
    else:
        await ctx.send("❌ Lệnh này không tồn tại.")


# --- CHẠY BOT ---
bot.run(TOKEN)
