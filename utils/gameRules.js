const KILLS_PER_LEVEL = 5;
const BASE_MAX_HP = 100;
const HP_BONUS_PER_LEVEL = 10;

function calculateLevel(zombiesKilled) {
  return Math.floor(zombiesKilled / KILLS_PER_LEVEL) + 1;
}

function calculateMaxHP(level) {
  return BASE_MAX_HP + (level - 1) * HP_BONUS_PER_LEVEL;
}

module.exports = { calculateLevel, calculateMaxHP, KILLS_PER_LEVEL };