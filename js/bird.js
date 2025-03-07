/**
 * Represents the player-controlled bird
 * @class
 */
class Bird {
    /**
     * Creates a new Bird instance
     * @param {number} x - Initial x position
     * @param {number} y - Initial y position
     * @param {number} canvasWidth - Canvas width for boundary checking
     * @param {number} canvasHeight - Canvas height for boundary checking
     */
    constructor(x = 400, y = 200, canvasWidth = 800, canvasHeight = 400) {
        this.x = x;
        this.y = y;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.speed = 200; // pixels per second
        
        // Set fixed size for the bird (was too large before)
        this.width = 48;
        this.height = 48;
        
        // Movement state
        this.movingLeft = false;
        this.movingRight = false;
        this.movingUp = false;
        this.movingDown = false;
        
        // Animation state
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.animationSpeed = 1/30; // 30 FPS animation
        this.totalFrames = 17; // 0-16 frames
        
        // Dropping state
        this.activeDropping = null;
        
        // Power-up properties
        this.bellyPoints = 0;
        this.powerUpLevel = 0;
        this.maxPowerUpLevel = 5;
        
        // Initialize dropping properties based on power level
        this.updatePowerUpProperties();
        
        // Dropping cooldown timer
        this.droppingCooldownTimer = 0;
    }

    /**
     * Updates the bird's power-up properties based on current level
     */
    updatePowerUpProperties() {
        // Define power-up levels
        const powerUpLevels = [
            { poopSize: 10, poopCooldown: 1.0, splashRadius: 0 },   // Level 0
            { poopSize: 15, poopCooldown: 0.8, splashRadius: 20 },  // Level 1
            { poopSize: 20, poopCooldown: 0.6, splashRadius: 40 },  // Level 2
            { poopSize: 25, poopCooldown: 0.5, splashRadius: 60 },  // Level 3
            { poopSize: 30, poopCooldown: 0.4, splashRadius: 80 },  // Level 4
            { poopSize: 35, poopCooldown: 0.3, splashRadius: 100 }  // Level 5
        ];
        
        // Get properties for current level
        const levelProps = powerUpLevels[this.powerUpLevel];
        
        // Update properties
        this.poopSize = levelProps.poopSize;
        this.poopCooldown = levelProps.poopCooldown;
        this.splashRadius = levelProps.splashRadius;
    }

    /**
     * Handles the bird eating food for power-ups
     * @param {Food} food - The food item being consumed
     */
    eatFood(food) {
        if (!food) return;
        
        // Increase belly points
        this.bellyPoints += food.bellyPoints;
        
        // Calculate new power-up level (e.g., level 1 at 5 points, level 2 at 10, etc.)
        const newLevel = Math.min(Math.floor(this.bellyPoints / 5), this.maxPowerUpLevel);
        
        // Check if level increased
        if (newLevel > this.powerUpLevel) {
            this.powerUpLevel = newLevel;
            this.updatePowerUpProperties();
            
            // Play power-up sound
            if (assets && assets.sounds && assets.sounds.effects && assets.sounds.effects.powerup) {
                assets.sounds.effects.powerup.currentTime = 0;
                assets.sounds.effects.powerup.play();
            }
        }
    }

    /**
     * Start moving left
     */
    startMovingLeft() {
        this.movingLeft = true;
    }

    /**
     * Stop moving left
     */
    stopMovingLeft() {
        this.movingLeft = false;
    }

    /**
     * Start moving right
     */
    startMovingRight() {
        this.movingRight = true;
    }

    /**
     * Stop moving right
     */
    stopMovingRight() {
        this.movingRight = false;
    }

    /**
     * Start moving up
     */
    startMovingUp() {
        this.movingUp = true;
    }

    /**
     * Stop moving up
     */
    stopMovingUp() {
        this.movingUp = false;
    }

    /**
     * Start moving down
     */
    startMovingDown() {
        this.movingDown = true;
    }

    /**
     * Stop moving down
     */
    stopMovingDown() {
        this.movingDown = false;
    }

    /**
     * Creates a dropping at the bird's position
     * @returns {Object|null} The dropping object or null if one already exists or on cooldown
     */
    drop() {
        if (this.activeDropping || this.droppingCooldownTimer > 0) {
            return null; // Only one dropping at a time or on cooldown
        }
        
        // Create dropping at bird's center with current power-up properties
        this.activeDropping = {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2,
            width: this.poopSize,
            height: this.poopSize,
            speed: 300, // pixels per second
            splashRadius: this.splashRadius,
            draw: function(ctx) {
                ctx.fillStyle = '#8B4513'; // Brown color for poop
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.width / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        };
        
        // Start cooldown
        this.droppingCooldownTimer = this.poopCooldown;
        
        // Play sound effect
        if (assets && assets.sounds && assets.sounds.effects && assets.sounds.effects.poop) {
            assets.sounds.effects.poop.currentTime = 0;
            assets.sounds.effects.poop.play();
        }
        
        return this.activeDropping;
    }

    /**
     * Updates bird position and animation state
     * @param {number} deltaTime - Time elapsed since last update in seconds
     */
    update(deltaTime) {
        // Update animation
        this.frameTimer += deltaTime;
        if (this.frameTimer >= this.animationSpeed) {
            this.currentFrame = (this.currentFrame + 1) % this.totalFrames;
            this.frameTimer = 0;
        }

        // Calculate velocity based on movement state
        let vx = 0;
        let vy = 0;
        
        if (this.movingLeft) vx -= this.speed;
        if (this.movingRight) vx += this.speed;
        if (this.movingUp) vy -= this.speed;
        if (this.movingDown) vy += this.speed;
        
        // Normalize diagonal movement
        if (vx !== 0 && vy !== 0) {
            const length = Math.sqrt(vx * vx + vy * vy);
            vx = (vx / length) * this.speed;
            vy = (vy / length) * this.speed;
        }
        
        // Update position
        this.x += vx * deltaTime;
        this.y += vy * deltaTime;
        
        // Clamp position to canvas boundaries
        this.x = Math.max(0, Math.min(this.canvasWidth - this.width, this.x));
        this.y = Math.max(0, Math.min(this.canvasHeight - this.height, this.y));
        
        // Update active dropping
        if (this.activeDropping) {
            this.activeDropping.y += this.activeDropping.speed * deltaTime;
            
            // Remove dropping if it goes off screen
            if (this.activeDropping.y > this.canvasHeight) {
                this.activeDropping = null;
            }
        }
        
        // Update dropping cooldown
        if (this.droppingCooldownTimer > 0) {
            this.droppingCooldownTimer -= deltaTime;
            if (this.droppingCooldownTimer < 0) {
                this.droppingCooldownTimer = 0;
            }
        }
    }

    /**
     * Draws the bird on the canvas
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    draw(ctx) {
        // Draw bird
        if (assets && assets.visuals && assets.visuals.bird_flying) {
            const currentSprite = assets.visuals.bird_flying[this.currentFrame];
            if (currentSprite) {
                ctx.save();
                
                // Determine if the bird is moving left
                const isMovingLeft = this.movingLeft && !this.movingRight;
                
                if (isMovingLeft) {
                    // Mirror the bird when moving left
                    ctx.translate(this.x + this.width, this.y);
                    ctx.scale(-1, 1);
                    ctx.drawImage(
                        currentSprite,
                        0,
                        0,
                        this.width,
                        this.height
                    );
                } else {
                    // Normal drawing when moving right or other directions
                    ctx.drawImage(
                        currentSprite,
                        this.x,
                        this.y,
                        this.width,
                        this.height
                    );
                }
                
                ctx.restore();
            }
        } else {
            // Fallback if sprites aren't loaded
            ctx.fillStyle = 'blue';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        
        // Draw dropping if active
        if (this.activeDropping) {
            ctx.fillStyle = '#8B4513'; // Brown color
            ctx.beginPath();
            ctx.arc(
                this.activeDropping.x, 
                this.activeDropping.y, 
                this.activeDropping.width / 2, // Use size from power-up level
                0, 
                Math.PI * 2
            );
            ctx.fill();
            
            // Draw splash radius indicator if applicable
            if (this.activeDropping.splashRadius > 0) {
                ctx.strokeStyle = 'rgba(139, 69, 19, 0.3)'; // Transparent brown
                ctx.beginPath();
                ctx.arc(
                    this.activeDropping.x,
                    this.activeDropping.y,
                    this.activeDropping.splashRadius,
                    0,
                    Math.PI * 2
                );
                ctx.stroke();
            }
        }
        
        // Draw power-up level indicator
        if (this.powerUpLevel > 0) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 0, 0.7)'; // Yellow glow
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y - 10, 8, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = 'black';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.powerUpLevel.toString(), this.x + this.width/2, this.y - 10);
            ctx.restore();
        }
    }

    /**
     * Gets the current position of the bird
     * @returns {{x: number, y: number}} The current coordinates
     */
    getPosition() {
        return { x: this.x, y: this.y };
    }

    /**
     * Gets the active dropping if it exists
     * @returns {Object|null} The active dropping object or null
     */
    getActiveDropping() {
        return this.activeDropping;
    }

    /**
     * Removes the active dropping (e.g., after a collision)
     */
    removeDropping() {
        this.activeDropping = null;
    }
    
    /**
     * Gets the current power-up level and properties
     * @returns {Object} Power-up state
     */
    getPowerUpState() {
        return {
            bellyPoints: this.bellyPoints,
            powerUpLevel: this.powerUpLevel,
            poopSize: this.poopSize,
            poopCooldown: this.poopCooldown,
            splashRadius: this.splashRadius
        };
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Bird };
} 