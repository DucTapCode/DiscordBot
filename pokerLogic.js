// Ranks for Poker: A=14, K=13, Q=12, J=11, 10=10, ..., 2=2
// Suits: ♠, ♣, ♦, ♥

export function getCardScore(card) {
  const rankMap = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
    "J": 11, "Q": 12, "K": 13, "A": 14
  };
  if (card.value !== undefined) {
    return rankMap[card.value] || 2;
  }
  return card.rank || 2;
}

function getRankLabel(rank) {
  const labels = { 11: "J", 12: "Q", 13: "K", 14: "A" };
  return labels[rank] || rank.toString();
}

/**
 * Đánh giá sức mạnh của đúng 5 lá bài
 * @param {Array} cards - Mảng 5 lá bài
 * @returns {object} { type, rankVal, score, label }
 */
export function evaluate5CardHand(cards) {
  const sorted = [...cards].sort((a, b) => getCardScore(b) - getCardScore(a));
  const ranks = sorted.map(c => getCardScore(c));
  const suits = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Check straight (gồm cả sảnh rồng A-2-3-4-5)
  let isStraight = false;
  let straightHigh = ranks[0];

  if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
    isStraight = true;
    straightHigh = 5;
  } else {
    isStraight = true;
    for (let i = 0; i < 4; i++) {
      if (ranks[i] - ranks[i + 1] !== 1) {
        isStraight = false;
        break;
      }
    }
  }

  // Nhóm tần suất xuất hiện các rank
  const counts = {};
  for (const r of ranks) {
    counts[r] = (counts[r] || 0) + 1;
  }

  const freq = Object.entries(counts).map(([rank, count]) => ({
    rank: parseInt(rank),
    count
  })).sort((a, b) => b.count - a.count || b.rank - a.rank);

  // 1. Thùng phá sảnh (Straight Flush)
  if (isStraight && isFlush) {
    return {
      type: "Straight Flush",
      rankVal: 9,
      score: 9 * 10000000 + straightHigh,
      label: straightHigh === 14 ? "Thùng Phá Sảnh Hoàng Gia (Royal Flush) 👑" : `Thùng Phá Sảnh (Straight Flush) tới ${getRankLabel(straightHigh)}`
    };
  }

  // 2. Tứ quý (Four of a Kind)
  if (freq[0].count === 4) {
    const quad = freq[0].rank;
    const kicker = freq[1].rank;
    return {
      type: "Four of a Kind",
      rankVal: 8,
      score: 8 * 10000000 + quad * 15 + kicker,
      label: `Tứ Quý ${getRankLabel(quad)}`
    };
  }

  // 3. Cù lũ (Full House)
  if (freq[0].count === 3 && freq[1].count === 2) {
    const triple = freq[0].rank;
    const pair = freq[1].rank;
    return {
      type: "Full House",
      rankVal: 7,
      score: 7 * 10000000 + triple * 15 + pair,
      label: `Cù Lũ (${getRankLabel(triple)} và ${getRankLabel(pair)})`
    };
  }

  // 4. Thùng (Flush)
  if (isFlush) {
    const tieBreaker = ranks.reduce((acc, r, idx) => acc + r * Math.pow(15, 4 - idx), 0);
    return {
      type: "Flush",
      rankVal: 6,
      score: 6 * 10000000 + tieBreaker,
      label: `Thùng (Flush) với lá cao nhất ${getRankLabel(ranks[0])}`
    };
  }

  // 5. Sảnh (Straight)
  if (isStraight) {
    return {
      type: "Straight",
      rankVal: 5,
      score: 5 * 10000000 + straightHigh,
      label: `Sảnh (Straight) tới ${getRankLabel(straightHigh)}`
    };
  }

  // 6. Sám cô (Three of a Kind)
  if (freq[0].count === 3) {
    const triple = freq[0].rank;
    const kicker1 = freq[1].rank;
    const kicker2 = freq[2].rank;
    return {
      type: "Three of a Kind",
      rankVal: 4,
      score: 4 * 10000000 + triple * 225 + kicker1 * 15 + kicker2,
      label: `Sám Cô ${getRankLabel(triple)}`
    };
  }

  // 7. Thú (Two Pair)
  if (freq[0].count === 2 && freq[1].count === 2) {
    const pair1 = freq[0].rank;
    const pair2 = freq[1].rank;
    const kicker = freq[2].rank;
    return {
      type: "Two Pair",
      rankVal: 3,
      score: 3 * 10000000 + pair1 * 225 + pair2 * 15 + kicker,
      label: `Thú (Hai Đôi: ${getRankLabel(pair1)} và ${getRankLabel(pair2)})`
    };
  }

  // 8. Một Đôi (One Pair)
  if (freq[0].count === 2) {
    const pair = freq[0].rank;
    const kicker1 = freq[1].rank;
    const kicker2 = freq[2].rank;
    const kicker3 = freq[3].rank;
    const tieBreaker = pair * Math.pow(15, 3) + kicker1 * Math.pow(15, 2) + kicker2 * 15 + kicker3;
    return {
      type: "One Pair",
      rankVal: 2,
      score: 2 * 10000000 + tieBreaker,
      label: `Một Đôi ${getRankLabel(pair)}`
    };
  }

  // 9. Mậu thầu (High Card)
  const tieBreaker = ranks.reduce((acc, r, idx) => acc + r * Math.pow(15, 4 - idx), 0);
  return {
    type: "High Card",
    rankVal: 1,
    score: 1 * 10000000 + tieBreaker,
    label: `Mậu Thầu (Bài Cao: ${getRankLabel(ranks[0])})`
  };
}

/**
 * Tìm tổ hợp 5 lá mạnh nhất trong số 7 lá (2 lá tẩy + 5 lá chung)
 * @param {Array} cards - Mảng 7 lá bài
 * @returns {object} Tổ hợp 5 lá mạnh nhất
 */
export function evaluate7CardHand(cards) {
  if (cards.length < 5) return null;
  
  let bestHand = null;

  // Thuật toán đệ quy sinh các tổ hợp C(n, k)
  function getCombinations(arr, k) {
    const results = [];
    function helper(start, combo) {
      if (combo.length === k) {
        results.push([...combo]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        helper(i + 1, combo);
        combo.pop();
      }
    }
    helper(0, []);
    return results;
  }

  const combos = getCombinations(cards, 5);
  for (const combo of combos) {
    const evalResult = evaluate5CardHand(combo);
    if (!bestHand || evalResult.score > bestHand.score) {
      bestHand = {
        ...evalResult,
        cards: combo
      };
    }
  }

  return bestHand;
}
