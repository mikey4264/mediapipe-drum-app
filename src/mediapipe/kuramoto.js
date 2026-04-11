/**
 * Kuramoto Synchronization Module
 * Implements the Kuramoto algorithm for gradual tempo convergence.
 * Used to synchronise drum loop BPM with user's playing tempo.

 */
class KuramotoSync {
  constructor() {
    this.couplingStrength = 0.7;
    this.minBPM = 40;
    this.maxBPM = 200;
  }

  calculateSync(loopBPM, userBPM) {
    if (!this.isValidBPM(loopBPM) || !this.isValidBPM(userBPM)) {
      return null;
    }

    // Kuramoto coupling: adjustment = K * sin(Δω / scale) 
    //  Clamped sin input to [-π/2, π/2] so large deltas don't wrap and reverse direction
    const phaseDifference = userBPM - loopBPM;
    const sinInput = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, phaseDifference / 20));
    const adjustment = this.couplingStrength * Math.sin(sinInput);
    const newBPM = loopBPM + adjustment;
    // Clamp to valid range
    return this.clampBPM(newBPM);
  }

  getSyncStatus(loopBPM, userBPM) {
    if (!this.isValidBPM(loopBPM) || !this.isValidBPM(userBPM)) {
      return { status: 'unknown', difference: 0 };
    }

    const difference = Math.abs(userBPM - loopBPM);

    if (difference <= 5) {
      return { status: 'synced', difference };
    } else if (difference <= 10) {
      return { status: 'syncing', difference };
    } else {
      return { status: 'out_of_sync', difference };
    }
  }

  /**
   * Set how fast sync happens
   * @param {number} strength - Value between 0.1 and 0.5
   */
  setCouplingStrength(strength) {
    this.couplingStrength = Math.max(0.1, Math.min(0.5, strength));
  }

  /**
   * Get current coupling strength
   * @returns {number}
   */
  getCouplingStrength() {
    return this.couplingStrength;
  }

  /**
   * Check if bpm is within valid range
   * @param {number} bpm
   * @returns {boolean}
   */
  isValidBPM(bpm) {
    return typeof bpm === 'number' &&
           !isNaN(bpm) &&
           bpm >= this.minBPM &&
           bpm <= this.maxBPM;
  }

  /**
   * Clamp BPM to valid range
   * @param {number} bpm
   * @returns {number}
   */
  clampBPM(bpm) {
    return Math.max(this.minBPM, Math.min(this.maxBPM, bpm));
  }
}
// Export singleton instance
export const kuramotoSync = new KuramotoSync();
