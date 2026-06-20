/**
 * Core Engine xử lý logic bài Tiến Lên Miền Nam.
 * Module này độc lập hoàn toàn với Discord API hay Database.
 *
 * Cấu trúc lá bài:
 * { value: '3', suit: '♥', rank: 3 }
 * - value: Kí hiệu quân bài ('3', '4', ..., '10', 'J', 'Q', 'K', 'A', '2')
 * - suit: Chất bài ('♠', '♣', '♦', '♥')
 * - rank: Độ lớn số học để so sánh (3 -> 15)
 */

// Định nghĩa giá trị cho các chất bài để phục vụ so sánh (Bích < Chuồn < Rô < Cơ)
const SUIT_VALUES = {
  "♠": 1, // Bích
  "♣": 2, // Chuồn (Nhép)
  "♦": 3, // Rô
  "♥": 4, // Cơ
};

/**
 * So sánh độ lớn giữa 2 lá bài.
 * Trả về số âm nếu card1 < card2, số dương nếu card1 > card2, 0 nếu bằng nhau.
 * Quy tắc: So sánh rank trước, nếu trùng rank thì so sánh suit (chất).
 */
export function compareCards(card1, card2) {
  if (card1.rank !== card2.rank) {
    return card1.rank - card2.rank;
  }
  return SUIT_VALUES[card1.suit] - SUIT_VALUES[card2.suit];
}

/**
 * Sắp xếp danh sách lá bài tăng dần theo độ lớn.
 */
export function sortCards(cards) {
  return [...cards].sort(compareCards);
}

/**
 * Kiểm tra xem mảng bài có phải là một Sảnh (Straight) hợp lệ hay không.
 * Trong Tiến Lên Miền Nam, Sảnh:
 * - Có độ dài từ 3 lá trở lên.
 * - Không được chứa quân Heo (rank = 15).
 * - Các quân bài phải có rank liên tiếp nhau (ví dụ: 3-4-5, 10-J-Q-K-A).
 */
function isStraight(sortedCards) {
  const n = sortedCards.length;
  if (n < 3) return false;

  // Sảnh không được phép chứa Heo (rank = 15)
  if (sortedCards.some((card) => card.rank === 15)) {
    return false;
  }

  // Kiểm tra tính liên tiếp của rank
  for (let i = 1; i < n; i++) {
    if (sortedCards[i].rank !== sortedCards[i - 1].rank + 1) {
      return false;
    }
  }
  return true;
}

/**
 * Kiểm tra xem mảng bài có phải là một bộ Đôi Thông hợp lệ hay không.
 * Đôi thông:
 * - Số lượng lá bài phải là số chẵn và từ 6 lá trở lên (tương đương 3 đôi thông trở lên).
 * - Gồm các đôi bài liên tiếp nhau về rank.
 * - Theo luật chuẩn Tiến Lên Miền Nam, đôi thông không chứa quân Heo (rank = 15).
 */
function checkPairsChain(sortedCards) {
  const n = sortedCards.length;
  if (n < 6 || n % 2 !== 0) {
    return { isChain: false, numPairs: 0 };
  }

  const numPairs = n / 2;

  // Đôi thông không được phép chứa Heo (rank = 15)
  if (sortedCards.some((card) => card.rank === 15)) {
    return { isChain: false, numPairs: 0 };
  }

  // Vòng lặp kiểm tra:
  // 1. Mỗi cặp (i*2, i*2 + 1) phải là một Đôi (cùng rank).
  // 2. Rank của đôi sau phải lớn hơn đôi trước đúng 1 đơn vị.
  for (let i = 0; i < numPairs; i++) {
    const card1 = sortedCards[i * 2];
    const card2 = sortedCards[i * 2 + 1];

    // Kiểm tra xem hai lá trong cặp có cùng rank hay không
    if (card1.rank !== card2.rank) {
      return { isChain: false, numPairs: 0 };
    }

    // So sánh rank giữa đôi hiện tại và đôi trước đó
    if (i > 0) {
      const prevPairCard = sortedCards[(i - 1) * 2];
      if (card1.rank !== prevPairCard.rank + 1) {
        return { isChain: false, numPairs: 0 };
      }
    }
  }

  return { isChain: true, numPairs };
}

/**
 * Phân tích mảng lá bài đánh ra là loại bộ bài gì.
 * Trả về object: { type: String, highestCard: Card }
 *
 * Các loại bộ bài (Hand Types):
 * - 'INVALID': Không hợp lệ
 * - 'SINGLE': Rác (1 lá)
 * - 'PAIR': Đôi (2 lá cùng rank)
 * - 'TRIPLE': Sám cô / Ba lá (3 lá cùng rank)
 * - 'FOUR_OF_A_KIND': Tứ quý (4 lá cùng rank)
 * - 'STRAIGHT': Sảnh (3 lá trở lên liên tiếp, không chứa Heo)
 * - 'THREE_PAIRS_CHAIN': 3 đôi thông
 * - 'FOUR_PAIRS_CHAIN': 4 đôi thông
 * - 'FIVE_PAIRS_CHAIN': 5 đôi thông
 */
export function evaluateHand(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return { type: "INVALID", highestCard: null };
  }

  // Sắp xếp bài trước khi phân tích để dễ so sánh
  const sorted = sortCards(cards);
  const n = sorted.length;
  const highestCard = sorted[n - 1]; // Lá lớn nhất luôn nằm ở cuối mảng đã sort

  // 1. Rác (1 lá)
  if (n === 1) {
    return { type: "SINGLE", highestCard };
  }

  // 2. Đôi (2 lá)
  if (n === 2) {
    if (sorted[0].rank === sorted[1].rank) {
      return { type: "PAIR", highestCard };
    }
    return { type: "INVALID", highestCard: null };
  }

  // 3. Sám cô / Ba lá (3 lá)
  if (n === 3) {
    if (
      sorted[0].rank === sorted[1].rank &&
      sorted[1].rank === sorted[2].rank
    ) {
      return { type: "TRIPLE", highestCard };
    }
    // Kiểm tra xem có phải sảnh 3 lá không
    if (isStraight(sorted)) {
      return { type: "STRAIGHT", highestCard };
    }
    return { type: "INVALID", highestCard: null };
  }

  // 4. Tứ quý (4 lá)
  if (n === 4) {
    if (
      sorted[0].rank === sorted[1].rank &&
      sorted[1].rank === sorted[2].rank &&
      sorted[2].rank === sorted[3].rank
    ) {
      return { type: "FOUR_OF_A_KIND", highestCard };
    }
    // Kiểm tra xem có phải sảnh 4 lá không
    if (isStraight(sorted)) {
      return { type: "STRAIGHT", highestCard };
    }
    return { type: "INVALID", highestCard: null };
  }

  // 5. Kiểm tra các trường hợp từ 5 lá trở lên
  // Kiểm tra sảnh trước
  if (isStraight(sorted)) {
    return { type: "STRAIGHT", highestCard };
  }

  // Kiểm tra các đôi thông
  const chainCheck = checkPairsChain(sorted);
  if (chainCheck.isChain) {
    if (chainCheck.numPairs === 3) {
      return { type: "THREE_PAIRS_CHAIN", highestCard };
    }
    if (chainCheck.numPairs === 4) {
      return { type: "FOUR_PAIRS_CHAIN", highestCard };
    }
    if (chainCheck.numPairs === 5) {
      return { type: "FIVE_PAIRS_CHAIN", highestCard };
    }
  }

  // Nếu không khớp với bất kỳ loại bài hợp lệ nào
  return { type: "INVALID", highestCard: null };
}

/**
 * So sánh xem bộ bài vừa đánh (currentTurnCards) có hợp lệ để đè bộ bài của người đi trước (previousTurnCards) không.
 * Trả về true nếu hợp lệ, false nếu không.
 *
 * Các luật chặt đặc biệt được áp dụng:
 * 1. Chặt Heo rác (Single Heo - rank 15):
 *    - Bị chặt bởi: 3 đôi thông, Tứ quý, 4 đôi thông.
 * 2. Chặt Đôi Heo (Pair Heo - rank 15):
 *    - Bị chặt bởi: Tứ quý, 4 đôi thông. (Chú ý: 3 đôi thông không chặt được đôi heo).
 * 3. Chặt 3 Đôi Thông (THREE_PAIRS_CHAIN):
 *    - Bị chặt bởi: Tứ quý, 4 đôi thông, hoặc 3 đôi thông lớn hơn.
 * 4. Chặt Tứ Quý (FOUR_OF_A_KIND):
 *    - Bị chặt bởi: 4 đôi thông, hoặc tứ quý lớn hơn.
 * 5. Chặt 4 Đôi Thông (FOUR_PAIRS_CHAIN):
 *    - Bị chặt bởi: 4 đôi thông lớn hơn.
 */
export function canPlay(currentTurnCards, previousTurnCards) {
  // 1. Phân tích bộ bài người chơi định đánh
  const currentHand = evaluateHand(currentTurnCards);
  if (currentHand.type === "INVALID") {
    return false; // Bài định đánh không hợp lệ thì chắc chắn không được đi
  }

  // 2. Nếu đây là lượt mới (không có ai đi trước hoặc mọi người trước đó đã bỏ lượt)
  if (
    !previousTurnCards ||
    !Array.isArray(previousTurnCards) ||
    previousTurnCards.length === 0
  ) {
    return true; // Đi thoải mái miễn là bài hợp lệ
  }

  // 3. Phân tích bộ bài của lượt trước
  const previousHand = evaluateHand(previousTurnCards);
  if (previousHand.type === "INVALID") {
    return false; // Tránh lỗi nếu bài trước bị lỗi, tuy nhiên thực tế bài trước luôn hợp lệ
  }

  // 4. So sánh đè bài cùng loại
  if (currentHand.type === previousHand.type) {
    // Với các loại thông thường (Rác, Đôi, Sám, Sảnh) hoặc Đôi thông đè nhau cùng loại:
    // Số lượng lá bài bắt buộc phải bằng nhau.
    if (currentTurnCards.length !== previousTurnCards.length) {
      return false;
    }
    // So sánh lá bài lớn nhất của hai bên
    return compareCards(currentHand.highestCard, previousHand.highestCard) > 0;
  }

  // 5. Xử lý các luật CHẶT đặc biệt (khác loại bài)

  // A. Trường hợp bài trước là RÁC HEO (SINGLE Heo - rank = 15)
  if (previousHand.type === "SINGLE" && previousHand.highestCard.rank === 15) {
    // HEO bị chặt bởi: 3 đôi thông, Tứ quý, 4 đôi thông
    return (
      currentHand.type === "THREE_PAIRS_CHAIN" ||
      currentHand.type === "FOUR_OF_A_KIND" ||
      currentHand.type === "FOUR_PAIRS_CHAIN"
    );
  }

  // B. Trường hợp bài trước là ĐÔI HEO (PAIR Heo - rank = 15)
  if (previousHand.type === "PAIR" && previousHand.highestCard.rank === 15) {
    // ĐÔI HEO bị chặt bởi: Tứ quý, 4 đôi thông (3 đôi thông không chặt được đôi heo)
    return (
      currentHand.type === "FOUR_OF_A_KIND" ||
      currentHand.type === "FOUR_PAIRS_CHAIN"
    );
  }

  // C. Trường hợp bài trước là 3 ĐÔI THÔNG (THREE_PAIRS_CHAIN)
  if (previousHand.type === "THREE_PAIRS_CHAIN") {
    // 3 đôi thông bị chặt đè bởi: Tứ quý, 4 đôi thông
    return (
      currentHand.type === "FOUR_OF_A_KIND" ||
      currentHand.type === "FOUR_PAIRS_CHAIN"
    );
  }

  // D. Trường hợp bài trước là TỨ QUÝ (FOUR_OF_A_KIND)
  if (previousHand.type === "FOUR_OF_A_KIND") {
    // Tứ quý bị chặt đè bởi: 4 đôi thông
    return currentHand.type === "FOUR_PAIRS_CHAIN";
  }

  // E. 4 đôi thông chỉ bị chặt bởi 4 đôi thông lớn hơn (đã được so sánh ở mục 4 cùng loại)

  // Mặc định các trường hợp khác loại bài khác không chặt được nhau
  return false;
}
