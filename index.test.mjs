import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import test from 'node:test';

const pagePath = new URL('./index.html', import.meta.url);
const frameDirectory = new URL('./frames_normalized/transparent_frames/', import.meta.url);
const zombieDirectory = new URL('./zombie_segments/', import.meta.url);

test('idle animation uses frames 1-4 and then 4-1 forever', async () => {
  await access(pagePath);
  const html = await readFile(pagePath, 'utf8');

  assert.match(html, /const\s+idleSequence\s*=\s*\[1,\s*2,\s*3,\s*4,\s*4,\s*3,\s*2,\s*1\]/);
  assert.match(html, /requestAnimationFrame\s*\(/);
});

test('all idle frame assets exist and the page points at the transparent frame directory', async () => {
  const html = await readFile(pagePath, 'utf8');
  assert.match(html, /frames_normalized\/transparent_frames\/runner_/);

  await Promise.all(
    [1, 2, 3, 4].map((frame) =>
      access(new URL(`runner_${String(frame).padStart(6, '0')}.png`, frameDirectory)),
    ),
  );
});

test('the soldier is presented on a plain white background', async () => {
  const html = await readFile(pagePath, 'utf8');

  assert.match(html, /--paper:\s*#fff;/);
  assert.match(html, /\.scene\s*\{[\s\S]*?background:\s*var\(--paper\);/);
});

test('normalized subject anchor is centered in the stage', async () => {
  const html = await readFile(pagePath, 'utf8');

  assert.match(html, /transform:\s*translateX\(-42\.1875%\) scaleX\(var\(--facing\)\);/);
  assert.match(html, /transform-origin:\s*42\.1875% 50%;/);
});

test('A and D control a bounded running animation using frames 1-96', async () => {
  const html = await readFile(pagePath, 'utf8');

  assert.match(html, /<script src="game\.js"><\/script>/);
  assert.match(html, /addEventListener\('keydown'/);
  assert.match(html, /addEventListener\('keyup'/);
  assert.match(html, /requestAnimationFrame\s*\(/);
  assert.match(html, /<kbd>A<\/kbd> Vänster <kbd>D<\/kbd> Höger/);
  assert.match(html, /key === 'a' \|\| key === 'd'/);

  await Promise.all(
    Array.from({ length: 96 }, (_, index) =>
      access(new URL(`runner_${String(index + 1).padStart(6, '0')}.png`, frameDirectory)),
    ),
  );
});

test('holding the left mouse button aims, fires a repeated burst, and loops the empty aim', async () => {
  const html = await readFile(pagePath, 'utf8');

  assert.match(html, /addEventListener\('mousedown'/);
  assert.match(html, /addEventListener\('mouseup'/);
  assert.match(html, /ArmyGame\.beginCombat\s*\(/);
  assert.match(html, /ArmyGame\.advanceCombatWithAmmo\s*\(/);
  assert.match(html, /Mouse 1/);

  const combatFrames = [
    ...Array.from({ length: 22 }, (_, index) => 109 + index),
    ...Array.from({ length: 41 }, (_, index) => 145 + index),
    186,
    187,
    188,
  ];

  await Promise.all(
    combatFrames.map((frame) =>
      access(new URL(`runner_${String(frame).padStart(6, '0')}.png`, frameDirectory)),
    ),
  );
});

test('a parked vehicle is visible and can be entered with E', async () => {
  const html = await readFile(pagePath, 'utf8');

  assert.match(html, /src="Car_still\.png"/);
  assert.match(html, /key === 'e'/);
  assert.match(html, /ArmyGame\.canEnterVehicle/);
  assert.match(html, /<kbd>E<\/kbd>/);
  await access(new URL('./Car_still.png', import.meta.url));
});

test('mounted aiming uses the car frames, mouse movement, and a crosshair', async () => {
  const html = await readFile(pagePath, 'utf8');

  assert.match(html, /carshooting_animation\/transparent_frames\/car_/);
  assert.match(html, /ArmyGame\.vehicleAimFrame/);
  assert.match(html, /addEventListener\('mousemove'/);
  assert.match(html, /id="crosshair"/);
  assert.match(html, /class="muzzle-flash"/);

  await Promise.all(
    [1, 113, 225].map((frame) =>
      access(
        new URL(
          `./carshooting_animation/transparent_frames/car_${String(frame).padStart(6, '0')}.png`,
          import.meta.url,
        ),
      ),
    ),
  );
});

test('the soldier and vehicle use a pulled-back world scale', async () => {
  const html = await readFile(pagePath, 'utf8');

  assert.match(html, /--soldier-width:\s*min\(27vw,\s*390px\)/);
  assert.match(html, /--vehicle-width:\s*min\(44vw,\s*620px\)/);
  assert.match(html, /width:\s*var\(--soldier-width\)/);
  assert.match(html, /width:\s*var\(--vehicle-width\)/);
});

test('mounted A and D movement uses the eight-frame driving cycle', async () => {
  const html = await readFile(pagePath, 'utf8');

  assert.match(html, /car_drive_aim_spritesheet\.png/);
  assert.match(html, /class="vehicle-driving"/);
  assert.match(html, /ArmyGame\.nextDriveFrame/);
  assert.match(html, /vehicleStage\.classList\.toggle\('is-driving'/);
  assert.match(html, /mounted\s*&&\s*direction\s*!==\s*0/);
  await access(new URL('./car_drive_aim_spritesheet.png', import.meta.url));
});

test('driving and mouse aiming use the combined four-by-four sprite matrix', async () => {
  const html = await readFile(pagePath, 'utf8');

  assert.match(html, /car_drive_aim_spritesheet\.png/);
  assert.match(html, /background-size:\s*400% 400%/);
  assert.match(html, /ArmyGame\.vehicleAimRow/);
  assert.match(html, /ArmyGame\.driveAimCell/);
  assert.match(html, /function updateDriveAimFrame\s*\(/);
  await access(new URL('./car_drive_aim_spritesheet.png', import.meta.url));
});

test('the game renders a shootable zombie NPC using all selected animation segments', async () => {
  const html = await readFile(pagePath, 'utf8');

  assert.match(html, /id="zombieStage"/);
  assert.match(html, /id="zombie"/);
  assert.match(html, /ArmyGame\.createZombieState\s*\(/);
  assert.match(html, /ArmyGame\.hitZombie\s*\(/);
  assert.match(html, /ArmyGame\.advanceZombie\s*\(/);
  assert.match(html, /ArmyGame\.shotHitsTarget\s*\(/);

  const requiredFrames = [
    ['walk_loop', 47],
    ['hit_reaction', 27],
    ['death', 66],
    ['dead_hold', 1],
  ];

  await Promise.all(
    requiredFrames.flatMap(([segment, count]) =>
      Array.from({ length: count }, (_, index) =>
        access(
          new URL(
            `${segment}/transparent_frames/zombie_${String(index + 1).padStart(6, '0')}.png`,
            zombieDirectory,
          ),
        ),
      ),
    ),
  );
});

test('the zombie uses two six-frame melee attacks with a contact-timed player hit', async () => {
  const html = await readFile(pagePath, 'utf8');

  assert.match(html, /attack1:\s*'zombie_segments\/attack_1\/transparent_frames\/zombie_'/);
  assert.match(html, /attack2:\s*'zombie_segments\/attack_2\/transparent_frames\/zombie_'/);
  assert.match(html, /ArmyGame\.beginZombieAttack\s*\(/);
  assert.match(html, /ArmyGame\.zombieCanAttack\s*\(/);
  assert.match(html, /ArmyGame\.zombieAttackLands\s*\(/);
  assert.match(html, /ArmyGame\.applyZombieDamage\s*\(/);
  assert.match(html, /id="healthCount"/);
  assert.match(html, /const\s+zombieAttackFrameDuration\s*=\s*1000\s*\/\s*12/);
  assert.match(html, /isZombieAttacking\s*\?\s*zombieAttackFrameDuration\s*:\s*zombieFrameDuration/);

  await Promise.all(
    ['attack_1', 'attack_2'].flatMap((segment) =>
      Array.from({ length: 6 }, (_, index) =>
        access(
          new URL(
            `${segment}/transparent_frames/zombie_${String(index + 1).padStart(6, '0')}.png`,
            zombieDirectory,
          ),
        ),
      ),
    ),
  );
});

test('vehicle impacts launch zombies off the map with visible motion and rotation', async () => {
  const html = await readFile(pagePath, 'utf8');

  assert.match(html, /ArmyGame\.vehicleHitsZombie\s*\(/);
  assert.match(html, /ArmyGame\.beginZombieLaunch\s*\(/);
  assert.match(html, /ArmyGame\.advanceZombieLaunch\s*\(/);
  assert.match(html, /launched:\s*'zombie_segments\/death\/transparent_frames\/zombie_'/);
  assert.match(html, /--zombie-launch-x:/);
  assert.match(html, /--zombie-launch-y:/);
  assert.match(html, /--zombie-rotation:/);
  assert.match(html, /Zombie slungas iväg av bilen/);
});

test('the car spawns farther right and zombies spawn left to chase the soldier', async () => {
  const html = await readFile(pagePath, 'utf8');

  assert.match(html, /right:\s*clamp\(0\.25rem,\s*1vw,\s*0\.75rem\);/);
  assert.match(html, /const\s+soldierSpawnX\s*=\s*Math\.min\(140,\s*window\.innerWidth\s*\*\s*0\.12\)/);
  assert.match(html, /const\s+zombieSpawnX\s*=\s*Math\.max\(40,\s*window\.innerWidth\s*\*\s*0\.1\)/);
  assert.match(html, /let\s+position\s*=\s*soldierSpawnX;/);
  assert.match(html, /let\s+zombiePosition\s*=\s*zombieSpawnX;/);
  assert.match(html, /let\s+zombieDirection\s*=\s*1;/);
  assert.match(html, /zombieDirection\s*=\s*position\s*<\s*zombiePosition\s*\?\s*-1\s*:\s*1;/);
});

test('infantry projectiles are spawned from the rifle on matching firing frames', async () => {
  const html = await readFile(pagePath, 'utf8');

  assert.match(html, /class="infantry-projectiles"/);
  assert.match(html, /ArmyGame\.combatFiresProjectile\s*\(/);
  assert.match(html, /ArmyGame\.projectileHitsTarget\s*\(/);
  assert.match(html, /function spawnInfantryProjectile\s*\(/);
  assert.match(html, /function updateInfantryProjectiles\s*\(/);
});

test('the HUD shows ammunition and R starts a timed reload', async () => {
  const html = await readFile(pagePath, 'utf8');

  assert.match(html, /id="ammoMeter"/);
  assert.match(html, /id="ammoCount"/);
  assert.match(html, /<kbd>R<\/kbd> Ladda om/);
  assert.match(html, /key === 'r'/);
  assert.match(html, /ArmyGame\.beginReload\s*\(/);
  assert.match(html, /ArmyGame\.completeReload\s*\(/);
  assert.match(html, /ArmyGame\.consumeRound\s*\(/);
});

test('infantry reload uses the generated four-frame magazine animation', async () => {
  const html = await readFile(pagePath, 'utf8');
  const reloadDirectory = new URL('./reload_animation/transparent_frames/', import.meta.url);

  assert.match(html, /reload_animation\/transparent_frames\/reload_/);
  assert.match(html, /ArmyGame\.reloadFrameAtElapsed\s*\(/);
  assert.match(html, /reloadStartedAt/);

  await Promise.all(
    Array.from({ length: 4 }, (_, index) =>
      access(
        new URL(`reload_${String(index + 1).padStart(6, '0')}.png`, reloadDirectory),
      ),
    ),
  );
});
