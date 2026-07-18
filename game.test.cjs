const assert = require('node:assert/strict');
const test = require('node:test');

function loadGame() {
  let game;
  assert.doesNotThrow(() => {
    game = require('./game.js');
  });
  return game;
}

test('A moves left and D moves right', () => {
  const { directionFromKeys } = loadGame();

  assert.equal(directionFromKeys(new Set(['a'])), -1);
  assert.equal(directionFromKeys(new Set(['d'])), 1);
  assert.equal(directionFromKeys(new Set(['a', 'd'])), 0);
  assert.equal(directionFromKeys(new Set()), 0);
});

test('running plays frames 1-96 once and then loops frames 77-96', () => {
  const { nextRunFrame, RUN_LOOP_START } = loadGame();

  assert.equal(RUN_LOOP_START, 77);
  assert.equal(nextRunFrame(1), 2);
  assert.equal(nextRunFrame(95), 96);
  assert.equal(nextRunFrame(96), 77);
});

test('movement is time-based and clamped to the viewport bounds', () => {
  const { movePosition } = loadGame();
  const bounds = { min: -300, max: 300 };

  assert.equal(movePosition(0, 1, 0.5, 240, bounds), 120);
  assert.equal(movePosition(250, 1, 1, 240, bounds), 300);
  assert.equal(movePosition(-250, -1, 1, 240, bounds), -300);
});

test('combat starts by aiming through frames 109-130 before firing at 145', () => {
  const { advanceCombat, beginCombat } = loadGame();

  assert.deepEqual(beginCombat(), { phase: 'aim', frame: 109, loopIndex: 0 });
  assert.deepEqual(advanceCombat({ phase: 'aim', frame: 129, loopIndex: 0 }), {
    phase: 'aim',
    frame: 130,
    loopIndex: 0,
  });
  assert.deepEqual(advanceCombat({ phase: 'aim', frame: 130, loopIndex: 0 }), {
    phase: 'firing',
    frame: 145,
    loopIndex: 0,
    repeatCount: 0,
  });
});

test('firing repeats frames 171-185 once before the cooldown', () => {
  const { advanceCombat, FIRING_LOOP_START, FIRING_REPEAT_LIMIT } = loadGame();

  assert.equal(FIRING_LOOP_START, 171);
  assert.equal(FIRING_REPEAT_LIMIT, 1);
  assert.deepEqual(advanceCombat({ phase: 'firing', frame: 185, loopIndex: 0, repeatCount: 0 }), {
    phase: 'firing',
    frame: 171,
    loopIndex: 0,
    repeatCount: 1,
  });
  assert.deepEqual(advanceCombat({ phase: 'firing', frame: 185, loopIndex: 0, repeatCount: 1 }), {
    phase: 'cooldown',
    frame: 180,
    loopIndex: 0,
    repeatCount: 1,
  });
});

test('cooldown plays frames 180 and 181 before empty aim begins at 186', () => {
  const { advanceCombat } = loadGame();

  assert.deepEqual(advanceCombat({ phase: 'cooldown', frame: 180, loopIndex: 0, repeatCount: 1 }), {
    phase: 'cooldown',
    frame: 181,
    loopIndex: 0,
    repeatCount: 1,
  });
  assert.deepEqual(advanceCombat({ phase: 'cooldown', frame: 181, loopIndex: 0, repeatCount: 1 }), {
    phase: 'empty',
    frame: 186,
    loopIndex: 0,
  });
});

test('empty aim repeats frames 186, 187, 188, 188, 187', () => {
  const { advanceCombat } = loadGame();
  let combat = { phase: 'empty', frame: 186, loopIndex: 0 };
  const frames = [];

  for (let index = 0; index < 5; index += 1) {
    combat = advanceCombat(combat);
    frames.push(combat.frame);
  }

  assert.deepEqual(frames, [187, 188, 188, 187, 186]);
});

test('the soldier can only enter the vehicle while close to its entry point', () => {
  const { canEnterVehicle } = loadGame();

  assert.equal(canEnterVehicle(420, 500, 100), true);
  assert.equal(canEnterVehicle(400, 500, 100), true);
  assert.equal(canEnterVehicle(399, 500, 100), false);
});

test('mouse height selects and clamps the matching vehicle aim frame', () => {
  const { VEHICLE_FRAME_COUNT, vehicleAimFrame } = loadGame();

  assert.equal(VEHICLE_FRAME_COUNT, 225);
  assert.equal(vehicleAimFrame(900, 900), 1);
  assert.equal(vehicleAimFrame(450, 900), 113);
  assert.equal(vehicleAimFrame(0, 900), 225);
  assert.equal(vehicleAimFrame(-100, 900), 225);
  assert.equal(vehicleAimFrame(1000, 900), 1);
});

test('driving frames loop forwards and backwards with vehicle direction', () => {
  const { DRIVE_FRAME_COUNT, nextDriveFrame } = loadGame();

  assert.equal(DRIVE_FRAME_COUNT, 8);
  assert.equal(nextDriveFrame(1, 1), 2);
  assert.equal(nextDriveFrame(8, 1), 1);
  assert.equal(nextDriveFrame(8, -1), 7);
  assert.equal(nextDriveFrame(1, -1), 8);
});

test('mouse height selects one of four mounted aim rows', () => {
  const { VEHICLE_AIM_ROW_COUNT, vehicleAimRow } = loadGame();

  assert.equal(VEHICLE_AIM_ROW_COUNT, 4);
  assert.equal(vehicleAimRow(900, 900), 0);
  assert.equal(vehicleAimRow(600, 900), 1);
  assert.equal(vehicleAimRow(300, 900), 2);
  assert.equal(vehicleAimRow(0, 900), 3);
  assert.equal(vehicleAimRow(-20, 900), 3);
});

test('drive and aim select independent sprite-sheet columns and rows', () => {
  const { driveAimCell } = loadGame();

  assert.deepEqual(driveAimCell(1, 0), { column: 0, row: 0 });
  assert.deepEqual(driveAimCell(4, 3), { column: 3, row: 3 });
  assert.deepEqual(driveAimCell(8, 2), { column: 3, row: 2 });
});

test('muzzle position follows the selected mounted aim row', () => {
  const { muzzlePointForAimRow } = loadGame();

  assert.deepEqual(muzzlePointForAimRow(0), { x: 0.9, y: 0.2 });
  assert.deepEqual(muzzlePointForAimRow(3), { x: 0.78, y: 0.05 });
});

test('a zombie starts walking with two hit points', () => {
  const { createZombieState, ZOMBIE_WALK_FRAME_COUNT } = loadGame();

  assert.equal(ZOMBIE_WALK_FRAME_COUNT, 47);
  assert.deepEqual(createZombieState(), { phase: 'walk', frame: 1, health: 2, nextAttack: 1 });
});

test('the first valid zombie hit plays the hit reaction and the second starts death', () => {
  const { hitZombie } = loadGame();
  const walking = { phase: 'walk', frame: 12, health: 2 };

  assert.deepEqual(hitZombie(walking), { phase: 'hit', frame: 1, health: 1 });
  assert.deepEqual(hitZombie({ phase: 'hit', frame: 8, health: 1 }), {
    phase: 'hit',
    frame: 8,
    health: 1,
  });
  assert.deepEqual(hitZombie({ phase: 'walk', frame: 4, health: 1 }), {
    phase: 'death',
    frame: 1,
    health: 0,
  });
  assert.deepEqual(hitZombie({ phase: 'attack1', frame: 3, health: 2, nextAttack: 2 }), {
    phase: 'hit',
    frame: 1,
    health: 1,
    nextAttack: 2,
  });
});

test('a zombie remains shootable while attacking but not during reactions or death', () => {
  const { zombieCanTakeHit } = loadGame();

  assert.equal(zombieCanTakeHit({ phase: 'walk' }), true);
  assert.equal(zombieCanTakeHit({ phase: 'attack1' }), true);
  assert.equal(zombieCanTakeHit({ phase: 'attack2' }), true);
  assert.equal(zombieCanTakeHit({ phase: 'hit' }), false);
  assert.equal(zombieCanTakeHit({ phase: 'dead' }), false);
});

test('zombie animations loop walking, recover from a hit, and finish dead', () => {
  const { advanceZombie, ZOMBIE_DEATH_FRAME_COUNT, ZOMBIE_HIT_FRAME_COUNT } = loadGame();

  assert.equal(ZOMBIE_HIT_FRAME_COUNT, 27);
  assert.equal(ZOMBIE_DEATH_FRAME_COUNT, 66);
  assert.deepEqual(advanceZombie({ phase: 'walk', frame: 47, health: 2 }), {
    phase: 'walk',
    frame: 1,
    health: 2,
  });
  assert.deepEqual(advanceZombie({ phase: 'hit', frame: 27, health: 1 }), {
    phase: 'walk',
    frame: 1,
    health: 1,
  });
  assert.deepEqual(advanceZombie({ phase: 'death', frame: 66, health: 0 }), {
    phase: 'dead',
    frame: 1,
    health: 0,
  });
  assert.deepEqual(advanceZombie({ phase: 'dead', frame: 1, health: 0 }), {
    phase: 'dead',
    frame: 1,
    health: 0,
  });
});

test('a walking zombie alternates between two six-frame melee attacks', () => {
  const {
    beginZombieAttack,
    createZombieState,
    ZOMBIE_ATTACK_1_FRAME_COUNT,
    ZOMBIE_ATTACK_2_FRAME_COUNT,
  } = loadGame();

  assert.equal(ZOMBIE_ATTACK_1_FRAME_COUNT, 6);
  assert.equal(ZOMBIE_ATTACK_2_FRAME_COUNT, 6);

  const first = beginZombieAttack(createZombieState());
  assert.deepEqual(first, { phase: 'attack1', frame: 1, health: 2, nextAttack: 2 });

  const second = beginZombieAttack({ phase: 'walk', frame: 12, health: 2, nextAttack: 2 });
  assert.deepEqual(second, { phase: 'attack2', frame: 1, health: 2, nextAttack: 1 });
  assert.equal(beginZombieAttack(first), first);
});

test('both zombie attacks return to walking after frame six', () => {
  const { advanceZombie } = loadGame();

  assert.deepEqual(advanceZombie({ phase: 'attack1', frame: 6, health: 2, nextAttack: 2 }), {
    phase: 'walk',
    frame: 1,
    health: 2,
    nextAttack: 2,
  });
  assert.deepEqual(advanceZombie({ phase: 'attack2', frame: 6, health: 1, nextAttack: 1 }), {
    phase: 'walk',
    frame: 1,
    health: 1,
    nextAttack: 1,
  });
});

test('zombie melee damage lands once when an attack enters contact frame four', () => {
  const { zombieAttackLands, ZOMBIE_ATTACK_CONTACT_FRAME } = loadGame();

  assert.equal(ZOMBIE_ATTACK_CONTACT_FRAME, 4);
  assert.equal(
    zombieAttackLands(
      { phase: 'attack1', frame: 3 },
      { phase: 'attack1', frame: 4 },
    ),
    true,
  );
  assert.equal(
    zombieAttackLands(
      { phase: 'attack2', frame: 3 },
      { phase: 'attack2', frame: 4 },
    ),
    true,
  );
  assert.equal(
    zombieAttackLands(
      { phase: 'attack1', frame: 4 },
      { phase: 'attack1', frame: 4 },
    ),
    false,
  );
  assert.equal(zombieAttackLands({ phase: 'walk', frame: 3 }, { phase: 'walk', frame: 4 }), false);
});

test('a zombie only starts melee while a living on-foot soldier is in range', () => {
  const { zombieCanAttack } = loadGame();

  assert.equal(zombieCanAttack(500, 590, 100, false, 3), true);
  assert.equal(zombieCanAttack(500, 601, 100, false, 3), false);
  assert.equal(zombieCanAttack(500, 590, 100, true, 3), false);
  assert.equal(zombieCanAttack(500, 590, 100, false, 0), false);
});

test('vehicle impact launches a zombie toward the map edge', () => {
  const { advanceZombieLaunch, beginZombieLaunch, vehicleHitsZombie } = loadGame();
  const vehicleRect = { left: 100, top: 100, width: 240, height: 120 };
  const zombieRect = { left: 240, top: 118, width: 92, height: 140 };

  assert.equal(vehicleHitsZombie(vehicleRect, zombieRect), true);
  assert.equal(
    vehicleHitsZombie(
      { left: 100, top: 100, width: 240, height: 120 },
      { left: 360, top: 118, width: 92, height: 140 },
    ),
    false,
  );

  const launched = beginZombieLaunch({ phase: 'walk', frame: 9, health: 2, nextAttack: 1 }, 1);
  assert.deepEqual(launched, {
    phase: 'launched',
    frame: 1,
    health: 0,
    nextAttack: 1,
    launchDirection: 1,
    launchOffsetX: 0,
    launchOffsetY: 0,
    launchVelocityX: 920,
    launchVelocityY: -740,
    launchRotation: 0,
    launchGravity: 1800,
  });

  const advanced = advanceZombieLaunch(launched, 0.5);
  assert.equal(advanced.launchOffsetX > 0, true);
  assert.equal(advanced.launchOffsetY < 0, true);
  assert.equal(advanced.launchRotation > 0, true);
});

test('zombie damage removes one health without going below zero', () => {
  const { applyZombieDamage } = loadGame();

  assert.equal(applyZombieDamage(3), 2);
  assert.equal(applyZombieDamage(1), 0);
  assert.equal(applyZombieDamage(0), 0);
});

test('shots only hit the visible inner zombie target box', () => {
  const { shotHitsTarget } = loadGame();
  const rect = { left: 400, top: 200, width: 180, height: 320 };

  assert.equal(shotHitsTarget(490, 340, rect), true);
  assert.equal(shotHitsTarget(405, 340, rect), false);
  assert.equal(shotHitsTarget(490, 205, rect), false);
  assert.equal(shotHitsTarget(700, 340, rect), false);
});

test('infantry projectiles are emitted on the recoil pulses in the firing animation', () => {
  const { combatFiresProjectile, SOLDIER_PROJECTILE_FRAMES } = loadGame();

  assert.deepEqual(SOLDIER_PROJECTILE_FRAMES, [146, 150, 154, 158, 162, 166, 170, 174, 178, 182]);
  assert.equal(
    combatFiresProjectile(
      { phase: 'firing', frame: 145 },
      { phase: 'firing', frame: 146 },
    ),
    true,
  );
  assert.equal(
    combatFiresProjectile(
      { phase: 'firing', frame: 146 },
      { phase: 'firing', frame: 147 },
    ),
    false,
  );
  assert.equal(
    combatFiresProjectile(
      { phase: 'aim', frame: 130 },
      { phase: 'firing', frame: 145 },
    ),
    false,
  );
});

test('a fast projectile detects crossing the zombie in either direction', () => {
  const { projectileHitsTarget } = loadGame();
  const rect = { left: 480, top: 280, width: 120, height: 240 };

  assert.equal(projectileHitsTarget({ x: 420, y: 380 }, 640, rect), true);
  assert.equal(projectileHitsTarget({ x: 640, y: 380 }, 420, rect), true);
  assert.equal(projectileHitsTarget({ x: 420, y: 250 }, 640, rect), false);
  assert.equal(projectileHitsTarget({ x: 100, y: 380 }, 300, rect), false);
});

test('ammo starts full and one round is consumed per accepted shot', () => {
  const { canFire, consumeRound, createAmmoState, MAGAZINE_SIZE } = loadGame();

  assert.equal(MAGAZINE_SIZE, 30);
  assert.deepEqual(createAmmoState(), { rounds: 30, reloading: false });
  assert.deepEqual(consumeRound({ rounds: 30, reloading: false }), {
    rounds: 29,
    reloading: false,
  });
  assert.equal(canFire({ rounds: 1, reloading: false }), true);
  assert.equal(canFire({ rounds: 0, reloading: false }), false);
  assert.equal(canFire({ rounds: 12, reloading: true }), false);
});

test('reload only starts on a partial magazine and completes at full capacity', () => {
  const { beginReload, completeReload } = loadGame();

  assert.deepEqual(beginReload({ rounds: 12, reloading: false }), {
    rounds: 12,
    reloading: true,
  });
  assert.deepEqual(beginReload({ rounds: 30, reloading: false }), {
    rounds: 30,
    reloading: false,
  });
  assert.deepEqual(completeReload({ rounds: 0, reloading: true }), {
    rounds: 30,
    reloading: false,
  });
});

test('an empty magazine switches a firing soldier to the empty aim animation', () => {
  const { advanceCombatWithAmmo } = loadGame();
  const combat = { phase: 'firing', frame: 150, loopIndex: 0, repeatCount: 0 };

  assert.deepEqual(advanceCombatWithAmmo(combat, { rounds: 0, reloading: false }), {
    phase: 'empty',
    frame: 186,
    loopIndex: 0,
  });
  assert.deepEqual(advanceCombatWithAmmo(combat, { rounds: 1, reloading: false }), {
    phase: 'firing',
    frame: 151,
    loopIndex: 0,
    repeatCount: 0,
  });
});

test('reload time advances through all four reload sprite frames', () => {
  const { reloadFrameAtElapsed, RELOAD_FRAME_COUNT } = loadGame();

  assert.equal(RELOAD_FRAME_COUNT, 4);
  assert.equal(reloadFrameAtElapsed(0, 1200), 1);
  assert.equal(reloadFrameAtElapsed(299, 1200), 1);
  assert.equal(reloadFrameAtElapsed(300, 1200), 2);
  assert.equal(reloadFrameAtElapsed(600, 1200), 3);
  assert.equal(reloadFrameAtElapsed(900, 1200), 4);
  assert.equal(reloadFrameAtElapsed(1200, 1200), 4);
});
