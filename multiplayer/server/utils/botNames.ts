// Random human names for bot players
const BOT_NAMES = [
  'Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Taylor', 'Quinn',
  'Avery', 'Cameron', 'Jamie', 'Drew', 'Skyler', 'Reese', 'Parker', 'Sage',
  'Frankie', 'Charlie', 'Max', 'Jules', 'Remy', 'Kai', 'Blake', 'Robin',
  'Dana', 'Lee', 'Pat', 'Kim', 'Terry', 'Jessie', 'Noel', 'Ash'
];

/**
 * Get a random bot name that isn't already in use
 * @param existingNames Names already taken in the room
 * @returns A unique bot name
 */
export function getUniqueBotName(existingNames: string[]): string {
  // Filter out names that are already taken
  const availableNames = BOT_NAMES.filter(name => !existingNames.includes(name));

  if (availableNames.length > 0) {
    // Pick a random available name
    const randomIndex = Math.floor(Math.random() * availableNames.length);
    return availableNames[randomIndex];
  }

  // Fallback: if all names taken, add a number
  let counter = 1;
  while (existingNames.includes(`Bot ${counter}`)) {
    counter++;
  }
  return `Bot ${counter}`;
}
