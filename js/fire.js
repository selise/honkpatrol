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
     * Initialize particles for the fire effect
     */
    initParticles() {
        const particleCount = 15;
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.width - this.width / 2,
                y: Math.random() * this.height / 2 - this.height / 4,
                size: Math.random() * 10 + 5,
                speedX: (Math.random() - 0.5) * 10,
                speedY: -Math.random() * 20 - 10,
                life: Math.random() * this.duration * 0.7,
                opacity: Math.random() * 0.5 + 0.5
            });
        }
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
        } else if (assets.sounds && assets.sounds.effects && assets.sounds.effects.crash) {
            // Fall back to crash sound if fire sound isn't available
            const crashSound = assets.sounds.effects.crash;
            crashSound.currentTime = 0;
            try {
                crashSound.play().catch(err => {
                    // Silently fail if autoplay is blocked
                    console.debug('Crash sound autoplay blocked:', err);
                });
            } catch (err) {
                // Silently fail if play() throws an error
                console.debug('Crash sound play failed:', err);
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
            // Get number of fire frames
            const fireSprites = assets.visuals.vehicles.fire_sprites;
            const frameCount = fireSprites && fireSprites.length > 0 ? fireSprites.length : 4;
            this.animationFrame = (this.animationFrame + 1) % frameCount;
        }
        
        // Update particles
        this.updateParticles(deltaTime);
        
        return true;
    }
    
    /**
     * Updates particle positions and properties
     * @param {number} deltaTime - Time elapsed since last update in seconds
     */
    updateParticles(deltaTime) {
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            
            // Update position
            particle.x += particle.speedX * deltaTime;
            particle.y += particle.speedY * deltaTime;
            
            // Update life
            particle.life -= deltaTime;
            
            // Fade out based on life
            particle.opacity = Math.max(0, particle.life / (this.duration * 0.7));
            
            // Reset dead particles
            if (particle.life <= 0) {
                particle.x = Math.random() * this.width - this.width / 2;
                particle.y = Math.random() * this.height / 2 - this.height / 4;
                particle.size = Math.random() * 10 + 5;
                particle.speedX = (Math.random() - 0.5) * 10;
                particle.speedY = -Math.random() * 20 - 10;
                particle.life = Math.random() * this.duration * 0.7 * (1 - this.timer / this.duration);
                particle.opacity = Math.random() * 0.5 + 0.5;
            }
        }
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
                // Print debug info on first frame
                if (this.timer < 0.1 && frameIndex === 0) {
                    console.log(`Drawing fire with sprite from /assets/visuals/vehicles/fire_sprites`);
                }
                
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
     * Draws the particles for the fire effect
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    drawParticles(ctx) {
        // Reset shadow for particles
        ctx.shadowBlur = 0;
        
        // Draw smoke/ember particles
        for (const particle of this.particles) {
            // Determine if this is a smoke particle or ember based on speed
            const isEmber = Math.abs(particle.speedX) > 5;
            
            if (isEmber) {
                // Draw ember (small bright particles)
                ctx.fillStyle = `rgba(255, ${Math.floor(Math.random() * 100 + 100)}, 0, ${particle.opacity})`;
                ctx.beginPath();
                ctx.arc(
                    this.x + particle.x,
                    this.y + particle.y,
                    particle.size / 3,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            } else {
                // Draw smoke (larger gray particles)
                ctx.fillStyle = `rgba(100, 100, 100, ${particle.opacity * 0.7})`;
                ctx.beginPath();
                ctx.arc(
                    this.x + particle.x,
                    this.y + particle.y,
                    particle.size,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }
        }
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Fire };
} 