import { evaluateHand, canPlay, sortCards } from './tienLenLogic.js';

// Khởi tạo bộ bài giả lập để tiện test
const C3B = { value: '3', suit: '♠', rank: 3 };
const C3C = { value: '3', suit: '♣', rank: 3 };
const C3R = { value: '3', suit: '♦', rank: 3 };
const C3Co = { value: '3', suit: '♥', rank: 3 };

const C4B = { value: '4', suit: '♠', rank: 4 };
const C4C = { value: '4', suit: '♣', rank: 4 };
const C4R = { value: '4', suit: '♦', rank: 4 };
const C4Co = { value: '4', suit: '♥', rank: 4 };

const C5B = { value: '5', suit: '♠', rank: 5 };
const C5C = { value: '5', suit: '♣', rank: 5 };
const C5R = { value: '5', suit: '♦', rank: 5 };
const C5Co = { value: '5', suit: '♥', rank: 5 };

const C6B = { value: '6', suit: '♠', rank: 6 };
const C6C = { value: '6', suit: '♣', rank: 6 };
const C6R = { value: '6', suit: '♦', rank: 6 };
const C6Co = { value: '6', suit: '♥', rank: 6 };

const C10B = { value: '10', suit: '♠', rank: 10 };
const CJB = { value: 'J', suit: '♠', rank: 11 };
const CQB = { value: 'Q', suit: '♠', rank: 12 };
const CKB = { value: 'K', suit: '♠', rank: 13 };
const CAB = { value: 'A', suit: '♠', rank: 14 };
const CAC = { value: 'A', suit: '♣', rank: 14 };

const C2B = { value: '2', suit: '♠', rank: 15 };
const C2C = { value: '2', suit: '♣', rank: 15 };
const C2R = { value: '2', suit: '♦', rank: 15 };
const C2Co = { value: '2', suit: '♥', rank: 15 };

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
  }
}

console.log("=== BẮT ĐẦU CHẠY UNIT TEST CHO TIẾN LÊN MIỀN NAM CORE ENGINE ===\n");

// ==========================================
// TEST SUITE 1: Kiểm tra evaluateHand
// ==========================================
console.log("--- Test Suite 1: evaluateHand ---");

// 1. Single (Rác)
assert(
  evaluateHand([C3B]).type === 'SINGLE' && evaluateHand([C3B]).highestCard === C3B,
  "Nhận dạng lá bài Rác (Single)"
);

// 2. Pair (Đôi)
assert(
  evaluateHand([C3B, C3Co]).type === 'PAIR' && evaluateHand([C3B, C3Co]).highestCard === C3Co,
  "Nhận dạng Đôi và lấy lá lớn nhất đúng chất"
);
assert(
  evaluateHand([C3B, C4B]).type === 'INVALID',
  "Phát hiện Đôi không hợp lệ (khác rank)"
);

// 3. Triple (Sám cô)
assert(
  evaluateHand([C3B, C3C, C3Co]).type === 'TRIPLE',
  "Nhận dạng Sám cô (Triple)"
);

// 4. Four of a kind (Tứ quý)
assert(
  evaluateHand([C3B, C3C, C3R, C3Co]).type === 'FOUR_OF_A_KIND',
  "Nhận dạng Tứ quý"
);

// 5. Straight (Sảnh)
assert(
  evaluateHand([C3B, C4C, C5R]).type === 'STRAIGHT' && evaluateHand([C3B, C4C, C5R]).highestCard === C5R,
  "Nhận dạng Sảnh 3 lá (3-4-5)"
);
assert(
  evaluateHand([C10B, CJB, CQB, CKB, CAB]).type === 'STRAIGHT',
  "Nhận dạng Sảnh 5 lá (10-J-Q-K-A)"
);
assert(
  evaluateHand([CAB, C2B, C3B]).type === 'INVALID',
  "Sảnh không được chứa Heo (A-2-3 -> INVALID)"
);
assert(
  evaluateHand([C3B, C4B, C6B]).type === 'INVALID',
  "Sảnh đứt đoạn (3-4-6 -> INVALID)"
);

// 6. Pairs Chains (Đôi thông)
assert(
  evaluateHand([C3B, C3C, C4B, C4C, C5B, C5C]).type === 'THREE_PAIRS_CHAIN',
  "Nhận dạng 3 Đôi thông"
);
assert(
  evaluateHand([C3B, C3C, C4B, C4C, C5B, C5C, C6B, C6C]).type === 'FOUR_PAIRS_CHAIN',
  "Nhận dạng 4 Đôi thông"
);
assert(
  evaluateHand([C3B, C3C, C4B, C5C, C6B, C6C]).type === 'INVALID',
  "Đôi thông không hợp lệ (thiếu hoặc lệch cặp)"
);
assert(
  evaluateHand([C10B, C10B, CJB, CJB, CKB, CKB]).type === 'INVALID',
  "Đôi thông lệch rank (10-J-K -> INVALID)"
);


// ==========================================
// TEST SUITE 2: Kiểm tra canPlay (Luật đè thông thường)
// ==========================================
console.log("\n--- Test Suite 2: canPlay (Luật đè thông thường) ---");

// 1. Lượt mới (previous rỗng)
assert(
  canPlay([C3B], []) === true,
  "Lượt mới: Đánh lá bài hợp lệ bất kỳ (C3B) -> True"
);
assert(
  canPlay([C3B, C4B], []) === false,
  "Lượt mới: Đánh bộ bài không hợp lệ (C3B, C4B) -> False"
);

// 2. Đè Rác (Single)
assert(
  canPlay([C3Co], [C3B]) === true,
  "Rác Cơ đè được Rác Bích cùng rank (3♥ > 3♠)"
);
assert(
  canPlay([C3B], [C3Co]) === false,
  "Rác Bích KHÔNG đè được Rác Cơ cùng rank (3♠ < 3♥)"
);
assert(
  canPlay([C4B], [C3Co]) === true,
  "Rác lớn rank đè được rác nhỏ rank dù khác chất (4♠ > 3♥)"
);

// 3. Đè Đôi (Pair)
assert(
  canPlay([C4B, C4Co], [C3B, C3Co]) === true,
  "Đôi 4 đè Đôi 3 -> True"
);
assert(
  canPlay([C3B, C3Co], [C4B, C4Co]) === false,
  "Đôi 3 KHÔNG đè được Đôi 4 -> False"
);

// 4. Đè Sảnh (Straight)
assert(
  canPlay([C4B, C5C, C6R], [C3B, C4C, C5R]) === true,
  "Sảnh 4-5-6 đè Sảnh 3-4-5 -> True"
);
assert(
  canPlay([C3B, C4C, C5Co], [C3C, C4R, C5R]) === true,
  "Sảnh 3-4-5♥ đè Sảnh 3-4-5♦ -> True"
);
assert(
  canPlay([C3B, C4C, C5R, C6B], [C3C, C4R, C5Co]) === false,
  "Sảnh khác độ dài (4 lá vs 3 lá) KHÔNG đè được -> False"
);


// ==========================================
// TEST SUITE 3: Kiểm tra canPlay (Luật chặt đặc biệt)
// ==========================================
console.log("\n--- Test Suite 3: canPlay (Luật chặt heo và chặt đè) ---");

// 1. Chặt Heo rác (Single Heo)
const singleHeo = [C2B];
const baDoiThong = [C3B, C3C, C4B, C4C, C5B, C5C];
const tuQuy = [C3B, C3C, C3R, C3Co];
const bonDoiThong = [C3B, C3C, C4B, C4C, C5B, C5C, C6B, C6C];

assert(
  canPlay(baDoiThong, singleHeo) === true,
  "3 đôi thông CHẶT được 1 Heo -> True"
);
assert(
  canPlay(tuQuy, singleHeo) === true,
  "Tứ quý CHẶT được 1 Heo -> True"
);
assert(
  canPlay(bonDoiThong, singleHeo) === true,
  "4 đôi thông CHẶT được 1 Heo -> True"
);

// 2. Chặt Đôi Heo (Pair Heo)
const doiHeo = [C2B, C2Co];
assert(
  canPlay(tuQuy, doiHeo) === true,
  "Tứ quý CHẶT được Đôi Heo -> True"
);
assert(
  canPlay(bonDoiThong, doiHeo) === true,
  "4 đôi thông CHẶT được Đôi Heo -> True"
);
assert(
  canPlay(baDoiThong, doiHeo) === false,
  "3 đôi thông KHÔNG CHẶT được Đôi Heo -> False"
);

// 3. Chặt chồng / Chặt đè
assert(
  canPlay(tuQuy, baDoiThong) === true,
  "Tứ quý CHẶT ĐÈ được 3 đôi thông -> True"
);
assert(
  canPlay(bonDoiThong, baDoiThong) === true,
  "4 đôi thông CHẶT ĐÈ được 3 đôi thông -> True"
);
assert(
  canPlay(bonDoiThong, tuQuy) === true,
  "4 đôi thông CHẶT ĐÈ được Tứ quý -> True"
);
assert(
  canPlay(baDoiThong, tuQuy) === false,
  "3 đôi thông KHÔNG CHẶT ĐÈ được Tứ quý -> False"
);

// 4. Đè đôi thông cùng loại
const baDoiThongNho = [C3B, C3C, C4B, C4C, C5B, C5C];
const baDoiThongLon = [C4B, C4C, C5B, C5C, C6B, C6Co];
assert(
  canPlay(baDoiThongLon, baDoiThongNho) === true,
  "3 đôi thông lớn đè 3 đôi thông nhỏ -> True"
);
assert(
  canPlay(baDoiThongNho, baDoiThongLon) === false,
  "3 đôi thông nhỏ KHÔNG đè được 3 đôi thông lớn -> False"
);

console.log(`\n=== KẾT QUẢ: Đã vượt qua ${passedTests}/${totalTests} tests. ===`);
if (passedTests === totalTests) {
  console.log("TẤT CẢ TESTS ĐỀU ĐẠT CHUẨN!");
} else {
  console.error("CÓ TEST THẤT BẠI. CẦN KIỂM TRA LẠI!");
}
