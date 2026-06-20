// Ranks for Phom: A=1, 2=2, 3=3, ..., J=11, Q=12, K=13
// Suits: ♠, ♣, ♦, ♥

export function getPhomCardValue(card) {
  const valMap = {
    "A": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
    "J": 11, "Q": 12, "K": 13
  };
  if (card.value !== undefined) {
    return valMap[card.value] || 1;
  }
  // Fallback for Tiến Lên card formats if needed
  if (card.rank !== undefined) {
    // In Tien Len, card.rank for 3 is 3, 4 is 4, 10 is 10, J is 11, Q is 12, K is 13, A is 14, 2 is 15.
    // In Phom, A should be 1, 2 should be 2, J is 11, Q is 12, K is 13.
    if (card.rank === 14) return 1;  // Ace
    if (card.rank === 15) return 2;  // 2
    return card.rank;
  }
  return 1;
}

/**
 * Kiểm tra mảng lá bài có tạo thành Phỏm hợp lệ không
 */
export function isValidMeld(cards) {
  if (cards.length < 3) return false;

  // 1. Phỏm Ngang (Cùng giá trị)
  const firstVal = cards[0].value;
  const sameRank = cards.every(c => c.value === firstVal);
  if (sameRank) return true;

  // 2. Phỏm Dọc (Đồng chất liên tiếp)
  const firstSuit = cards[0].suit;
  const sameSuit = cards.every(c => c.suit === firstSuit);
  if (!sameSuit) return false;

  // Sắp xếp các giá trị theo thứ tự tăng dần của Phỏm (A=1, 2=2, ..., K=13)
  const sortedValues = cards.map(c => getPhomCardValue(c)).sort((a, b) => a - b);
  for (let i = 0; i < sortedValues.length - 1; i++) {
    if (sortedValues[i + 1] - sortedValues[i] !== 1) {
      return false;
    }
  }
  return true;
}

/**
 * Tìm tập hợp các Phỏm tối ưu nhất để số điểm của các lá rác còn lại là nhỏ nhất.
 * @param {Array} handCards - Mảng các lá bài trên tay
 * @returns {object} { melds: Mảng các phỏm, trash: Mảng các lá rác, score: Điểm rác }
 */
export function findBestMelds(handCards) {
  // 1. Tìm tất cả các Phỏm có thể có từ handCards
  const allPossibleMelds = [];

  function combine(start, currentCombo, currentIndices) {
    if (currentCombo.length >= 3) {
      if (isValidMeld(currentCombo)) {
        allPossibleMelds.push({
          cards: [...currentCombo],
          indices: [...currentIndices]
        });
      }
    }
    for (let i = start; i < handCards.length; i++) {
      currentCombo.push(handCards[i]);
      currentIndices.push(i);
      combine(i + 1, currentCombo, currentIndices);
      currentCombo.pop();
      currentIndices.pop();
    }
  }

  combine(0, [], []);

  // 2. Thuật toán DFS tìm tổ hợp Phỏm không trùng lặp tối ưu
  let bestMelds = [];
  let minScore = Infinity;
  let bestTrash = [...handCards];

  function search(index, currentMelds, usedMask) {
    const unusedCards = [];
    for (let i = 0; i < handCards.length; i++) {
      if (!(usedMask & (1 << i))) {
        unusedCards.push(handCards[i]);
      }
    }

    const score = unusedCards.reduce((sum, c) => sum + getPhomCardValue(c), 0);
    if (score < minScore) {
      minScore = score;
      bestMelds = [...currentMelds];
      bestTrash = unusedCards;
    }

    for (let i = index; i < allPossibleMelds.length; i++) {
      const meldIndices = allPossibleMelds[i].indices;
      let overlap = false;
      for (const idx of meldIndices) {
        if (usedMask & (1 << idx)) {
          overlap = true;
          break;
        }
      }
      if (!overlap) {
        let newMask = usedMask;
        for (const idx of meldIndices) {
          newMask |= (1 << idx);
        }
        currentMelds.push(allPossibleMelds[i].cards);
        search(i + 1, currentMelds, newMask);
        currentMelds.pop();
      }
    }
  }

  search(0, [], 0);

  return {
    melds: bestMelds,
    trash: bestTrash,
    score: minScore === Infinity ? handCards.reduce((sum, c) => sum + getPhomCardValue(c), 0) : minScore
  };
}

/**
 * Kiểm tra xem người chơi có thể ăn một lá bài vừa bị đánh ra hay không
 */
export function canEatCard(handCards, discardCard) {
  const combined = [...handCards, discardCard];
  
  // Tìm tất cả các phỏm trong bộ bài kết hợp
  const allPossibleMelds = [];
  function combine(start, currentCombo) {
    if (currentCombo.length >= 3) {
      if (isValidMeld(currentCombo)) {
        allPossibleMelds.push([...currentCombo]);
      }
    }
    for (let i = start; i < combined.length; i++) {
      currentCombo.push(combined[i]);
      combine(i + 1, currentCombo);
      currentCombo.pop();
    }
  }
  
  combine(0, []);

  // Kiểm tra xem có phỏm nào chứa lá bài discardCard hay không
  for (const meld of allPossibleMelds) {
    const containsDiscard = meld.some(c => c.value === discardCard.value && c.suit === discardCard.suit);
    if (containsDiscard) {
      return true;
    }
  }
  return false;
}

/**
 * Kiểm tra xem một lá bài có thể gửi vào một Phỏm đã hạ của người khác không
 */
export function canSendCard(meld, card) {
  if (!meld || meld.length < 3) return false;

  // 1. Phỏm Ngang
  if (meld[0].value === meld[1].value) {
    return card.value === meld[0].value;
  }

  // 2. Phỏm Dọc
  if (meld[0].suit === card.suit) {
    const meldValues = meld.map(c => getPhomCardValue(c)).sort((a, b) => a - b);
    const cardValue = getPhomCardValue(card);
    const minMeldVal = meldValues[0];
    const maxMeldVal = meldValues[meldValues.length - 1];

    if (cardValue === minMeldVal - 1 || cardValue === maxMeldVal + 1) {
      return true;
    }
  }

  return false;
}
