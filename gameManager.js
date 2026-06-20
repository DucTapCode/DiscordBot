// Quản lý trạng thái các phòng chơi Casino (Tiến Lên, Phỏm, Poker, Blackjack)
// Sử dụng bộ nhớ trong Map để lưu các phòng chơi theo Channel ID của Discord

const activeGames = new Map();

/**
 * Tạo một phòng chơi mới.
 */
export function createGame(channelId, gameType, creator) {
  const game = {
    channelId,
    type: gameType,      // "tienlen", "blackjack", etc.
    creatorId: creator.id,
    creatorName: creator.username,
    status: 'WAITING',   // 'WAITING', 'PLAYING', 'FINISHED'
    players: [
      {
        id: creator.id,
        name: creator.username,
        cards: [],       // Bài trên tay
        hasPassed: false // Trạng thái bỏ lượt (dành riêng cho Tiến Lên)
      }
    ],
    state: {
      turnIndex: 0,
      lastPlayedCards: [],
      lastPlayedUserId: null,
      deck: [],
      pot: 0 // Cho Poker hoặc Blackjack
    },
    createdAt: Date.now()
  };
  
  activeGames.set(channelId, game);
  return game;
}

/**
 * Lấy thông tin phòng chơi của Channel hiện tại.
 */
export function getGame(channelId) {
  return activeGames.get(channelId);
}

/**
 * Xóa phòng chơi (khi kết thúc game hoặc hủy phòng).
 */
export function deleteGame(channelId) {
  return activeGames.delete(channelId);
}

export { activeGames };
