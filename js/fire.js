/**
 * Represents a fire animation for vehicle crashes
 * @class
 */
class Fire {
    /**
     * Creates a new Fire instance
     * @param {number} x - X position of the fire
     * @param {number} y - Y position of the fire
     * @param {number} width - Width of the fire
     * @param {number} height - Height of the fire
     * @param {number} duration - Duration in seconds before the fire is removed
     */
    constructor(x, y, width, height, duration = 5) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.duration = duration;
        this.timer = 0;
        
        // Animation properties
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.animationSpeed = 0.2; // seconds per frame
        
        // Pre-calculate animation frames to prevent flickering
        this.frameSequence = this.generateFrameSequence();
        
        // Verify fire sprites are loaded
        const fireSprites = assets.visuals.vehicles.fire_sprites;
        if (fireSprites && fireSprites.length > 0) {
            console.log(`Fire created with ${fireSprites.length} sprites available`);
        } else {
            console.warn('Fire created but no sprites are available');
        }
        
        // Particle effect properties
        this.particles = [];
        this.initParticles();
        
        // Sound effect
        this.playFireSound();
    }
    
    /**
     * Generate a deterministic sequence of animation frames
     * @returns {Array} Array of frame indices
     */
    generateFrameSequence() {
        const fireSprites = assets.visuals.vehicles.fire_sprites;
        const frameCount = fireSprites && fireSprites.length > 0 ? fireSprites.length : 4;
        const totalFrames = Math.ceil(this.duration / this.animationSpeed);
        const sequence = [];
        
        for (let i = 0; i < totalFrames; i++) {
            // Use a deterministic pattern for frame selection
            // This prevents random flickering that would happen if frames were selected randomly
            sequence.push(i % frameCount);
        }
        
        return sequence;
    }
    
    /**
     * Initialize particles for the fire effect
     */
    initParticles() {
        const particleCount = 15;
        const maxLifetime = this.duration * 0.7;
        
        for (let i = 0; i < particleCount; i++) {
            // Pre-calculate all particle positions and properties for the entire lifetime
            // This prevents random flickering from particles being regenerated
            const baseX = Math.random() * this.width - this.width / 2;
            const baseY = Math.random() * this.height / 2 - this.height / 4;
            const size = Math.random() * 10 + 5;
            const speedX = (Math.random() - 0.5) * 10;
            const speedY = -Math.random() * 20 - 10;
            const lifetime = Math.random() * maxLifetime;
            const startTime = Math.random() * (this.duration - lifetime);
            
            this.particles.push({
                x: baseX,
                y: baseY,
                size: size,
                speedX: speedX,
                speedY: speedY,
                lifetime: lifetime,
                startTime: startTime,
                initialOpacity: Math.random() * 0.5 + 0.5,
                // Pre-calculated trajectory
                positions: this.calculateParticleTrajectory(baseX, baseY, speedX, speedY, lifetime)
            });
        }
    }
    
    /**
     * Pre-calculate a particle's entire trajectory
     * @param {number} startX - Starting X position
     * @param {number} startY - Starting Y position
     * @param {number} speedX - X velocity
     * @param {number} speedY - Y velocity
     * @param {number} lifetime - Particle lifetime
     * @returns {Array} Array of positions
     */
    calculateParticleTrajectory(startX, startY, speedX, speedY, lifetime) {
        const positions = [];
        const steps = Math.ceil(lifetime / 0.05); // Calculate position every 50ms
        
        let x = startX;
        let y = startY;
        let currentSpeedY = speedY;
        
        for (let i = 0; i < steps; i++) {
            // Update position with slight acceleration for more natural movement
            x += speedX * 0.05;
            y += currentSpeedY * 0.05;
            
            // Add slight upward acceleration (simulates hot air rising)
            currentSpeedY += 2 * 0.05;
            
            positions.push({x, y});
        }
        
        return positions;
    }
    
    /**
     * Plays fire crackling sound effect
     */
    playFireSound() {
        // Play fire sound if available
        if (assets.sounds && assets.sounds.effects && assets.sounds.effects.fire) {
            const fireSound = assets.sounds.effects.fire;
            fireSound.currentTime = 0;
            fireSound.volume = 0.4; // Lower volume for ambient effect
            fireSound.loop = true;
            try {
                fireSound.play().catch(err => {
                    // Silently fail if autoplay is blocked
                    console.debug('Fire sound autoplay blocked:', err);
                });
            } catch (err) {
                // Silently fail if play() throws an error
                console.debug('Fire sound play failed:', err);
            }
        } else if (assets.sounds && assets.sounds.effects && assets.sounds.effects.explosion) {
            // Fall back to explosion sound if fire sound isn't available
            const explosionSound = assets.sounds.effects.explosion;
            explosionSound.currentTime = 0;
            try {
                explosionSound.play().catch(err => {
                    // Silently fail if autoplay is blocked
                    console.debug('Explosion sound autoplay blocked:', err);
                });
            } catch (err) {
                // Silently fail if play() throws an error
                console.debug('Explosion sound play failed:', err);
            }
        }
    }
    
    /**
     * Stops the fire sound
     */
    stopFireSound() {
        if (assets.sounds && assets.sounds.effects && assets.sounds.effects.fire) {
            const fireSound = assets.sounds.effects.fire;
            fireSound.pause();
            fireSound.currentTime = 0;
        }
    }
    
    /**
     * Updates the fire animation and particles
     * @param {number} deltaTime - Time elapsed since last update in seconds
     * @returns {boolean} True if fire is still active, false if duration is exceeded
     */
    update(deltaTime) {
        // Update timer
        this.timer += deltaTime;
        
        // Check if duration is exceeded
        if (this.timer >= this.duration) {
            this.stopFireSound();
            return false;
        }
        
        // Update fire animation
        this.animationTimer += deltaTime;
        if (this.animationTimer >= this.animationSpeed) {
            this.animationTimer = 0;
            
            // Use pre-calculated frame sequence
            const frameIndex = Math.floor(this.timer / this.animationSpeed);
            if (frameIndex < this.frameSequence.length) {
                this.animationFrame = this.frameSequence[frameIndex];
            } else {
                // Fallback to looping animation if we exceed the pre-calculated sequence
                const frameCount = this.frameSequence.length;
                this.animationFrame = frameIndex % frameCount;
            }
        }
        
        return true;
    }
    
    /**
     * Draws the fire animation
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    draw(ctx) {
        ctx.save();
        
        // Draw fire sprite
        this.drawFireSprite(ctx);
        
        // Draw particles
        this.drawParticles(ctx);
        
        ctx.restore();
    }
    
    /**
     * Draws the fire sprite
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    drawFireSprite(ctx) {
        // Get fire sprite array from /assets/visuals/vehicles/fire_sprites
        const fireSprites = assets.visuals.vehicles.fire_sprites;
        
        if (fireSprites && fireSprites.length > 0) {
            // Make sure animation frame is within bounds
            const frameIndex = this.animationFrame % fireSprites.length;
            const fireSprite = fireSprites[frameIndex];
            
            if (fireSprite) {
                // Add a glow effect for more intensity
                ctx.shadowColor = 'rgba(255, 120, 0, 0.6)';
                ctx.shadowBlur = 20;
                
                // Draw fire sprite from /assets/visuals/vehicles/fire_sprites
                ctx.drawImage(
                    fireSprite, 
                    this.x - this.width / 2, 
                    this.y - this.height / 2 - 15, // Offset upward slightly
                    this.width, 
                    this.height
                );
                
                // Add overlay to enhance the fire appearance
                this.drawFireOverlay(ctx);
            } else {
                // If sprite can't be loaded, use fallback
                this.drawFallbackFire(ctx);
            }
        } else {
            // If no sprites available, use fallback
            this.drawFallbackFire(ctx);
        }
    }
    
    /**
     * Draws an overlay effect to enhance the fire appearance
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    drawFireOverlay(ctx) {
        // Add a pulsing glow in the center of the fire
        const glowRadius = 20 + Math.sin(this.timer * 8) * 5;
        const gradient = ctx.createRadialGradient(
            this.x, this.y - 10, 0,
            this.x, this.y - 10, glowRadius
        );
        
        gradient.addColorStop(0, 'rgba(255, 255, 200, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 120, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 10, glowRadius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    /**
     * Draws a fallback fire if sprites aren't available
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    drawFallbackFire(ctx) {
        // Create a simple animated fire effect
        const fireWidth = this.width * 0.8;
        const fireHeight = this.height * 1.2;
        
        // Base of fire (yellow/orange)
        const gradient = ctx.createRadialGradient(
            this.x, this.y - 10, 
            5, 
            this.x, this.y - 10, 
            fireWidth / 2
        );
        
        gradient.addColorStop(0, 'rgba(255, 255, 200, 0.95)'); // Light yellow center
        gradient.addColorStop(0.4, 'rgba(255, 160, 0, 0.9)');  // Orange middle
        gradient.addColorStop(0.7, 'rgba(255, 50, 0, 0.8)');   // Red-orange edge
        gradient.addColorStop(1, 'rgba(200, 0, 0, 0)');        // Fade out to transparent
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        
        // Create a flame shape that changes with time
        const flameHeight = fireHeight * (0.8 + Math.sin(this.timer * 10) * 0.2);
        
        ctx.moveTo(this.x - fireWidth / 2, this.y);
        
        // Left curve
        ctx.quadraticCurveTo(
            this.x - fireWidth / 4, this.y - flameHeight / 3,
            this.x, this.y - flameHeight
        );
        
        // Right curve
        ctx.quadraticCurveTo(
            this.x + fireWidth / 4, this.y - flameHeight / 3,
            this.x + fireWidth / 2, this.y
        );
        
        ctx.closePath();
        ctx.fill();
        
        // Add glow
        ctx.shadowColor = 'rgba(255, 120, 0, 0.8)';
        ctx.shadowBlur = 15;
        ctx.fill();
    }
    
    /**
     * Draws the particles for fire effect
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    drawParticles(ctx) {
        for (const particle of this.particles) {
            // Only draw particles during their lifetime
            if (this.timer >= particle.startTime && 
                this.timer <= particle.startTime + particle.lifetime) {
                
                // Calculate progress through particle lifetime
                const progress = (this.timer - particle.startTime) / particle.lifetime;
                
                // Use pre-calculated position
                const positionIndex = Math.floor(progress * (particle.positions.length - 1));
                const position = particle.positions[positionIndex];
                
                // Fade out as particle ages
                const opacity = particle.initialOpacity * (1 - progress);
                
                // Draw particle
                ctx.save();
                ctx.globalAlpha = opacity;
                
                // Create gradient for particle
                const gradient = ctx.createRadialGradient(
                    this.x + position.x, this.y + position.y, 0,
                    this.x + position.x, this.y + position.y, particle.size
                );
                
                gradient.addColorStop(0, 'rgba(255, 255, 200, 0.8)');
                gradient.addColorStop(0.5, 'rgba(255, 120, 0, 0.6)');
                gradient.addColorStop(1, 'rgba(255, 60, 0, 0)');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(this.x + position.x, this.y + position.y, particle.size, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
            }
        }
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Fire };
} 