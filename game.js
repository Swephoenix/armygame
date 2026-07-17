(function exposeArmyGame(root, createGame) {
  const game = createGame();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = game;
  }

  root.ArmyGame = game;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createGame() {
  const RUN_FRAME_COUNT = 96;
  const RUN_LOOP_START = 77;
  const EMPTY_AIM_SEQUENCE = [186, 187, 188, 188, 187];
  const FIRING_LOOP_START = 171;
  const FIRING_REPEAT_LIMIT = 1;
  const VEHICLE_FRAME_COUNT = 225;
  const DRIVE_FRAME_COUNT = 8;
  const DRIVE_SHEET_COLUMN_COUNT = 4;
  const VEHICLE_AIM_ROW_COUNT = 4;
  const ZOMBIE_WALK_FRAME_COUNT = 47;
  const ZOMBIE_HIT_FRAME_COUNT = 27;
  const ZOMBIE_DEATH_FRAME_COUNT = 66;
  const ZOMBIE_ATTACK_1_FRAME_COUNT = 6;
  const ZOMBIE_ATTACK_2_FRAME_COUNT = 6;
  const ZOMBIE_ATTACK_CONTACT_FRAME = 4;
  const SOLDIER_PROJECTILE_FRAMES = [146, 150, 154, 158, 162, 166, 170, 174, 178, 182];
  const MAGAZINE_SIZE = 30;
  const RELOAD_FRAME_COUNT = 4;

  function createAmmoState() {
    return { rounds: MAGAZINE_SIZE, reloading: false };
  }

  function canFire(ammo) {
    return ammo.rounds > 0 && !ammo.reloading;
  }

  function consumeRound(ammo) {
    return canFire(ammo) ? { ...ammo, rounds: ammo.rounds - 1 } : ammo;
  }

  function beginReload(ammo) {
    return ammo.rounds < MAGAZINE_SIZE && !ammo.reloading ? { ...ammo, reloading: true } : ammo;
  }

  function completeReload() {
    return createAmmoState();
  }

  function reloadFrameAtElapsed(elapsedMilliseconds, durationMilliseconds) {
    const safeDuration = Math.max(1, durationMilliseconds);
    const elapsed = Math.max(0, elapsedMilliseconds);
    return Math.min(
      RELOAD_FRAME_COUNT,
      Math.floor((elapsed / safeDuration) * RELOAD_FRAME_COUNT) + 1,
    );
  }

  function createZombieState() {
    return { phase: 'walk', frame: 1, health: 2, nextAttack: 1 };
  }

  function zombieCanTakeHit(zombie) {
    return zombie.phase === 'walk' || zombie.phase === 'attack1' || zombie.phase === 'attack2';
  }

  function hitZombie(zombie) {
    if (!zombieCanTakeHit(zombie)) return zombie;
    if (zombie.health > 1) return { ...zombie, phase: 'hit', frame: 1, health: zombie.health - 1 };
    return { ...zombie, phase: 'death', frame: 1, health: 0 };
  }

  function beginZombieAttack(zombie) {
    if (zombie.phase !== 'walk') return zombie;
    const variant = zombie.nextAttack === 2 ? 2 : 1;
    return {
      ...zombie,
      phase: `attack${variant}`,
      frame: 1,
      nextAttack: variant === 1 ? 2 : 1,
    };
  }

  function zombieCanAttack(zombieX, soldierX, maxDistance, mounted, playerHealth) {
    return !mounted && playerHealth > 0 && Math.abs(zombieX - soldierX) <= maxDistance;
  }

  function zombieAttackLands(previousZombie, nextZombie) {
    const isAttack = nextZombie.phase === 'attack1' || nextZombie.phase === 'attack2';
    return (
      isAttack &&
      previousZombie.phase === nextZombie.phase &&
      previousZombie.frame !== nextZombie.frame &&
      nextZombie.frame === ZOMBIE_ATTACK_CONTACT_FRAME
    );
  }

  function applyZombieDamage(playerHealth) {
    return Math.max(0, playerHealth - 1);
  }

  function advanceZombie(zombie) {
    if (zombie.phase === 'walk') {
      return {
        ...zombie,
        frame: zombie.frame >= ZOMBIE_WALK_FRAME_COUNT ? 1 : zombie.frame + 1,
      };
    }

    if (zombie.phase === 'hit') {
      return zombie.frame >= ZOMBIE_HIT_FRAME_COUNT
        ? { phase: 'walk', frame: 1, health: zombie.health }
        : { ...zombie, frame: zombie.frame + 1 };
    }

    if (zombie.phase === 'attack1' || zombie.phase === 'attack2') {
      const frameCount =
        zombie.phase === 'attack1' ? ZOMBIE_ATTACK_1_FRAME_COUNT : ZOMBIE_ATTACK_2_FRAME_COUNT;
      return zombie.frame >= frameCount
        ? { ...zombie, phase: 'walk', frame: 1 }
        : { ...zombie, frame: zombie.frame + 1 };
    }

    if (zombie.phase === 'death') {
      return zombie.frame >= ZOMBIE_DEATH_FRAME_COUNT
        ? { phase: 'dead', frame: 1, health: 0 }
        : { ...zombie, frame: zombie.frame + 1 };
    }

    return { phase: 'dead', frame: 1, health: 0 };
  }

  function shotHitsTarget(pointerX, pointerY, rect) {
    const horizontalInset = rect.width * 0.18;
    const topInset = rect.height * 0.12;
    const bottomInset = rect.height * 0.08;
    return (
      pointerX >= rect.left + horizontalInset &&
      pointerX <= rect.left + rect.width - horizontalInset &&
      pointerY >= rect.top + topInset &&
      pointerY <= rect.top + rect.height - bottomInset
    );
  }

  function combatFiresProjectile(previousCombat, nextCombat) {
    return (
      nextCombat.phase === 'firing' &&
      SOLDIER_PROJECTILE_FRAMES.includes(nextCombat.frame) &&
      (previousCombat.phase !== nextCombat.phase || previousCombat.frame !== nextCombat.frame)
    );
  }

  function projectileHitsTarget(projectile, nextX, rect) {
    const horizontalInset = rect.width * 0.18;
    const topInset = rect.height * 0.12;
    const bottomInset = rect.height * 0.08;
    const targetLeft = rect.left + horizontalInset;
    const targetRight = rect.left + rect.width - horizontalInset;
    const segmentLeft = Math.min(projectile.x, nextX);
    const segmentRight = Math.max(projectile.x, nextX);
    return (
      projectile.y >= rect.top + topInset &&
      projectile.y <= rect.top + rect.height - bottomInset &&
      segmentRight >= targetLeft &&
      segmentLeft <= targetRight
    );
  }

  function beginCombat() {
    return { phase: 'aim', frame: 109, loopIndex: 0 };
  }

  function advanceCombat(combat) {
    if (combat.phase === 'aim') {
      return combat.frame < 130
        ? { ...combat, frame: combat.frame + 1 }
        : { phase: 'firing', frame: 145, loopIndex: 0, repeatCount: 0 };
    }

    if (combat.phase === 'firing') {
      if (combat.frame < 185) {
        return { ...combat, frame: combat.frame + 1 };
      }

      if (combat.repeatCount < FIRING_REPEAT_LIMIT) {
        return {
          ...combat,
          frame: FIRING_LOOP_START,
          repeatCount: combat.repeatCount + 1,
        };
      }

      return { phase: 'cooldown', frame: 180, loopIndex: 0, repeatCount: combat.repeatCount };
    }

    if (combat.phase === 'cooldown') {
      return combat.frame === 180
        ? { ...combat, frame: 181 }
        : { phase: 'empty', frame: EMPTY_AIM_SEQUENCE[0], loopIndex: 0 };
    }

    const loopIndex = (combat.loopIndex + 1) % EMPTY_AIM_SEQUENCE.length;
    return { phase: 'empty', frame: EMPTY_AIM_SEQUENCE[loopIndex], loopIndex };
  }

  function advanceCombatWithAmmo(combat, ammo) {
    if (combat.phase === 'firing' && !canFire(ammo)) {
      return { phase: 'empty', frame: EMPTY_AIM_SEQUENCE[0], loopIndex: 0 };
    }
    return advanceCombat(combat);
  }

  function directionFromKeys(keys) {
    return Number(keys.has('d')) - Number(keys.has('a'));
  }

  function nextRunFrame(frame) {
    return frame >= RUN_FRAME_COUNT ? RUN_LOOP_START : frame + 1;
  }

  function movePosition(position, direction, deltaSeconds, speed, bounds) {
    const nextPosition = position + direction * speed * deltaSeconds;
    return Math.min(bounds.max, Math.max(bounds.min, nextPosition));
  }

  function canEnterVehicle(soldierX, entryX, maxDistance) {
    return Math.abs(soldierX - entryX) <= maxDistance;
  }

  function vehicleAimFrame(pointerY, viewportHeight) {
    const safeHeight = Math.max(1, viewportHeight);
    const normalizedHeight = Math.min(1, Math.max(0, 1 - pointerY / safeHeight));
    return Math.round(normalizedHeight * (VEHICLE_FRAME_COUNT - 1)) + 1;
  }

  function nextDriveFrame(frame, direction) {
    const step = direction < 0 ? -1 : 1;
    return ((frame - 1 + step + DRIVE_FRAME_COUNT) % DRIVE_FRAME_COUNT) + 1;
  }

  function vehicleAimRow(pointerY, viewportHeight) {
    const safeHeight = Math.max(1, viewportHeight);
    const normalizedHeight = Math.min(1, Math.max(0, 1 - pointerY / safeHeight));
    return Math.round(normalizedHeight * (VEHICLE_AIM_ROW_COUNT - 1));
  }

  function driveAimCell(driveFrame, aimRow) {
    return {
      column: (Math.max(1, driveFrame) - 1) % DRIVE_SHEET_COLUMN_COUNT,
      row: Math.min(VEHICLE_AIM_ROW_COUNT - 1, Math.max(0, aimRow)),
    };
  }

  function muzzlePointForAimRow(aimRow) {
    const row = Math.min(VEHICLE_AIM_ROW_COUNT - 1, Math.max(0, aimRow));
    return {
      x: Number((0.9 - row * 0.04).toFixed(2)),
      y: Number((0.2 - row * 0.05).toFixed(2)),
    };
  }

  return {
    EMPTY_AIM_SEQUENCE,
    DRIVE_FRAME_COUNT,
    DRIVE_SHEET_COLUMN_COUNT,
    FIRING_LOOP_START,
    FIRING_REPEAT_LIMIT,
    MAGAZINE_SIZE,
    RELOAD_FRAME_COUNT,
    RUN_FRAME_COUNT,
    RUN_LOOP_START,
    SOLDIER_PROJECTILE_FRAMES,
    VEHICLE_FRAME_COUNT,
    VEHICLE_AIM_ROW_COUNT,
    ZOMBIE_DEATH_FRAME_COUNT,
    ZOMBIE_ATTACK_1_FRAME_COUNT,
    ZOMBIE_ATTACK_2_FRAME_COUNT,
    ZOMBIE_ATTACK_CONTACT_FRAME,
    ZOMBIE_HIT_FRAME_COUNT,
    ZOMBIE_WALK_FRAME_COUNT,
    advanceCombat,
    advanceCombatWithAmmo,
    advanceZombie,
    applyZombieDamage,
    beginZombieAttack,
    beginReload,
    beginCombat,
    canFire,
    canEnterVehicle,
    combatFiresProjectile,
    completeReload,
    consumeRound,
    createAmmoState,
    createZombieState,
    directionFromKeys,
    driveAimCell,
    movePosition,
    muzzlePointForAimRow,
    nextRunFrame,
    nextDriveFrame,
    projectileHitsTarget,
    reloadFrameAtElapsed,
    hitZombie,
    shotHitsTarget,
    vehicleAimFrame,
    vehicleAimRow,
    zombieAttackLands,
    zombieCanAttack,
    zombieCanTakeHit,
  };
});
