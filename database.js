import { Sequelize, DataTypes } from 'sequelize';

// Khởi tạo kết nối database SQLite cục bộ
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
});

// Định nghĩa bảng User lưu trữ số dư, hạn mức ngày (quota) và thời gian nhận quà daily của người chơi
const User = sequelize.define('User', {
  discordId: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  balance: {
    type: DataTypes.INTEGER,
    defaultValue: 1000 // Tặng 1000 chips ban đầu khi người chơi mới tham gia
  },
  quota: {
    type: DataTypes.INTEGER,
    defaultValue: 0 // Hạn mức ngày, mặc định ban đầu là 0 và có thể tăng thông qua việc dùng vật phẩm (như Gun)
  },
  lastDaily: {
    type: DataTypes.BIGINT,
    allowNull: true,
    defaultValue: null // Lưu timestamp (mili giây) của lần gần nhất người dùng nhận chips daily
  },
  hasPlayed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false // Đánh dấu người chơi đã từng chơi game bài tây nào chưa để hiển thị hướng dẫn lần đầu
  },
  shopItems: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null // Mảng JSON chứa ID 3 vật phẩm đang bán trong shop
  },
  shopPurchased: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null // Mảng JSON chứa trạng thái đã mua của 3 vật phẩm [bool, bool, bool]
  },
  shopLastReroll: {
    type: DataTypes.BIGINT,
    allowNull: true,
    defaultValue: null // Timestamp lần cuối shop tự động/chủ động Reroll
  },
  shopScale: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1 // Hệ số nhân giá được chốt định kỳ mỗi 3 giờ hoặc khi Reroll chủ động
  }
});

// Định nghĩa bảng Inventory lưu trữ vật phẩm của người chơi (Quan hệ 1-Nhiều với User)
const Inventory = sequelize.define('Inventory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: User,
      key: 'discordId'
    }
  },
  itemId: {
    type: DataTypes.STRING,
    allowNull: false // Mã định danh của vật phẩm (ví dụ: 'gun', 'free_all_in')
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false // Số lượng vật phẩm sở hữu
  }
});

// Thiết lập quan hệ 1-Nhiều (Một User có nhiều vật phẩm trong kho đồ, một vật phẩm thuộc về một User)
User.hasMany(Inventory, { foreignKey: 'userId', as: 'inventories', onDelete: 'CASCADE' });
Inventory.belongsTo(User, { foreignKey: 'userId', as: 'user' });

/**
 * Lấy số dư hiện tại của người chơi. Tự động tạo bản ghi mới nếu người chơi chưa tồn tại.
 */
export async function getBalance(discordId, username = "Player") {
  // Tìm kiếm người dùng, nếu chưa có thì tạo mới với các giá trị mặc định
  const [user] = await User.findOrCreate({
    where: { discordId },
    defaults: { username, balance: 1000 }
  });
  return user.balance;
}

/**
 * Cộng thêm chips vào tài khoản của người chơi.
 */
export async function addBalance(discordId, amount, username = "Player") {
  // Tìm kiếm hoặc tạo mới người dùng
  const [user] = await User.findOrCreate({
    where: { discordId },
    defaults: { username, balance: 1000 }
  });
  user.balance += amount;
  await user.save(); // Lưu lại thay đổi vào SQLite
  return user.balance;
}

/**
 * Kiểm tra xem người chơi có đủ số dư không. Nếu đủ thì trừ tiền ngay và trả về true, ngược lại trả về false.
 */
export async function checkAndDeduct(discordId, amount, username = "Player") {
  // Tìm kiếm hoặc tạo mới người dùng
  const [user] = await User.findOrCreate({
    where: { discordId },
    defaults: { username, balance: 1000 }
  });

  if (user.balance < amount) {
    return false; // Số dư không đủ để thực hiện giao dịch
  }

  user.balance -= amount;
  await user.save(); // Thực hiện trừ tiền và lưu vào SQLite
  return true; // Trừ tiền thành công
}

export { sequelize, User, Inventory };
export default sequelize;

