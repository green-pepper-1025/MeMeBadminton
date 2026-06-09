export type SkillPlayerId = 'player1' | 'player2';

export type SkillUseFailureReason = 'player_not_found' | 'not_ready' | 'no_uses_remaining';

export interface SkillState {
    playerId: SkillPlayerId;
    skillId: string;
    charge: number;
    usesRemaining: number;
    isReady: boolean;
    cooldownRemaining: number;
}

export interface SkillUseResult {
    success: boolean;
    playerId: SkillPlayerId;
    skillId?: string;
    reason?: SkillUseFailureReason;
}

export class SkillSystem {
    public readonly maxCharge: number = 100;
    public readonly maxUsesPerRound: number = 3;
    public readonly timeToFullCharge: number = 20;
    public readonly hitChargeAmount: number = 15;
    public readonly useCooldown: number = 0.35;

    private readonly _states: Map<SkillPlayerId, SkillState> = new Map();

    public initializePlayer(playerId: SkillPlayerId, skillId: string): void {
        this._states.set(playerId, {
            playerId,
            skillId,
            charge: 0,
            usesRemaining: this.maxUsesPerRound,
            isReady: false,
            cooldownRemaining: 0,
        });
    }

    public update(deltaTime: number): void {
        if (deltaTime <= 0) {
            return;
        }

        const chargeAmount = (this.maxCharge / this.timeToFullCharge) * deltaTime;
        this._states.forEach((state) => {
            state.cooldownRemaining = Math.max(0, state.cooldownRemaining - deltaTime);
            this.addChargeToState(state, chargeAmount);
        });
    }

    public addHitCharge(playerId: SkillPlayerId): void {
        const state = this._states.get(playerId);
        if (!state) {
            return;
        }

        this.addChargeToState(state, this.hitChargeAmount);
    }

    public tryUseSkill(playerId: SkillPlayerId): SkillUseResult {
        const state = this._states.get(playerId);
        if (!state) {
            return { success: false, playerId, reason: 'player_not_found' };
        }

        if (state.usesRemaining <= 0) {
            return { success: false, playerId, skillId: state.skillId, reason: 'no_uses_remaining' };
        }

        if (!state.isReady || state.cooldownRemaining > 0) {
            return { success: false, playerId, skillId: state.skillId, reason: 'not_ready' };
        }

        state.charge = 0;
        state.isReady = false;
        state.usesRemaining--;
        state.cooldownRemaining = this.useCooldown;

        return { success: true, playerId, skillId: state.skillId };
    }

    public resetRound(): void {
        this._states.forEach((state) => {
            state.charge = 0;
            state.usesRemaining = this.maxUsesPerRound;
            state.isReady = false;
            state.cooldownRemaining = 0;
        });
    }

    public getState(playerId: SkillPlayerId): SkillState {
        const state = this._states.get(playerId);
        if (!state) {
            throw new Error(`Skill state not found for ${playerId}`);
        }

        return { ...state };
    }

    public getAllStates(): SkillState[] {
        return Array.from(this._states.values(), (state) => ({ ...state }));
    }

    private addChargeToState(state: SkillState, amount: number): void {
        if (state.usesRemaining <= 0 || state.charge >= this.maxCharge) {
            return;
        }

        state.charge = Math.min(this.maxCharge, state.charge + amount);
        state.isReady = state.charge >= this.maxCharge;
    }
}
