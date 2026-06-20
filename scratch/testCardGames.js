import { evaluate5CardHand, evaluate7CardHand } from '../pokerLogic.js';
import { getPhomCardValue, isValidMeld, findBestMelds, canEatCard, canSendCard } from '../phomLogic.js';

function runPokerTests() {
  console.log("=========================================");
  console.log("RUNNING TEXAS HOLD'EM POKER LOGIC TESTS");
  console.log("=========================================");

  // 1. Royal Flush vs Straight Flush
  const royalFlush = [
    { value: "A", suit: "♥" },
    { value: "K", suit: "♥" },
    { value: "Q", suit: "♥" },
    { value: "J", suit: "♥" },
    { value: "10", suit: "♥" }
  ];
  const royalResult = evaluate5CardHand(royalFlush);
  console.log(`Royal Flush: ${royalResult.label} (Score: ${royalResult.score})`);

  const straightFlush = [
    { value: "9", suit: "♣" },
    { value: "8", suit: "♣" },
    { value: "7", suit: "♣" },
    { value: "6", suit: "♣" },
    { value: "5", suit: "♣" }
  ];
  const sfResult = evaluate5CardHand(straightFlush);
  console.log(`Straight Flush (9-high): ${sfResult.label} (Score: ${sfResult.score})`);
  console.log(`- Royal Flush beats Straight Flush? ${royalResult.score > sfResult.score ? "ĐÚNG" : "SAI"}`);

  // 2. Four of a Kind
  const fourOfAKind = [
    { value: "J", suit: "♠" },
    { value: "J", suit: "♣" },
    { value: "J", suit: "♦" },
    { value: "J", suit: "♥" },
    { value: "5", suit: "♥" }
  ];
  const quadResult = evaluate5CardHand(fourOfAKind);
  console.log(`Four of a Kind: ${quadResult.label} (Score: ${quadResult.score})`);

  // 3. Full House
  const fullHouse = [
    { value: "10", suit: "♠" },
    { value: "10", suit: "♣" },
    { value: "10", suit: "♦" },
    { value: "3", suit: "♥" },
    { value: "3", suit: "♣" }
  ];
  const fhResult = evaluate5CardHand(fullHouse);
  console.log(`Full House: ${fhResult.label} (Score: ${fhResult.score})`);
  console.log(`- Quad J beats Full House 10s? ${quadResult.score > fhResult.score ? "ĐÚNG" : "SAI"}`);

  // 4. Flush
  const flush = [
    { value: "A", suit: "♠" },
    { value: "10", suit: "♠" },
    { value: "8", suit: "♠" },
    { value: "6", suit: "♠" },
    { value: "4", suit: "♠" }
  ];
  const flushResult = evaluate5CardHand(flush);
  console.log(`Flush: ${flushResult.label} (Score: ${flushResult.score})`);

  // 5. Straight
  const straight = [
    { value: "8", suit: "♥" },
    { value: "7", suit: "♣" },
    { value: "6", suit: "♦" },
    { value: "5", suit: "♠" },
    { value: "4", suit: "♥" }
  ];
  const straightResult = evaluate5CardHand(straight);
  console.log(`Straight: ${straightResult.label} (Score: ${straightResult.score})`);
  console.log(`- Flush beats Straight? ${flushResult.score > straightResult.score ? "ĐÚNG" : "SAI"}`);

  // 6. Ace low straight
  const aceLowStraight = [
    { value: "A", suit: "♥" },
    { value: "5", suit: "♣" },
    { value: "4", suit: "♦" },
    { value: "3", suit: "♠" },
    { value: "2", suit: "♥" }
  ];
  const alsResult = evaluate5CardHand(aceLowStraight);
  console.log(`Ace-Low Straight: ${alsResult.label} (Score: ${alsResult.score})`);
  console.log(`- Straight 8 beats Straight 5? ${straightResult.score > alsResult.score ? "ĐÚNG" : "SAI"}`);

  // 7. 7-Card Hand Evaluation (best 5 out of 7)
  const hand7 = [
    { value: "A", suit: "♥" },
    { value: "K", suit: "♥" }, // Hole cards
    { value: "Q", suit: "♥" },
    { value: "J", suit: "♥" },
    { value: "10", suit: "♥" }, // Flop + Turn + River
    { value: "2", suit: "♣" },
    { value: "3", suit: "♦" }
  ];
  const best7 = evaluate7CardHand(hand7);
  console.log(`Best 5 of 7 cards: ${best7.label} (Score: ${best7.score})`);
  console.log(`- Hand includes Ace of Hearts? ${best7.cards.some(c => c.value === "A" && c.suit === "♥") ? "ĐÚNG" : "SAI"}`);
}

function runPhomTests() {
  console.log("\n=========================================");
  console.log("RUNNING PHOM (TA LA) LOGIC TESTS");
  console.log("=========================================");

  // 1. Phom checking
  const phom1 = [{ value: "J", suit: "♥" }, { value: "J", suit: "♠" }, { value: "J", suit: "♦" }];
  const phom2 = [{ value: "7", suit: "♣" }, { value: "8", suit: "♣" }, { value: "9", suit: "♣" }];
  const notPhom = [{ value: "A", suit: "♥" }, { value: "2", suit: "♥" }, { value: "4", suit: "♥" }];

  console.log(`isValidMeld (3x J): ${isValidMeld(phom1)} (Mong đợi: true)`);
  console.log(`isValidMeld (7-8-9 clubs): ${isValidMeld(phom2)} (Mong đợi: true)`);
  console.log(`isValidMeld (A-2-4 hearts): ${isValidMeld(notPhom)} (Mong đợi: false)`);

  // 2. Best Melds Finding
  const hand = [
    { value: "J", suit: "♥" }, { value: "J", suit: "♠" }, { value: "J", suit: "♦" }, // Phom 1
    { value: "7", suit: "♣" }, { value: "8", suit: "♣" }, { value: "9", suit: "♣" }, // Phom 2
    { value: "A", suit: "♦" }, { value: "2", suit: "♥" }, { value: "9", suit: "♦" }  // Trash: A (1) + 2 (2) + 9 (9) = 12 points
  ];

  const best = findBestMelds(hand);
  console.log(`Best Melds Found:`, best.melds.map(m => m.map(c => `${c.value}${c.suit}`).join("-")));
  console.log(`Trash cards left:`, best.trash.map(c => `${c.value}${c.suit}`).join(" "));
  console.log(`Best score: ${best.score} (Mong đợi: 12)`);

  // 3. canEatCard test
  const testHand = [
    { value: "7", suit: "♣" },
    { value: "8", suit: "♣" }
  ];
  const cardToEat = { value: "9", suit: "♣" };
  const cardCannotEat = { value: "K", suit: "♦" };
  console.log(`Can eat 9 clubs? ${canEatCard(testHand, cardToEat)} (Mong đợi: true)`);
  console.log(`Can eat K diamonds? ${canEatCard(testHand, cardCannotEat)} (Mong đợi: false)`);

  // 4. canSendCard test
  const declaredMeld = [
    { value: "7", suit: "♥" },
    { value: "8", suit: "♥" },
    { value: "9", suit: "♥" }
  ];
  const cardToSend1 = { value: "6", suit: "♥" };
  const cardToSend2 = { value: "10", suit: "♥" };
  const cardCannotSend = { value: "A", suit: "♥" };

  console.log(`Can send 6 hearts to 7-8-9 hearts? ${canSendCard(declaredMeld, cardToSend1)} (Mong đợi: true)`);
  console.log(`Can send 10 hearts to 7-8-9 hearts? ${canSendCard(declaredMeld, cardToSend2)} (Mong đợi: true)`);
  console.log(`Can send A hearts to 7-8-9 hearts? ${canSendCard(declaredMeld, cardCannotSend)} (Mong đợi: false)`);
}

runPokerTests();
runPhomTests();
