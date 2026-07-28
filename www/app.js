import { generateCard } from "../lib/card.ts";
import { setOracles } from "../lib/oracle_data.ts";
import { parseSpritesheet, renderCardToCanvas } from "../lib/spritesheet.ts";

const canvas = document.getElementById("card-canvas");
const ctx = canvas.getContext("2d");
const generateBtn = document.getElementById("generate-btn");
const themeSelect = document.getElementById("theme-select");
const modeToggle = document.getElementById("mode-toggle");
const modeLabel = document.getElementById("mode-label");

let currentCard = "";
let imageMode = true;
let spritesheetLoaded = false;

async function init() {
  await loadOraclesJSON();
  await loadSpritesheet();
  newCard();
  generateBtn.addEventListener("click", newCard);
  themeSelect.addEventListener("change", render);
  modeToggle.addEventListener("click", toggleMode);
}

async function loadOraclesJSON() {
  const resp = await fetch("ironsworn_oracles.json");
  const data = await resp.json();
  setOracles(data);
}

async function loadSpritesheet() {
  const img = new Image();
  img.src = "spritesheet.png";
  await img.decode();

  const offscreen = document.createElement("canvas");
  offscreen.width = img.width;
  offscreen.height = img.height;
  const octx = offscreen.getContext("2d");
  octx.drawImage(img, 0, 0);
  parseSpritesheet(img, octx);
  spritesheetLoaded = true;
}

function newCard() {
  currentCard = generateCard();
  render();
}

function render() {
  const theme = themeSelect.value;
  renderCardToCanvas(ctx, currentCard, theme, imageMode);
}

function toggleMode() {
  imageMode = !imageMode;
  modeLabel.textContent = imageMode ? "Image Mode" : "Canvas Mode";
  modeToggle.textContent = imageMode ? "Switch to Canvas Mode" : "Switch to Image Mode";
  render();
}

init();
