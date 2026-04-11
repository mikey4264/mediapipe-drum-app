// Beat Grid Hypothesis Testing Tempo Detector
// Tests candidate tempos (60-180 BPM), scores each against a grid of expected beat times, picks the best fit.
class TempoDetector {
  constructor() {
  //Sliding window of hit timestamps.
    this.timestamps = [];

  //maximum number of timestamps to keep.
    this.windowSize = 24;

    //Smoothed BPM value for output stability.
    this.currentBPM = null;

    this.isReady = false;

    this.hitCount = 0;

    this.minBPM = 40;

    this.maxBPM = 180;

    // Step size for tempo hypothesis testing (in BPM
    this.bpmStep = 2;

    /**
     * Tolerance window for a hit to be considered on the grid
     * As a fraction of the beat period
     */
    this.toleranceFraction = 0.15;

    //reject double-triggers.
    this.debounceMs = 50;

    // Timeout threshold
    this.pauseThreshold = 3000;

    this.minHitsForReady = 6;

    //EMA smoothing factor for output BPM.
    this.emaAlpha = 0.25;

    this.debug = true;
  }

  // Record a drum hit and update the tempo estimate
  recordHit(timestamp) {
    if (this.timestamps.length > 0) {
      const lastTimestamp = this.timestamps[this.timestamps.length - 1];
      const elapsed = timestamp - lastTimestamp;

      if (elapsed < this.debounceMs) {
        return;
      }

      // Handle long pause clear timestamps but keep current BPM estimate
      if (elapsed > this.pauseThreshold) {
        this.timestamps = [];
      }
    }

    // Add timestamp to window
    this.timestamps.push(timestamp);
    this.hitCount++;

    // Trim window to max size
    if (this.timestamps.length > this.windowSize) {
      this.timestamps.shift();
    }

    // Need minimum hits for reliable detection
    if (this.timestamps.length >= this.minHitsForReady) {
      if (!this.isReady) {
        this.isReady = true;
      }
      this.calculateTempo();
    }
  }

  // Calculate tempo by testing different beat grids and finding the best fit
  calculateTempo() {
    const n = this.timestamps.length;
    if (n < 4) return;

    // Time span of our window
    const windowStart = this.timestamps[0];
    const windowEnd = this.timestamps[n - 1];
    const windowDuration = windowEnd - windowStart;

    if (windowDuration <= 0) return;

    let bestBPM = 120;
    let bestScore = -1;
    const scores = [];

    // Test each candidate tempo
    for (let bpm = this.minBPM; bpm <= this.maxBPM; bpm += this.bpmStep) {
      const period = 60000 / bpm; // Beat period in ms
      const tolerance = period * this.toleranceFraction;

      // Score this tempo by checking grid alignment
      const score = this.scoreGrid(period, tolerance, windowStart);

      scores.push({ bpm, score });

      if (score > bestScore) {
        bestScore = score;
        bestBPM = bpm;
      }
    }

    // Fix 1: Subdivision disambiguation - prefer slower fundamental
    // If half the BPM scores nearly as well, it's likely the true tempo
    const halfBPM = bestBPM / 2;
    if (halfBPM >= this.minBPM) {
      const halfPeriod = 60000 / halfBPM;
      const halfTolerance = halfPeriod * this.toleranceFraction;
      const halfScore = this.scoreGrid(halfPeriod, halfTolerance, windowStart);

      // If half-tempo scores at least 75% as well, prefer it
      if (halfScore >= bestScore * 0.75) {
        bestBPM = halfBPM;
      }
    }

    // Refine around the best BPM with finer resolution
    const refinedBPM = this.refineTempo(bestBPM, windowStart);

    // Debug logging
    if (this.debug) {
      // Sort scores descending and show top 3
      scores.sort((a, b) => b.score - a.score);
      const top3 = scores.slice(0, 3).map(s => `${s.bpm}(${s.score.toFixed(1)})`).join(' ');
      console.log(`BPM: ${refinedBPM} | hits: ${n} | top3: ${top3} | out: ${this.currentBPM || '--'}`);
    }

    // Apply EMA smoothing
    this.updateBPM(refinedBPM);
  }

  // Score a tempo by checking how many hits align with the beat grid
  scoreGrid(period, tolerance, windowStart) {
    let score = 0;

    // For each hit, find the nearest grid line and check distance
    for (const timestamp of this.timestamps) {
      const elapsed = timestamp - windowStart;

      // Find nearest grid line (could be any multiple of period)
      const nearestBeatIndex = Math.round(elapsed / period);
      const nearestGridTime = nearestBeatIndex * period;
      const distance = Math.abs(elapsed - nearestGridTime);

      // Score based on how close to the grid line
      if (distance <= tolerance) {
        // Hits on the grid get high score, with bonus for being closer
        const proximityBonus = 1 - (distance / tolerance);
        score += 1 + proximityBonus;
      }
      // Hits off the grid contribute nothing (not negative)
    }

    // Normalize by number of hits to prevent bias toward more hits
    return score;
  }

  // Refine tempo estimate around a coarse estimate
  refineTempo(coarseBPM, windowStart) {
    let bestBPM = coarseBPM;
    let bestScore = -1;

    // Test ±5 BPM around coarse estimate in 0.5 BPM steps
    const range = 5;
    const step = 0.5;

    for (let bpm = coarseBPM - range; bpm <= coarseBPM + range; bpm += step) {
      if (bpm < this.minBPM || bpm > this.maxBPM) continue;

      const period = 60000 / bpm;
      const tolerance = period * this.toleranceFraction;
      const score = this.scoreGrid(period, tolerance, windowStart);

      if (score > bestScore) {
        bestScore = score;
        bestBPM = bpm;
      }
    }

    return Math.round(bestBPM * 2) / 2; // Round to nearest 0.5
  }

  // Update the smoothed BPM output using EMA
  updateBPM(rawBPM) {
    if (this.currentBPM === null) {
      this.currentBPM = rawBPM;
    } else {
      // Fix 2: Clamp EMA jumps - don't let a single reading move output more than 15 BPM
      const clampedRaw = Math.max(
        this.currentBPM - 15,
        Math.min(this.currentBPM + 15, rawBPM)
      );
      // EMA: new = alpha * raw + (1 - alpha) * old
      this.currentBPM = this.emaAlpha * clampedRaw + (1 - this.emaAlpha) * this.currentBPM;
    }

    // Round to nearest 0.5 BPM for cleaner display
    this.currentBPM = Math.round(this.currentBPM * 2) / 2;
  }

  // Get the current estimated BPM
  getBPM() {
    return this.currentBPM;
  }

  // Check if tempo detection is ready to provide estimates
  isTempoReady() {
    return this.isReady;
  }

  // Get confidence level based on number of hits recorded
  getConfidence() {
    if (this.hitCount < 8) {
      return 'low';
    } else if (this.hitCount <= 16) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  // Get progress toward tempo detection as a 0-1 value (0 = no hits, 1 = ready)
  getProgress() {
    return Math.min(1, this.hitCount / this.minHitsForReady);
  }

  // Reset the tempo detector to initial state
  reset() {
    this.timestamps = [];
    this.currentBPM = null;
    this.isReady = false;
    this.hitCount = 0;
  }
}

export const tempoDetector = new TempoDetector();
